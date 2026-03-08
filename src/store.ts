import { AppState, UserProfile, UserData, Subject } from './types';
import { Modal } from './ui/modal';
import {
    upsertUser,
    createSemester,
    createSubject,
    upsertAttendance,
    getSemesters,
    getSubjects,
    getAttendance,
    updateSemester
} from './supabase-service';

const APP_KEY = 'campusCare_premium_data';

const initialUserData: UserData = {
    setupComplete: false,
    semesterConfig: { startDate: '', endDate: '', minAttendance: 75 },
    subjects: [],
    timetable: {},
    attendance: {},
    attendanceReasons: {},
    attendanceNotes: {},
    extraClasses: {},
    holidays: [],
    grades: [],
    preferences: { cgpaMode: 'grade' },
    sgpaHistory: null
};

class Store {
    private state: AppState;

    constructor() {
        this.state = this.load();
    }

    private load(): AppState {
        const raw = localStorage.getItem(APP_KEY);
        if (raw) {
            const state = JSON.parse(raw) as AppState;
            // Migration Logic
            state.users.forEach((u: any) => {
                if (u.data && !u.semesters) {
                    console.log(`Migrating user ${u.name} to multi-semester structure.`);
                    u.semesters = { 1: u.data };
                    u.currentSemesterId = u.currentSemester || 1;
                    delete u.data;
                    delete u.currentSemester;
                }

                if (u.semesters) {
                    Object.values(u.semesters).forEach((s: any) => {
                        // 1. Ensure all Timetable entries have an `id`
                        if (s.timetable) {
                            Object.entries(s.timetable).forEach(([_, daySchedule]: [string, any]) => {
                                daySchedule.forEach((entry: any) => {
                                    if (!entry.startTime) entry.startTime = '09:00';
                                    if (!entry.endTime) entry.endTime = '10:00';
                                    if (!entry.id) {
                                        entry.id = `slot_${entry.subjectId}_${entry.startTime.replace(':', '')}`;
                                    }
                                });
                            });
                        }

                        // 2. Migrate Attendance records from [subjectId] to [slotId]
                        const migrateRecord = (recordMap: any) => {
                            if (!recordMap) return;
                            Object.entries(recordMap).forEach(([date, subjMap]: [string, any]) => {
                                const newSubjMap: Record<string, any> = {};
                                const dateObj = new Date(date);
                                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                                const daySchedule = s.timetable?.[dayName] || [];

                                Object.entries(subjMap).forEach(([subjIdStr, value]) => {
                                    const numId = Number(subjIdStr);
                                    if (isNaN(numId)) {
                                        // Already looks like a string/slotId or something else we don't touch
                                        newSubjMap[subjIdStr] = value;
                                        return;
                                    }

                                    // Find matching slot. If multiple slots for same subject on same day,
                                    // legacy data can't distinguish, so we just attach to the first one found.
                                    const matchingSlot = daySchedule.find((entry: any) => entry.subjectId === numId);

                                    if (matchingSlot) {
                                        newSubjMap[matchingSlot.id] = value;
                                    } else {
                                        // Fallback if slot was deleted but attendance remains
                                        newSubjMap[`slot_${numId}_legacy`] = value;
                                    }
                                });
                                recordMap[date] = newSubjMap;
                            });
                        };

                        if (s.attendance) migrateRecord(s.attendance);
                        if (s.attendanceReasons) migrateRecord(s.attendanceReasons);
                        if (s.attendanceNotes) migrateRecord(s.attendanceNotes);
                    });
                }
            });
            return state;
        }
        return { users: [] };
    }

    public save(): void {
        try {
            localStorage.setItem(APP_KEY, JSON.stringify(this.state));
        } catch (e) {
            console.error("Storage Limit Exceeded or Error:", e);
            Modal.alert("Warning: Local storage full. Some data may not be saved.");
        }
    }

    public getUsers(): UserProfile[] {
        return this.state.users;
    }

    public addUser(user: UserProfile): void {
        if (!user.semesters) {
            user.semesters = { 1: JSON.parse(JSON.stringify(initialUserData)) };
            user.currentSemesterId = 1;
        }
        this.state.users.push(user);
        this.save();
    }

    public getCurrentUser(): UserProfile | undefined {
        return this.state.currentUser;
    }

