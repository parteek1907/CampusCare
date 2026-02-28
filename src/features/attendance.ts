import { store } from '../store';
import { $ } from '../utils';
import { Modal } from '../ui/modal';
import { AbsenceModal } from '../ui/absence-modal';
import { calculateSubjectAttendance } from './stats';



// Helper to get local YYYY-MM-DD
function toDateStr(d: Date) {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60000));
    return local.toISOString().split('T')[0];
}

export function renderAttendance(container: HTMLElement) {
    const data = store.getData();
    if (!data) return;

    // Semester Limits
    const minDate = new Date(data.semesterConfig.startDate);
    const maxDate = new Date(data.semesterConfig.endDate);

    // State
    let cursorDate = new Date(); // Viewing month
    if (cursorDate < minDate) cursorDate = new Date(minDate);
    if (cursorDate > maxDate) cursorDate = new Date(maxDate);

    let selectedDates: string[] = [toDateStr(new Date())]; // Default today
    if (selectedDates[0] < data.semesterConfig.startDate) selectedDates = [data.semesterConfig.startDate];

    let isBulkMode = false;

    // What-If Simulation State
    let isWhatIfMode = false;
    let simulatedAttendance: any = null;
    let simulatedHolidays: string[] = [];

    // --- Main Layout (Preserved) ---
    // --- Main Layout ---
    container.innerHTML = `
        <!-- Prominent What-If Simulation Panel (Hidden by default) -->
        <div id="what-if-panel" class="what-if-panel hidden">
            <div style="display:flex; align-items:center; gap:1rem;">
                <div style="font-size:2rem;">🔮</div>
                <div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                        <h2 style="color:white; margin:0; font-size:1.5rem;">What-If Simulation</h2>
                        <span class="what-if-tag">Planning Only</span>
                    </div>
                    <div style="color: #c7d2fe; font-size: 0.95rem;">
                        Experiment with future attendance. <strong style="color:white;">Changes are NOT saved.</strong>
                    </div>
                </div>
            </div>
            <button id="exit-whatif-btn" class="btn" style="background:white; color:#312e81; border:none; font-weight:700; padding:0.75rem 2rem;">
                Exit Simulation
            </button>
        </div>

        <header class="section-header" id="main-header">
            <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem;">
                <div>
                    <h1>Attendance Tracker</h1>
                    <p>Mark attendance daily. Linked strictly to your timetable.</p>
                </div>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button id="what-if-btn" class="btn btn-secondary" style="display:flex; align-items:center; gap:6px;">
                        <span>🔮</span> What If
                    </button>
                    <button id="manage-holidays-btn" class="btn btn-secondary">
                        📅 Holidays
                    </button>
                </div>
            </div>
        </header>
        
        <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:1.5rem; align-items:start;">
            <!-- Left Column: Calendar -->
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                <div class="card" style="padding:0; overflow:hidden;">
                    <div style="padding:1.5rem; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                        <div class="flex-between">
                            <h3 id="cal-title" style="margin:0; font-size:1.4rem;">Month</h3>
                            <div style="display:flex; gap:10px;">
                                <button class="btn btn-secondary btn-small" id="toggle-bulk">Select Multiple</button>
                                <div style="display:flex; gap:5px;">
                                    <button class="btn btn-secondary btn-small" id="prev-m">&lt;</button>
                                    <button class="btn btn-secondary btn-small" id="next-m">&gt;</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="calendar-grid" id="cal-grid" style="padding:1.5rem; min-height:400px;"></div>
                </div>
                
                <!-- Impact Preview (Always visible in What-If Mode) -->
                <div id="impact-preview" class="card hidden" style="border:2px solid #6366f1;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                        <h3 style="color:#4f46e5; margin:0;">📊 Simulation Impact</h3>
                        <span style="font-size:0.8rem; color:#6b7280;">Real-time updates</span>
                    </div>
                    <div id="impact-content" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:1rem;"></div>
                </div>
            </div>

            <!-- Right Column: Daily Details -->
            <div class="card" id="daily-panel" style="min-height:500px; padding:1.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid #e2e8f0; padding-bottom:1rem;">
                    <h3 id="panel-date" style="margin:0; font-size:1.2rem;">Date</h3>
                    <div id="bulk-actions" style="display:none; gap:10px;">
                         <!-- Injected dynamically -->
                    </div>
                </div>
                <!-- Controls for Full Day -->
                <div id="day-controls" style="display:none; gap:8px; margin-bottom:1.5rem; flex-wrap:wrap;">
                    <button class="btn-small btn-secondary" style="color:#10b981; border-color:#10b981;" id="mark-day-p">Mark All Present</button>
                    <button class="btn-small btn-secondary" style="color:#ef4444; border-color:#ef4444;" id="mark-day-a">Mark All Absent</button>
                    <button class="btn-small btn-secondary" style="color:#f59e0b; border-color:#f59e0b;" id="mark-day-h">Set Holiday</button>
                </div>

                <div id="class-list-att" style="display:flex; flex-direction:column; gap:12px;"></div>
            </div>
        </div>
        
        <!-- Holidays Modal (Same as before) -->
        <div id="hol-modal" class="modal-backdrop hidden">
            <div class="modal-content" style="max-width:500px; width:95%; text-align:left;">
                <h3 style="margin-bottom:1rem;">Semester Holidays</h3>
                <p style="color:var(--color-text-muted); font-size:0.9rem; margin-bottom:1.5rem;">Mark dates where no classes are held. Attendance will be excluded.</p>
                
                <div style="display:flex; gap:10px; margin-bottom:1.5rem;">
                    <input type="text" id="new-hol-date" placeholder="Select Date" style="flex:1; padding:0.6rem; border:1px solid #cbd5e1; border-radius:8px;">
                    <button id="add-hol-btn" class="btn btn-secondary">Add</button>
                </div>

                <div id="hol-list" style="display:flex; flex-wrap:wrap; gap:8px; max-height:200px; overflow-y:auto; margin-bottom:1.5rem;"></div>

                <div style="text-align:right;">
                    <button id="close-hol-btn" class="btn">Done</button>
                </div>
            </div>
        </div>
        
        <!-- Extra Class Modal (Same as before) -->
        <div id="extra-class-modal" class="modal-backdrop hidden">
            <div class="modal-content" style="max-width:500px; width:95%; text-align:left;">
                <h3 style="margin-bottom:1rem;">Add Extra Class</h3>
                <p style="color:var(--color-text-muted); font-size:0.9rem; margin-bottom:1.5rem;">Record makeup classes, special lectures, or extra labs.</p>
                
                <div style="margin-bottom:1rem;">
                    <label style="display:block; font-weight:600; margin-bottom:0.5rem;">Subject</label>
                    <select id="extra-subject" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:8px;">
                        <option value="">-- Select Subject --</option>
                        ${data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>

                <div style="margin-bottom:1rem;">
                    <label style="display:block; font-weight:600; margin-bottom:0.5rem;">Class Type</label>
                    <select id="extra-type" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:8px;">
                        <option value="Lecture">Lecture (1hr)</option>
                        <option value="Tutorial">Tutorial (1hr)</option>
                        <option value="Lab">Lab (2hrs)</option>
                    </select>
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block; font-weight:600; margin-bottom:0.5rem;">Start Time</label>
                    <input type="time" id="extra-start" value="09:00" style="width:100%; padding:0.6rem; border:1px solid #cbd5e1; border-radius:8px;">
                </div>

                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="cancel-extra-btn" class="btn btn-secondary">Cancel</button>
                    <button id="save-extra-btn" class="btn">Add Class</button>
                </div>
            </div>
        </div>
    `;

    // --- Logic ---

    // --- Logic ---

    const getActiveAttendance = () => {
        if (isWhatIfMode) return simulatedAttendance;
        const d = store.getData();
        return d?.attendance || {};
    };

    const getActiveHolidays = () => {
        if (isWhatIfMode) return simulatedHolidays;
        const d = store.getData();
        return d?.holidays || [];
    };

    const getActiveReasons = () => {
        if (isWhatIfMode) return {}; // No reasons in simulation for now
        const d = store.getData();
        return d?.attendanceReasons || {};
    };

    const renderCal = () => {
        const grid = $('#cal-grid');
        grid.innerHTML = '';
        const m = cursorDate.getMonth();
        const y = cursorDate.getFullYear();
        $('#cal-title').textContent = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const daysInMonth = new Date(y, m + 1, 0).getDate();
        const startDay = new Date(y, m, 1).getDay(); // 0 Sun

        // Headers
        ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
            const h = document.createElement('div');
            h.textContent = d;
            h.style.textAlign = 'center';
            h.style.fontSize = '1.1rem';
            h.style.color = '#94a3b8';
            h.style.fontWeight = '700';
            grid.appendChild(h);
        });

        for (let i = 0; i < startDay; i++) grid.appendChild(document.createElement('div'));

        const activeAtt = getActiveAttendance();
        const activeHols = getActiveHolidays();

        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(y, m, i);
            const dStr = toDateStr(d);
            const cell = document.createElement('div');
            cell.className = 'cal-day';
            cell.textContent = i.toString();
            cell.style.fontSize = '1.2rem';
            cell.style.height = '64px';

            // Check Validity (String comparison safely ignores time components)
            const isValid = dStr >= data.semesterConfig.startDate && dStr <= data.semesterConfig.endDate;
            const isHoliday = activeHols.includes(dStr);
            const isSelected = selectedDates.includes(dStr);

            if (!isValid) {
                cell.style.opacity = '0.3';
                cell.style.cursor = 'not-allowed';
                cell.style.background = '#f1f5f9';
            } else {
                cell.style.cursor = 'pointer';
                if (isHoliday) {
                    cell.style.background = '#fffbeb'; // Light Amber
                    cell.title = "Holiday";
                }
                if (isSelected) {
                    cell.style.background = isWhatIfMode ? '#a78bfa' : 'var(--color-primary)';
                    cell.style.color = 'white';
                    cell.style.borderRadius = '8px';
                }
            }

            // Dots (only if not holiday and valid)
            if (isValid && !isHoliday && activeAtt?.[dStr]) {
                const statuses = Object.values(activeAtt[dStr]);
                if (statuses.includes('absent')) {
                    const dot = document.createElement('div'); dot.className = 'cal-dot dot-absent'; cell.appendChild(dot);
                } else if (statuses.length > 0) {
                    const dot = document.createElement('div'); dot.className = 'cal-dot dot-present'; cell.appendChild(dot);
                }
            }

            cell.onclick = () => {
                if (!isValid) return;

                if (isBulkMode) {
                    if (selectedDates.includes(dStr)) {
                        selectedDates = selectedDates.filter(s => s !== dStr);
                    } else {
                        selectedDates.push(dStr);
                    }
                } else {
                    selectedDates = [dStr];
                }
                renderCal();
                renderPanel();
            };
            grid.appendChild(cell);
        }
    };

    const renderPanel = () => {
        const list = $('#class-list-att');
        const dayControls = $('#day-controls');

        // Ensure simulation mode class is syncced
        if (isWhatIfMode) $('#daily-panel').classList.add('simulation-mode');
        else $('#daily-panel').classList.remove('simulation-mode');

        list.innerHTML = '';
        dayControls.style.display = 'none';

        if (selectedDates.length === 0) {
            $('#panel-date').textContent = 'No date selected';
            list.innerHTML = '<p style="color:#94a3b8; text-align:center;">Select dates to view.</p>';
            return;
        }

        const activeAtt = getActiveAttendance();
        const activeHols = getActiveHolidays();
        const currentData = store.getData(); // Fresh data for timetable/extra classes

        // 1. Bulk Mode Logic
        if (selectedDates.length > 1) {
            $('#panel-date').textContent = `${selectedDates.length} Days Selected`;
            dayControls.style.display = 'flex'; // Use same controls for bulk

            list.innerHTML = `
                <div style="background:#eff6ff; padding:1.5rem; border-radius:12px; border:1px solid #bfdbfe;">
                    <h4 style="margin-bottom:0.5rem; color:#1e40af;">Bulk Action Mode</h4>
                    <p style="font-size:0.9rem; color:#60a5fa;">Applying an action will update all subjects for all ${selectedDates.length} selected days.</p>
                    <ul style="margin-top:1rem; padding-left:1.2rem; gap:4px; display:grid; font-size:0.9rem; color:#64748b;">
                        ${selectedDates.slice(0, 5).map(d => `<li>${new Date(d).toLocaleDateString()}</li>`).join('')}
                        ${selectedDates.length > 5 ? `<li>...and ${selectedDates.length - 5} more</li>` : ''}
                    </ul>
                </div>
            `;
            return; // Stop here for bulk
        }

        // 2. Single Day Logic
        const dStr = selectedDates[0];
        const dateObj = new Date(dStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const activeReasons = getActiveReasons();

        $('#panel-date').textContent = `${dayName}, ${dateObj.toLocaleDateString()}`;
        dayControls.style.display = 'flex';

        // Holiday Check
        if (activeHols.includes(dStr)) {
            list.innerHTML = `
                <div style="text-align:center; padding:2rem; background:#fffbeb; border-radius:12px; border:1px solid #fcd34d;">
                    <span style="font-size:2rem;">🎉</span>
                    <h3 style="margin:1rem 0; color:#b45309;">Holiday</h3>
                    <p style="color:#78350f;">No attendance required.</p>
                    <button id="remove-hol-btn" class="btn btn-secondary btn-small" style="margin-top:1rem;">Remove Holiday</button>
                </div>
            `;
            $('#remove-hol-btn').addEventListener('click', () => toggleHoliday(false, [dStr]));
            dayControls.style.display = 'none'; // Hide mark controls
            return;
        }

        // Classes (Regular + Extra)
        const schedule = currentData?.timetable[dayName] || [];
        const extraClasses = (currentData?.extraClasses?.[dStr] || []);
        const hasClasses = schedule.length > 0 || extraClasses.length > 0;

        if (!hasClasses) {
            list.innerHTML = `
                <p style="color:#94a3b8; text-align:center; padding:1rem;">No classes scheduled.</p>
                <button id="add-extra-class-btn" class="btn btn-secondary" style="width:100%; margin-top:1rem;">
                    + Add Extra Class
                </button>
            `;
            $('#add-extra-class-btn').addEventListener('click', () => showExtraClassModal(dStr));
            dayControls.style.display = 'none';
            return;
        }

        // Add Extra Class button at top
        const addBtn = document.createElement('button');
        addBtn.id = 'add-extra-class-btn';
        addBtn.className = 'btn btn-secondary btn-small';
        addBtn.textContent = '+ Add Extra Class';
        addBtn.style.width = '100%';
        addBtn.style.marginBottom = '1rem';
        addBtn.addEventListener('click', () => showExtraClassModal(dStr));
        list.appendChild(addBtn);

        // Render regular timetable classes
        schedule.forEach((entry: any) => {
            const status = activeAtt[dStr]?.[entry.subjectId] || undefined;
            const reason = activeReasons[dStr]?.[entry.subjectId];
            const row = createClassCard(entry, status, dStr, false, undefined, reason);
            list.appendChild(row);
        });

        // Render extra classes
        extraClasses.forEach((extraClass: any, idx: number) => {
            const subject = currentData!.subjects.find(s => s.id === extraClass.subjectId);
            if (!subject) return;

            const entry = {
                subjectId: extraClass.subjectId,
                subjectName: subject.name,
                type: extraClass.type,
                startTime: '—',
                endTime: '—'
            };

            const reason = extraClass.absenceReason;
            const row = createClassCard(entry, extraClass.status, dStr, true, idx, reason);
            list.appendChild(row);
        });
    };

    // Helper to create class card
    const createClassCard = (entry: any, status: any, dStr: string, isExtra: boolean, extraIdx?: number, reason?: string) => {
        const row = document.createElement('div');

        row.className = `card-row ${status ? 'status-' + status : ''}`;
        row.style.border = '1px solid #e2e8f0';
        row.style.borderRadius = '8px';
        row.style.padding = '12px';
        row.style.position = 'relative';

        // Status BG
        if (status === 'present') row.style.background = '#f0fdf4';
        else if (status === 'absent') row.style.background = '#fef2f2';
        else if (status === 'present_half') row.style.background = '#eff6ff';
        else if (status === 'class_cancelled') row.style.background = '#f1f5f9';
        else row.style.background = 'white';

        // Determine which buttons to show based on class type
        const showHalf = entry.type === 'Lab' || entry.type === 'Tutorial';

        const btnClass = isWhatIfMode ? 'att-btn sim-btn' : 'att-btn';

        row.innerHTML = `
            <div class="flex-between" style="margin-bottom:10px;">
                <div>
                    <div style="font-weight:600; color:#334155;">
                        ${entry.subjectName}
                        ${isExtra ? '<span style="background:#f59e0b; color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px; margin-left:6px;">EXTRA</span>' : ''}
                    </div>
                    <div style="font-size:0.8rem; color:#64748b;">${entry.type}${!isExtra ? ` • ${entry.startTime}-${entry.endTime}` : ''}</div>
                    ${status === 'absent' && reason ? `<div style="font-size:0.8rem; color:#ef4444; margin-top:4px; font-weight:500;">Reason: ${reason}</div>` : ''}
                </div>
                ${isExtra ? '<button class="delete-extra-btn" style="position:absolute; top:8px; right:8px; background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;">&times;</button>' : ''}
            </div>
             <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="${btnClass} ${status === 'present' ? 'active-present' : ''}" data-act="present">Present</button>
                ${showHalf ? `<button class="${btnClass} ${status === 'present_half' ? 'active-half' : ''}" data-act="present_half">Half</button>` : ''}
                <button class="${btnClass} ${status === 'absent' ? 'active-absent' : ''}" data-act="absent">Absent</button>
                <button class="${btnClass} ${status === 'class_cancelled' ? 'active-null' : ''}" data-act="class_cancelled">Not Held</button>
            </div>
        `;

        row.querySelectorAll('.att-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-act') as any;
                if (isExtra && extraIdx !== undefined) {
                    markExtraClass(dStr, extraIdx, action);
                } else {
                    markSingle(dStr, entry.subjectId, action);
                }
            });
        });

        if (isExtra && extraIdx !== undefined) {
            row.querySelector('.delete-extra-btn')?.addEventListener('click', () => deleteExtraClass(dStr, extraIdx));
        }

        return row;
    };

    // --- Actions ---

    // 1. Mark Single Class (Toggle Logic)
    const markSingle = async (date: string, subId: number, status: string) => {
        const d = store.getData();
        const target = isWhatIfMode ? simulatedAttendance : (d?.attendance || {});
        const reasons = isWhatIfMode ? {} : (d?.attendanceReasons || {});

        if (!target[date]) target[date] = {};
        if (!reasons[date]) reasons[date] = {};

        // Toggle Logic: If clicking same status, undo (delete). Else set.
        if (target[date][subId] === status) {
            delete target[date][subId];
            if (reasons[date]?.[subId]) delete reasons[date][subId];
            // Cleanup empty object if needed, but not strictly necessary for logic
            if (Object.keys(target[date]).length === 0) delete target[date];
        } else {
            // New Status
            if (status === 'absent') {
                const reason = await AbsenceModal.ask();
                if (!reason) return; // Cancelled
                reasons[date][subId] = reason;
            } else {
                // If switching from absent to present, remove reason
                if (reasons[date]?.[subId]) delete reasons[date][subId];
            }
            target[date][subId] = status as any;
        }

        if (!isWhatIfMode) {
            store.updateUserData({ attendance: target, attendanceReasons: reasons });
        }

        renderCal();
        renderPanel();
        if (isWhatIfMode) updateImpactPreview();
    };

    // 2. Bulk/Day Actions (Toggle Logic)
    const applyBulk = async (status: 'present' | 'absent' | 'class_cancelled' | 'holiday') => {
        if (status === 'holiday') {
            await toggleHoliday(true, selectedDates);
            return;
        }

        let reason: string | null = null;
        if (status === 'absent') {
            reason = await AbsenceModal.ask();
            if (!reason) return; // Cancelled
        }

        const d = store.getData();
        const target = isWhatIfMode ? simulatedAttendance : (d?.attendance || {});
        const reasons = isWhatIfMode ? {} : (d?.attendanceReasons || {});

        // Check if we should Toggle OFF (Undo) or ON (Set)
        // Rule: If ALL eligible classes in the selection ALREADY have this status, we Toggle OFF (Clear).
        // Otherwise, we Set All to this status.

        let allAlreadySet = true;
        let hasEligible = false;

        // Scan Pass
        // We need to iterate exactly as we would for setting to check 'allAlreadySet'
        for (const dStr of selectedDates) {
            const activeHols = getActiveHolidays();
            if (activeHols.includes(dStr)) continue;

            const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'long' });
            const schedule = d?.timetable[dayName] || [];

            if (schedule.length > 0) {
                hasEligible = true;
                for (const entry of schedule) {
                    if (target[dStr]?.[entry.subjectId] !== status) {
                        allAlreadySet = false;
                        break;
                    }
                }
            }
            if (!allAlreadySet) break;
        }

        // Action Pass
        if (hasEligible) {
            selectedDates.forEach(dStr => {
                const activeHols = getActiveHolidays();
                if (activeHols.includes(dStr)) return;

                const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'long' });
                const schedule = d?.timetable[dayName] || [];

                if (schedule.length > 0) {
                    if (!target[dStr]) target[dStr] = {};
                    if (!reasons[dStr]) reasons[dStr] = {};

                    schedule.forEach((entry: any) => {
                        if (allAlreadySet) {
                            // Toggle Off / Undo
                            delete target[dStr][entry.subjectId];
                            if (reasons[dStr]?.[entry.subjectId]) delete reasons[dStr][entry.subjectId];
                        } else {
                            // Set New
                            target[dStr][entry.subjectId] = status as any;
                            if (status === 'absent' && reason) {
                                reasons[dStr][entry.subjectId] = reason;
                            } else {
                                if (reasons[dStr]?.[entry.subjectId]) delete reasons[dStr][entry.subjectId];
                            }
                        }
                    });

                    // Cleanup
                    if (target[dStr] && Object.keys(target[dStr]).length === 0) delete target[dStr];
                }
            });

            if (!isWhatIfMode) {
                store.updateUserData({ attendance: target, attendanceReasons: reasons });
            }

            renderCal();
            renderPanel();
            if (isWhatIfMode) updateImpactPreview();
        }
    };

    const toggleHoliday = async (set: boolean, dates: string[]) => {
        const target = getActiveHolidays();
        let updated: string[];

        if (set) {
            updated = [...new Set([...target, ...dates])]; // Merge unique
        } else {
            updated = target.filter(d => !dates.includes(d));
        }

        if (isWhatIfMode) {
            simulatedHolidays = updated;
        } else {
            store.updateUserData({ holidays: updated });
        }

        renderCal();
        renderPanel();
        if (isWhatIfMode) updateImpactPreview();
    };

    // Extra Class Management
    const showExtraClassModal = (dateStr: string) => {
        const modal = $('#extra-class-modal');
        modal.classList.remove('hidden');

        // Store current date for modal
        (modal as any)._currentDate = dateStr;
    };

    const markExtraClass = async (date: string, idx: number, status: string) => {
        const d = store.getData();
        const extras = d?.extraClasses || {};

        if (!extras[date]) extras[date] = [];
        if (extras[date][idx]) {
            // Toggle Logic
            if (extras[date][idx].status === status) {
                delete (extras[date][idx] as any).status;
                delete extras[date][idx].absenceReason;
            } else {
                if (status === 'absent') {
                    const reason = await AbsenceModal.ask();
                    if (!reason) return;
                    extras[date][idx].absenceReason = reason;
                } else {
                    delete extras[date][idx].absenceReason;
                }
                extras[date][idx].status = status as any;
            }

            store.updateUserData({ extraClasses: extras });
            renderPanel();
        }
    };

    const deleteExtraClass = async (date: string, idx: number) => {
        const confirm = await Modal.confirm('Delete this extra class?', 'Confirm Deletion', true);
        if (confirm) {
            const d = store.getData();
            const extras = d?.extraClasses || {};

            if (extras[date]) {
                extras[date].splice(idx, 1);
                if (extras[date].length === 0) {
                    delete extras[date];
                }
                store.updateUserData({ extraClasses: extras });
                renderPanel();
            }
        }
    };

    const updateImpactPreview = () => {
        const preview = $('#impact-content');
        if (!isWhatIfMode) return;

        const d = store.getData();
        if (!d) return;

        let html = '';
        const subjects = d.subjects;

        subjects.forEach(sub => {
            // Construct simulated data object for calculation
            const simData = {
                ...d,
                attendance: simulatedAttendance,
                holidays: simulatedHolidays
                // extraClasses are not simulated yet, using actual data
            };

            const current = calculateSubjectAttendance(sub.id, d);
            const simulated = calculateSubjectAttendance(sub.id, simData);

            const currentPct = current.percentage;
            const simulatedPct = simulated.percentage;
            const diff = simulatedPct - currentPct;

            const isPositive = diff > 0;
            const isNegative = diff < 0;
            const diffColor = isPositive ? '#10b981' : (isNegative ? '#ef4444' : '#94a3b8');
            const impactClass = isPositive ? 'positive' : (isNegative ? 'negative' : '');
            const diffIcon = isPositive ? '↑' : (isNegative ? '↓' : '—');

            // Determine Risk
            const isSafe = simulatedPct >= d.semesterConfig.minAttendance;
            const riskBadge = isSafe
                ? `<span class="risk-badge risk-safe">SAFE</span>`
                : `<span class="risk-badge risk-danger">RISK</span>`;

            html += `
                <div class="impact-item ${impactClass}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                        <div style="font-weight:600; color:#1e293b; font-size:0.95rem;">${sub.name}</div>
                        ${riskBadge}
                    </div>
                    
                    <div style="display:flex; align-items:baseline; justify-content:space-between;">
                        <div style="font-size:1.5rem; font-weight:700; color:${diffColor};">
                            ${simulatedPct.toFixed(1)}%
                        </div>
                        <div style="font-size:0.85rem; color:${diffColor}; font-weight:600;">
                            ${diffIcon} ${Math.abs(diff).toFixed(1)}%
                        </div>
                    </div>
                </div>
            `;
        });

        preview.innerHTML = html || '<p style="color:#94a3b8; text-align:center;">No changes yet</p>';
    };

    // What-If Mode Toggle
    $('#what-if-btn').addEventListener('click', () => {
        if (isWhatIfMode) {
            // Already in mode? Do nothing or scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        isWhatIfMode = true;
        // Clone Data
        simulatedAttendance = JSON.parse(JSON.stringify(data.attendance));
        simulatedHolidays = [...(data.holidays || [])];

        // UI Updates
        $('#what-if-panel').classList.remove('hidden'); // Show new panel
        $('#impact-preview').classList.remove('hidden');
        $('#main-header').classList.add('hidden'); // Hide normal header
        $('#daily-panel').classList.add('simulation-mode'); // Add class for styling buttons

        updateImpactPreview();
        renderCal();
        renderPanel();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Exit What-If (Discard Only)
    $('#exit-whatif-btn').addEventListener('click', () => {
        isWhatIfMode = false;
        simulatedAttendance = null;
        simulatedHolidays = [];

        $('#what-if-panel').classList.add('hidden');
        $('#impact-preview').classList.add('hidden');
        $('#main-header').classList.remove('hidden');
        $('#daily-panel').classList.remove('simulation-mode');

        renderCal();
        renderPanel();
    });

    // Removed Apply/Discard listeners as requested

    // Holiday Modal Logic
    const hModal = $('#hol-modal');
    const hList = $('#hol-list');

    // Init DatePicker
    import('../datepicker').then(({ DatePicker }) => {
        new DatePicker('#new-hol-date');
    });

    const renderHols = () => {
        hList.innerHTML = '';
        const activeHols = getActiveHolidays();

        if (activeHols.length === 0) {
            hList.innerHTML = '<span style="color:#94a3b8; font-size:0.9rem;">No holidays added.</span>';
            return;
        }

        activeHols.sort().forEach(date => {
            const tag = document.createElement('div');
            tag.className = 'badge-pill';
            tag.style.margin = '0';
            tag.style.padding = '4px 10px';
            tag.style.fontSize = '0.85rem';
            tag.style.display = 'flex';
            tag.style.alignItems = 'center';
            tag.style.gap = '6px';
            tag.innerHTML = `
                ${new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                <span class="del-hol" style="cursor:pointer; opacity:0.6;">&times;</span>
            `;
            tag.querySelector('.del-hol')?.addEventListener('click', () => {
                toggleHoliday(false, [date]);
                renderHols();
            });
            hList.appendChild(tag);
        });
    };

    $('#manage-holidays-btn').addEventListener('click', () => {
        hModal.classList.remove('hidden');
        renderHols();
    });

    $('#close-hol-btn').addEventListener('click', () => hModal.classList.add('hidden'));

    $('#add-hol-btn').addEventListener('click', async () => {
        const dateInput = $('#new-hol-date') as HTMLInputElement;
        const val = dateInput.value;

        if (!val) return;

        const activeHols = getActiveHolidays();
        if (activeHols.includes(val)) {
            await Modal.alert("This date is already marked as a holiday.");
            return;
        }

        toggleHoliday(true, [val]);
        dateInput.value = '';
        renderHols();
    });

    // Extra Class Modal Logic
    const extraModal = $('#extra-class-modal');

    $('#cancel-extra-btn').addEventListener('click', async () => {
        // Confirmation if inputs are filled?
        // For simplicity and consistency:
        if (await Modal.confirm("Discard changes and close?", "Unsaved Changes")) {
            extraModal.classList.add('hidden');
        }
    });

    // Attach TimePicker to extra start
    $('#save-extra-btn').addEventListener('click', async () => {
        const subjectId = parseInt(($('#extra-subject') as HTMLSelectElement).value);
        const type = ($('#extra-type') as HTMLSelectElement).value as 'Theory' | 'Lab' | 'Tutorial';

        if (!subjectId) {
            await Modal.alert('Please select a subject.');
            return;
        }

        const dateStr = (extraModal as any)._currentDate;
        if (!dateStr) return;

        // Create extra class record
        const extraClass = {
            id: `extra-${Date.now()}`,
            subjectId,
            type,
            status: 'present' as any // Default to present
        };

        if (!data.extraClasses) data.extraClasses = {};
        if (!data.extraClasses[dateStr]) data.extraClasses[dateStr] = [];
        data.extraClasses[dateStr].push(extraClass);

        store.updateUserData({ extraClasses: data.extraClasses });

        extraModal.classList.add('hidden');
        renderPanel();
    });

    // Event Listeners
    $('#toggle-bulk').addEventListener('click', () => {
        isBulkMode = !isBulkMode;
        $('#toggle-bulk').style.background = isBulkMode ? 'var(--color-primary)' : '';
        $('#toggle-bulk').style.color = isBulkMode ? 'white' : '';
        $('#toggle-bulk').textContent = isBulkMode ? 'Done Selecting' : 'Select Multiple';
        if (!isBulkMode) selectedDates = [toDateStr(new Date())]; // Reset to single
        renderCal(); renderPanel();
    });

    $('#prev-m').addEventListener('click', () => { cursorDate.setMonth(cursorDate.getMonth() - 1); renderCal(); });
    $('#next-m').addEventListener('click', () => { cursorDate.setMonth(cursorDate.getMonth() + 1); renderCal(); });

    $('#mark-day-p').addEventListener('click', () => applyBulk('present'));
    $('#mark-day-a').addEventListener('click', () => applyBulk('absent'));
    $('#mark-day-h').addEventListener('click', () => applyBulk('holiday'));

    // Init
    renderCal();
    renderPanel();
}


// Styles
const style = document.createElement('style');
style.innerHTML = `
.att-btn {
    padding: 6px 12px;
    border: 1px solid #e2e8f0;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #64748b;
    transition: all 0.2s;
    flex: 1;
}
.att-btn:hover { background: #f1f5f9; }
.active-present { background: #10b981; color: white; border-color: #10b981; }
.active-present:hover { background: #059669; }

.active-half { background: #3b82f6; color: white; border-color: #3b82f6; }
.active-half:hover { background: #2563eb; }

.active-absent { background: #ef4444; color: white; border-color: #ef4444; }
.active-absent:hover { background: #dc2626; }

.active-null { background: #94a3b8; color: white; border-color: #94a3b8; }
.active-null:hover { background: #64748b; }
`;
document.head.appendChild(style);
