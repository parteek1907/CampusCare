import { AppState, UserProfile, UserData } from './types';
import { Modal } from './ui/modal';

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
    preferences: { cgpaMode: 'grade' }
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
            // Migration Logic: If users have old structure (data property), migrate to semesters
            state.users.forEach((u: any) => {
                if (u.data && !u.semesters) {
                    console.log(`Migrating user ${u.name} to multi-semester structure.`);
                    u.semesters = { 1: u.data };
                    u.currentSemesterId = u.currentSemester || 1;
                    delete u.data;
                    delete u.currentSemester;
                }

                // Migrate Timetable for Time Grid
                if (u.semesters) {
                    Object.values(u.semesters).forEach((s: any) => {
                        if (s.timetable) {
                            Object.values(s.timetable).forEach((daySchedule: any) => {
                                daySchedule.forEach((entry: any) => {
                                    if (!entry.startTime) entry.startTime = '09:00';
                                    if (!entry.endTime) entry.endTime = '10:00';
                                });
                            });
                        }
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
        // Initialize data for new user in semester 1
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

    public handleAuth0Login(auth0User: any): void {
        const uid = auth0User.sub;
        const email = auth0User.email;

        // 1. Try finding by unique ID (sub)
        let user = this.state.users.find(u => u.username === uid);

        // 2. Fallback: Try finding by Email (if using different provider for same email)
        if (!user && email) {
            user = this.state.users.find(u => u.email === email);
            if (user) {
                console.log(`Linking existing account (email: ${email}) to new Auth0 ID: ${uid}`);
                // Update username to new UID to prevent future lookups failing
                // But wait, if we change username, we might break other things? 
                // Currently username is the primary key. 
                // Better approach: Keep old username but update this session?
                // Actually, if we update username, it's fine as long as we save.
                user.username = uid;
                this.save();
            }
        }

        if (!user) {
            // Register new user
            console.log("Creating new user for:", uid, email);
            user = {
                username: uid, // Auth0 Subject ID
                email: email, // Save email for future linking
                password: '',
                name: auth0User.name || auth0User.email || 'User',
                currentSemesterId: 1,
                semesters: { 1: JSON.parse(JSON.stringify(initialUserData)) }
            };
            this.state.users.push(user);
            this.save();
        } else {
            // Update email if missing in existing profile
            if (email && !user.email) {
                user.email = email;
                this.save();
            }
        }

        this.state.currentUser = user;
        this.save();
    }

    public logout(): void {
        this.state.currentUser = undefined;
        this.save();
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
    }

    public updateUserProfile(partialProfile: Partial<UserProfile>): void {
        if (!this.state.currentUser) return;
        Object.assign(this.state.currentUser, partialProfile);
        this.save();
    }

    // Helper to get raw state for specific features
    public getData(): UserData | null {
        if (!this.state.currentUser) return null;
        const curId = this.state.currentUser.currentSemesterId;
        return this.state.currentUser.semesters[curId] || null;
    }

    // --- Multi-Semester Actions ---

    public addSemester(semesterNum: number): void {
        if (!this.state.currentUser) return;
        if (this.state.currentUser.semesters[semesterNum]) {
            Modal.alert(`Semester ${semesterNum} already exists.`);
            return;
        }
        this.state.currentUser.semesters[semesterNum] = JSON.parse(JSON.stringify(initialUserData));
        this.state.currentUser.currentSemesterId = semesterNum;
        this.save();
    }

    public deleteSemester(semesterNum: number): void {
        if (!this.state.currentUser) return;

        // Remove the semester
        delete this.state.currentUser.semesters[semesterNum];

        // Switch to the highest available semester
        const remainingSems = Object.keys(this.state.currentUser.semesters).map(Number).sort((a, b) => b - a);
        const fallback = remainingSems.length > 0 ? remainingSems[0] : 1;

        // If no semesters left (rare edge case), re-init seme 1
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
}

export const store = new Store();