    public login(username: string): void {
        const user = this.state.users.find(u => u.username === username);
        if (user) {
            this.state.currentUser = user;
        }
    }

    public async syncToSupabase(): Promise<void> {
        const user = this.state.currentUser;
        if (!user || user.username.startsWith('local_')) return;

        try {
            console.log('Syncing starting for:', user.username);

            // Sync user profile
            await upsertUser(user.username, user.email || '', user.name);

            // Sync semesters, subjects, attendance and timetable
            for (const semNumStr of Object.keys(user.semesters)) {
                const semNum = Number(semNumStr);
                const semester = user.semesters[semNum];

                // Track backend UUIDs to map standard integer IDs
                if (!(semester as any).supabase_id) {
                    const sbSemester = await createSemester(user.username, {
                        name: `Semester ${semNum}`,
                        start_date: semester.semesterConfig?.startDate || null,
                        end_date: semester.semesterConfig?.endDate || null,
                        config: semester
                    });
                    (semester as any).supabase_id = sbSemester.id;
                }
                const semesterSupabaseId = (semester as any).supabase_id;

                // Sync subjects
                const subIdMap: Record<number, string> = {};
                for (let i = 0; i < semester.subjects.length; i++) {
                    const subj = semester.subjects[i];
                    if (!(subj as any).supabase_id) {
                        const sbSubj = await createSubject(semesterSupabaseId, {
                            name: subj.name,
                            credits: subj.credits,
                            class_type: subj.breakdown?.theory ? 'Theory' : 'Lab',
                        });
                        (subj as any).supabase_id = sbSubj.id;
                    }
                    subIdMap[subj.id] = (subj as any).supabase_id;
                }

                // Sync Attendance
                if (semester.attendance) {
                    const promises: Promise<any>[] = [];
                    for (const [date, slotMap] of Object.entries(semester.attendance)) {
                        for (const [slotId, status] of Object.entries(slotMap)) {
                            // Slot ID format: "slot_123_0900" or similar. Extract subject ID if we need to sync by subject.
                            // Currently API expects subject UUID. Let's find subject ID from slotId.
                            let numericSubjId: number | null = null;
                            const match = slotId.match(/slot_(\d+)_/);
                            if (match) {
                                numericSubjId = Number(match[1]);
                            }

                            if (numericSubjId) {
                                const uuid = subIdMap[numericSubjId] || (semester.subjects.find(s => s.id === numericSubjId) as any)?.supabase_id;

                                if (uuid) {
                                    const reason = semester.attendanceReasons?.[date]?.[slotId] || undefined;
                                    promises.push(upsertAttendance(uuid as unknown as string, date, status, reason));
                                }
                            }
                        }
                    }
                    // Batch execution to avoid firing 500 requests at once and hitting connection limits
                    const chunkSize = 20;
                    for (let i = 0; i < promises.length; i += chunkSize) {
                        await Promise.all(promises.slice(i, i + chunkSize));
                    }
                }

                // Note: timetable_slots are left untouched strictly for caching strategy,
                // you would map and `upsertTimetableSlot` similarly.
            }

            this.save();
            this.setOfflineMode(false);
            console.log('Syncing complete for:', user.username);
        } catch (e) {
            console.error('Failed to sync to Supabase:', e);
            this.setOfflineMode(true);
        }
    }

    public async loadFromSupabase(auth0Sub: string): Promise<boolean> {
        try {
            this.setOfflineMode(false);
            const semesters = await getSemesters(auth0Sub);
            if (!semesters || semesters.length === 0) return false;

            // Simple reconstruction of the state if supabase has data
            const userStateSemesters: { [id: number]: UserData } = {};
            let maxSemNum = 0;

            for (let i = 0; i < semesters.length; i++) {
                const sbSem = semesters[i];
                const semNum = i + 1; // Basic assumption if no manual order 
                maxSemNum = semNum;

                // Decode config
                const userData: UserData = sbSem.config ? { ...initialUserData, ...sbSem.config } : JSON.parse(JSON.stringify(initialUserData));
                userData.semesterConfig.startDate = sbSem.start_date || userData.semesterConfig.startDate;
                userData.semesterConfig.endDate = sbSem.end_date || userData.semesterConfig.endDate;
                (userData as any).supabase_id = sbSem.id;

                const subjects = await getSubjects(sbSem.id);
                userData.subjects = subjects.map((s, idx) => {
                    const localSubj = userData.subjects.find(us => (us as any).supabase_id === s.id) || {
                        id: idx + 1,
                        name: s.name,
                        credits: s.credits || 0,
                        breakdown: { theory: 1, tutorial: 0, lab: 0 },
                        totalClasses: 40,
                        evalType: 'internal_end',
                        marks: { internalMax: 30, endTermMax: 70 },
                        priority: 'medium'
                    } as Subject;

                    (localSubj as any).supabase_id = s.id;
                    return localSubj;
                });

                // Attendance
                const attendancePromises = userData.subjects.map(async (sub) => {
                    const uuid = (sub as any).supabase_id;
                    if (uuid) {
                        const records = await getAttendance(uuid);
                        records.forEach(ar => {
                            if (!userData.attendance[ar.date]) userData.attendance[ar.date] = {};
                            userData.attendance[ar.date][sub.id] = ar.status as any;

                            if (ar.reason) {
                                if (!userData.attendanceReasons[ar.date]) userData.attendanceReasons[ar.date] = {};
                                userData.attendanceReasons[ar.date][sub.id] = ar.reason;
                            }
                        });
                    }
                });
                await Promise.all(attendancePromises);

                userStateSemesters[semNum] = userData;
            }

            // Look up existing user locally and apply retrieved remote semesters.
            let localUser = this.state.users.find(u => u.username === auth0Sub);
            if (localUser) {
                localUser.semesters = userStateSemesters;
                localUser.currentSemesterId = localUser.currentSemesterId || maxSemNum;
            }

            this.save();
            return true;
        } catch (e) {
            console.error('Failed to load from Supabase:', e);
            this.setOfflineMode(true);
            return false;
        }
    }

    public async handleAuth0Login(auth0User: any): Promise<void> {
        const uid = auth0User.sub;
        const email = auth0User.email;

        // Visual indicator could be handled higher up, basic logic mapping below
        const syncIndicator = document.createElement('div');
        syncIndicator.id = 'sync-indicator';
        syncIndicator.textContent = 'Syncing...';
        syncIndicator.style.cssText = 'position:fixed;top:10px;right:10px;background:#4C36EF;color:white;padding:5px 10px;border-radius:4px;z-index:9999;font-size:0.8rem;';
        document.body.appendChild(syncIndicator);

        try {
            let user = this.state.users.find(u => u.username === uid);

            if (!user && email) {
                user = this.state.users.find(u => u.email === email);
                if (user) {
                    user.username = uid;
                }
            }

            if (!user) {
                user = {
                    username: uid,
                    email: email,
                    password: '',
                    name: auth0User.name || auth0User.email || 'User',
                    currentSemesterId: 1,
                    semesters: { 1: JSON.parse(JSON.stringify(initialUserData)) }
                };
                this.state.users.push(user);
            } else {
                if (email && !user.email) {
                    user.email = email;
                }
            }

            this.state.currentUser = user;
            this.save();

            // Perform Sync Loading vs Local Defaulting
            const loadedFromBackend = await this.loadFromSupabase(uid);

            if (!loadedFromBackend && user.semesters && Object.keys(user.semesters).length > 0) {
                await this.syncToSupabase();
            }

            // Note: Make sure the store relies on the re-loaded properties
            // The loading mutates `user.semesters`, UI should just pick up state
        } finally {
            const ind = document.getElementById('sync-indicator');
            if (ind) ind.remove();
        }
    }

    public logout(): void {
        this.state.currentUser = undefined;
        this.save();
    }

    public saveSgpa(semesterId: string, sgpa: number, totalCredits: number): void {
        const user = this.state.currentUser;
        if (!user) return;

        const semIdNum = parseInt(semesterId);
        const semester = user.semesters[semIdNum];
        if (semester) {
            semester.sgpaHistory = {
                sgpa,
                totalCredits,
                savedAt: new Date().toISOString()
            };
            this.save();
            this.syncEntityToSupabase('semester', semester).catch(console.error);
        }
    }

    public getAllSgpaHistory(): { semesterName: string, sgpa: number, totalCredits: number, savedAt: string }[] {
        const user = this.state.currentUser;
        if (!user) return [];

        const history: { semesterName: string, sgpa: number, totalCredits: number, savedAt: string }[] = [];

        Object.entries(user.semesters).forEach(([semId, semData]) => {
            if (semData.sgpaHistory) {
                history.push({
                    semesterName: `Semester ${semId}`,
                    sgpa: semData.sgpaHistory.sgpa,
                    totalCredits: semData.sgpaHistory.totalCredits,
                    savedAt: semData.sgpaHistory.savedAt
                });
            }
        });

        return history.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
    }

    public updateUserData(partialData: Partial<UserData>): void {
        if (!this.state.currentUser) return;

        const curId = this.state.currentUser.currentSemesterId;
        console.log(`Updating data for User: ${this.state.currentUser.name} (Sem ${curId})`, partialData);

        if (!this.state.currentUser.semesters[curId]) {
            this.state.currentUser.semesters[curId] = JSON.parse(JSON.stringify(initialUserData));
        }

        this.state.currentUser.semesters[curId] = {
            ...this.state.currentUser.semesters[curId],
            ...partialData
        };
        this.save();

        let type: 'attendance' | 'subject' | 'semester' = 'semester';
        if (partialData.attendance || partialData.attendanceReasons || partialData.attendanceNotes || partialData.extraClasses) {
            type = 'attendance';
        } else if (partialData.subjects || partialData.timetable) {
            type = 'subject';
        }

        const semesterData = this.state.currentUser.semesters[curId];
        this.syncEntityToSupabase(type, semesterData).catch(console.error);
    }

    public updateUserProfile(partialProfile: Partial<UserProfile>): void {
        if (!this.state.currentUser) return;
        Object.assign(this.state.currentUser, partialProfile);
        this.save();
        this.syncToSupabase().catch(e => console.error("Background sync skip", e));
    }

    public getData(): UserData | null {
        if (!this.state.currentUser) return null;
        const curId = this.state.currentUser.currentSemesterId;
        return this.state.currentUser.semesters[curId] || null;
    }

    public addSemester(semesterNum: number): void {
        if (!this.state.currentUser) return;
        if (this.state.currentUser.semesters[semesterNum]) {
            Modal.alert(`Semester ${semesterNum} already exists.`);
            return;
        }
        this.state.currentUser.semesters[semesterNum] = JSON.parse(JSON.stringify(initialUserData));
        this.state.currentUser.currentSemesterId = semesterNum;
        this.save();
        const semesterData = this.state.currentUser.semesters[semesterNum];
        this.syncEntityToSupabase('semester', semesterData).catch(console.error);
    }

    public deleteSemester(semesterNum: number): void {
        if (!this.state.currentUser) return;

        delete this.state.currentUser.semesters[semesterNum];

        const remainingSems = Object.keys(this.state.currentUser.semesters).map(Number).sort((a, b) => b - a);
        const fallback = remainingSems.length > 0 ? remainingSems[0] : 1;

        if (remainingSems.length === 0) {
            this.state.currentUser.semesters[1] = JSON.parse(JSON.stringify(initialUserData));
            this.state.currentUser.currentSemesterId = 1;
        } else {
            this.state.currentUser.currentSemesterId = fallback;
        }

        this.save();
    }

    public switchSemester(semesterNum: number): void {
        if (!this.state.currentUser) return;
        if (!this.state.currentUser.semesters[semesterNum]) {
            Modal.alert(`Semester ${semesterNum} does not exist.`);
            return;
        }
        this.state.currentUser.currentSemesterId = semesterNum;
        this.save();
    }

    public deleteAccount(username: string): void {
        this.state.users = this.state.users.filter(u => u.username !== username);
        if (this.state.currentUser?.username === username) {
            this.state.currentUser = undefined;
        }
        this.save();
    }

    private setOfflineMode(isOffline: boolean): void {
        let badge = document.getElementById('offline-badge');
        if (isOffline) {
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'offline-badge';
                badge.textContent = '⚡ Offline Mode';
                badge.style.cssText = 'position:fixed;bottom:4px;left:20px;background:#fef9c3;color:#92400e;padding:4px 8px;border-radius:12px;font-size:0.7rem;font-weight:600;z-index:9999;box-shadow:0 2px 4px rgba(0,0,0,0.1);';
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    badge.style.position = 'absolute';
                    sidebar.appendChild(badge);
                } else {
                    document.body.appendChild(badge);
                }
            }
            badge.style.display = 'block';
        } else if (badge) {
            badge.style.display = 'none';
        }
    }

    private updateSyncIndicator(status: 'synced' | 'syncing' | 'failed'): void {
        let container = document.getElementById('sync-status-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'sync-status-container';
            container.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:20px;padding:4px 12px;margin-bottom:8px;font-size:0.7rem;color:#6b7280;';
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                // Insert it right before the logout button in the bottom section
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn && logoutBtn.parentNode) {
                    logoutBtn.parentNode.insertBefore(container, logoutBtn);
                } else {
                    sidebar.appendChild(container);
                }
            } else {
                container.style.position = 'fixed';
                container.style.bottom = '28px';
                container.style.left = '20px';
                document.body.appendChild(container); // Fallback
            }

            const dot = document.createElement('div');
            dot.id = 'sync-status-dot';
            dot.style.cssText = 'width:8px;height:8px;border-radius:50%;transition:background-color 0.3s ease;';

            const label = document.createElement('div');
            label.id = 'sync-status-label';
            label.style.cssText = 'font-size:0.7rem;transition:color 0.3s ease;';

            container.appendChild(dot);
            container.appendChild(label);
        }

        const dot = document.getElementById('sync-status-dot');
        const label = document.getElementById('sync-status-label');

        let color = '#16a34a';
        let text = 'Synced';

        if (status === 'syncing') {
            color = '#f97316';
            text = 'Syncing...';
        } else if (status === 'failed') {
            color = '#ef4444';
            text = 'Sync failed';
            this.setOfflineMode(true);
        } else {
            this.setOfflineMode(false);
        }

        if (dot) dot.style.backgroundColor = color;
        if (label) {
            label.textContent = text;
        }
    }

    public async syncEntityToSupabase(type: 'attendance' | 'subject' | 'semester', data: any): Promise<void> {
        const user = this.state.currentUser;
        if (!user || user.username.startsWith('local_')) return;

        this.updateSyncIndicator('syncing');

        try {
            const semesterSupabaseId = data.supabase_id;

            if (type === 'semester') {
                if (!semesterSupabaseId) {
                    const sbSemester = await createSemester(user.username, {
                        name: `Semester ${user.currentSemesterId}`,
                        start_date: data.semesterConfig?.startDate || null,
                        end_date: data.semesterConfig?.endDate || null,
                        config: data
                    });
                    data.supabase_id = sbSemester.id;
                    this.save();
                } else {
                    await updateSemester(semesterSupabaseId, {
                        start_date: data.semesterConfig?.startDate || null,
                        end_date: data.semesterConfig?.endDate || null,
                        config: data
                    });
                }
            } else if (type === 'subject') {
                if (semesterSupabaseId) {
                    for (let i = 0; i < data.subjects.length; i++) {
                        const subj = data.subjects[i];
                        if (!subj.supabase_id) {
                            const sbSubj = await createSubject(semesterSupabaseId, {
                                name: subj.name,
                                credits: subj.credits,
                                class_type: subj.breakdown?.theory ? 'Theory' : 'Lab',
                            });
                            subj.supabase_id = sbSubj.id;
                        }
                    }
                    this.save();
                }
            } else if (type === 'attendance') {
                if (semesterSupabaseId) {
                    if (data.attendance) {
                        for (const [date, slotMap] of Object.entries(data.attendance)) {
                            for (const [slotId, status] of Object.entries(slotMap as Record<string, string>)) {
                                let numericSubjId: number | null = null;
                                const match = slotId.match(/slot_(\d+)_/);
                                if (match) numericSubjId = Number(match[1]);

                                if (numericSubjId) {
                                    const uuid = data.subjects.find((s: any) => s.id === numericSubjId)?.supabase_id;
                                    if (uuid) {
                                        const reason = data.attendanceReasons?.[date]?.[slotId] || undefined;
                                        await upsertAttendance(uuid, date, status, reason);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            this.updateSyncIndicator('synced');
        } catch (e) {
            console.error('Granular sync failed:', e);
            this.updateSyncIndicator('failed');
        }
    }
}

export const store = new Store();
