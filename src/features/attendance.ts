import { store } from '../store';
import { $ } from '../utils';
import { Modal } from '../ui/modal';
import { AbsenceModal } from '../ui/absence-modal';
import { getHours, getSubjectMetrics } from './stats';



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

    // 1. Target Attendance Logic
    const targetPercentage = data.semesterConfig.minAttendance;
    console.log('[What-If] Target attendance loaded:', targetPercentage);

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
                    <div style="color: rgba(255,255,255,0.7); font-size: 0.85rem; margin-top: 4px;">
                        Simulating against your target: ${targetPercentage}%
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
            
            ${(() => {
            const attData = isWhatIfMode ? simulatedAttendance : (data.attendance || {});
            const todayStr = toDateStr(new Date());

            // Parse and sort all recorded dates
            const allDates = Object.keys(attData).sort((a, b) => a.localeCompare(b));
            if (allDates.length === 0) {
                return `
                        <div style="display:flex; gap:12px; margin-top:1rem;">
                            <div style="background:#f3f4f6; border:1px solid #e5e7eb; color:#4b5563; border-radius:20px; padding:6px 14px; font-size:0.875rem; font-weight:600;">
                                🔥 No active streak — mark today's attendance!
                            </div>
                        </div>
                    `;
            }

            // 1. Calculate Current Streak (Backwards from today)
            let currentStreak = 0;
            let checkDate = new Date();

            const checkHasPresent = (dStr: string) => {
                const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'long' });
                const schedule = data.timetable || {};
                const slots = schedule[dayName] || [];
                const exClasses = Array.isArray(data.extraClasses) ? data.extraClasses : [];
                const extraClassesToday = exClasses.filter((e: any) => e.date === dStr);

                const dayRecord = attData[dStr] || {};

                const hasRegularPresent = slots.some((slot: any) => {
                    const slotId = slot.id || `slot_${slot.subjectId}_${slot.startTime.replace(':', '')}`;
                    const status = dayRecord[slotId];
                    return status === 'present' || status === 'present_half';
                });

                const hasExtraPresent = extraClassesToday.some((exc: any) => {
                    const status = exc.status || dayRecord[exc.subjectId];
                    return status === 'present' || status === 'present_half';
                });

                const hasClasses = slots.length > 0 || extraClassesToday.length > 0;

                return { hasPresent: hasRegularPresent || hasExtraPresent, hasClasses };
            };

            const activeHols = data.holidays || [];

            // Go backwards starting from today
            while (toDateStr(checkDate) >= data.semesterConfig.startDate) {
                const ds = toDateStr(checkDate);

                if (!activeHols.includes(ds)) {
                    const { hasPresent, hasClasses } = checkHasPresent(ds);

                    if (hasClasses) {
                        if (hasPresent) {
                            currentStreak++;
                        } else {
                            // Hit a day where classes exist but NO attendance was marked present -> break streak
                            break;
                        }
                    }
                }

                // Move back one day
                checkDate.setDate(checkDate.getDate() - 1);
            }

            // 2. Calculate Best Streak (Forward sweep)
            let bestStreak = 0;
            let tempStreak = 0;

            let ptrDate = new Date(data.semesterConfig.startDate);
            const endDate = new Date(todayStr < data.semesterConfig.endDate ? todayStr : data.semesterConfig.endDate);

            while (ptrDate <= endDate) {
                const ds = toDateStr(ptrDate);

                if (!activeHols.includes(ds)) {
                    const { hasPresent, hasClasses } = checkHasPresent(ds);

                    if (hasClasses) {
                        if (hasPresent) {
                            tempStreak++;
                            if (tempStreak > bestStreak) bestStreak = tempStreak;
                        } else {
                            tempStreak = 0; // Reset
                        }
                    }
                }

                ptrDate.setDate(ptrDate.getDate() + 1);
            }

            // Empty current streak handling
            if (currentStreak === 0) {
                return `
                        <div style="display:flex; gap:10px; margin-top:4px; margin-bottom:12px;">
                            <div style="background:#f3f4f6; border:1px solid #e5e7eb; color:#4b5563; border-radius:20px; padding:6px 14px; font-size:0.875rem; font-weight:600; height:32px; display:flex; align-items:center;">
                                🔥 No active streak — mark today's attendance!
                            </div>
                            <div style="background:#fff7ed; border:1px solid #fed7aa; color:#ea580c; border-radius:20px; padding:6px 14px; font-size:0.875rem; font-weight:600; height:32px; display:flex; align-items:center;">
                                ⭐ Best Streak: ${bestStreak} days
                            </div>
                        </div>
                    `;
            }

            return `
                    <div style="display:flex; gap:10px; margin-top:4px; margin-bottom:12px;">
                        <div style="background:#fff7ed; border:1px solid #fed7aa; color:#ea580c; border-radius:20px; padding:6px 14px; font-size:0.875rem; font-weight:600; height:32px; display:flex; align-items:center;">
                            🔥 Current Streak: ${currentStreak} days
                        </div>
                        <div style="background:#fff7ed; border:1px solid #fed7aa; color:#ea580c; border-radius:20px; padding:6px 14px; font-size:0.875rem; font-weight:600; height:32px; display:flex; align-items:center;">
                            ⭐ Best Streak: ${bestStreak} days
                        </div>
                    </div>
                `;
        })()}
        </header>
        
        <div style="display:grid; grid-template-columns: 1.6fr 1fr; gap:1.5rem; align-items:start;">
            <!-- Left Column: Calendar -->
            <div style="display:flex; flex-direction:column; gap:1.5rem;">
                ${Object.keys(data.attendance || {}).length === 0 ? `
                    <div style="background:#f8fafc; border:1px dashed #cbd5e1; color:#64748b; padding:16px; border-radius:8px; text-align:center; font-weight:500; font-size:0.95rem;">
                        📅 No attendance marked yet. Click a date to start!
                    </div>
                ` : ''}
                <div class="card" style="overflow:hidden; display:flex; flex-direction:column; gap:16px;">
                    <div style="padding:0; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
                        <div class="flex-between" style="display:flex; align-items:center; gap:8px;">
                            <h3 id="cal-title" style="margin:0; font-size:1.4rem; flex:1;">Month</h3>
                            <div style="display:flex; gap:8px; align-items:center;">
                                <style>
                                    .cal-toolbar-btn {
                                        height: 34px;
                                        border-radius: 8px;
                                        font-size: 0.875rem;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        cursor: pointer;
                                    }
                                    #today-btn {
                                        border: 1.5px solid #2563eb;
                                        color: #2563eb;
                                        background: transparent;
                                        padding: 0 16px;
                                        font-weight: 500;
                                    }
                                    #today-btn:hover:not(:disabled) {
                                        background: #eff6ff;
                                    }
                                    #toggle-bulk {
                                        border: 1.5px solid #6b7280;
                                        color: #374151;
                                        background: transparent;
                                        padding: 0 16px;
                                        font-weight: 500;
                                        transition: all 0.2s ease;
                                    }
                                    #toggle-bulk.active {
                                        background: #eff6ff;
                                        border-color: #2563eb;
                                        color: #2563eb;
                                    }
                                    .cal-nav-btn {
                                        background: white;
                                        border: 1px solid #e5e7eb;
                                        width: 34px;
                                        height: 34px;
                                        border-radius: 8px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        cursor: pointer;
                                        color: #4b5563;
                                    }
                                    .cal-nav-btn:hover {
                                        background: #f9fafb;
                                    }
                                </style>
                                <button id="today-btn" class="cal-toolbar-btn">Today</button>
                                <button id="toggle-bulk" class="cal-toolbar-btn">Select Multiple</button>
                                <div style="display:flex; gap:8px;">
                                    <button class="cal-nav-btn" id="prev-m">&lt;</button>
                                    <button class="cal-nav-btn" id="next-m">&gt;</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="calendar-grid" id="cal-grid" style="min-height:400px;"></div>
                </div>
                
                <!-- Monthly Summary Bar -->
                <div id="cal-summary-bar" style="background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:20px; font-size:0.875rem; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 1px 3px rgba(0,0,0,0.06);"></div>
                
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
            <div class="card" id="daily-panel" style="min-height:500px;">
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
        
        <!-- Bulk actions now in right panel -->
    `;

    // --- Toast Logic ---
    const showToast = (message: string, color: string = '#1e293b') => {
        let toast = document.getElementById('att-toast');

        // Add animation keyframes if not exists
        if (!document.getElementById('att-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'att-toast-styles';
            style.innerHTML = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'att-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.right = '24px';
            toast.style.color = 'white';
            toast.style.padding = '10px 18px';
            toast.style.borderRadius = '8px';
            toast.style.fontSize = '0.875rem';
            toast.style.zIndex = '9999';
            toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }

        toast.style.background = color;
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.display = 'block';
        toast.style.animation = 'slideInRight 0.2s ease forwards';

        if ((toast as any)._timeout) clearTimeout((toast as any)._timeout);
        (toast as any)._timeout = setTimeout(() => {
            toast!.style.opacity = '0';
            setTimeout(() => toast!.style.display = 'none', 300);
        }, 2500);
    };

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

        let tooltip = document.getElementById('cal-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'cal-tooltip';
            tooltip.style.position = 'fixed';
            tooltip.style.zIndex = '9999';
            tooltip.style.background = '#1e293b';
            tooltip.style.color = 'white';
            tooltip.style.borderRadius = '8px';
            tooltip.style.padding = '10px 14px';
            tooltip.style.fontSize = '0.8rem';
            tooltip.style.minWidth = '160px';
            tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            tooltip.style.pointerEvents = 'none';
            tooltip.style.display = 'none';
            document.body.appendChild(tooltip);
        }

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

            // Highlighting Today
            if (dStr === toDateStr(new Date())) {
                cell.style.outline = '2.5px solid #2563eb';
                cell.style.outlineOffset = '-2px';
                cell.style.borderRadius = '10px';
                cell.style.position = 'relative';

                const todayLabel = document.createElement('div');
                todayLabel.textContent = 'Today';
                todayLabel.style.fontSize = '0.6rem';
                todayLabel.style.color = '#2563eb';
                todayLabel.style.position = 'absolute';
                todayLabel.style.bottom = '4px';
                todayLabel.style.left = '50%';
                todayLabel.style.transform = 'translateX(-50%)';
                todayLabel.style.fontWeight = 'bold';
                cell.appendChild(todayLabel);
            }

            // Dots and Tooltip (for all valid, non-holiday dates)
            if (isValid && !isHoliday) {
                // Determine health logic across all scheduled classes
                const schedule = data.timetable || {};
                const checkDateObj = new Date(dStr);
                const dayName = checkDateObj.toLocaleDateString('en-US', { weekday: 'long' });

                const slotsOnDay = schedule[dayName] || [];
                const exClasses = Array.isArray(data.extraClasses) ? data.extraClasses : [];
                const extraClassesToday = exClasses.filter((e: any) => e.date === dStr);

                const hasClassesToday = slotsOnDay.length > 0 || extraClassesToday.length > 0;

                if (hasClassesToday) {
                    let presentCount = 0;
                    let absentCount = 0;
                    let cancelledCount = 0;
                    let unmarkedCount = 0;
                    let totalClassesCount = 0;

                    const activeAtt = getActiveAttendance();

                    // Count regular slots
                    slotsOnDay.forEach((slot: any) => {
                        totalClassesCount++;
                        const slotId = slot.id || `slot_${slot.subjectId}_${slot.startTime.replace(':', '')}`;
                        const status = activeAtt?.[dStr]?.[slotId] || null;

                        if (status === 'present' || status === 'present_half' || status === 'excused') presentCount++;
                        else if (status === 'absent') absentCount++;
                        else if (status === 'class_cancelled') cancelledCount++;
                        else unmarkedCount++;
                    });

                    // Count extra classes
                    extraClassesToday.forEach((exc: any) => {
                        totalClassesCount++;
                        const status = exc.status || activeAtt?.[dStr]?.[exc.subjectId] || null;

                        if (status === 'present' || status === 'present_half' || status === 'excused') presentCount++;
                        else if (status === 'absent') absentCount++;
                        else if (status === 'class_cancelled') cancelledCount++;
                        else unmarkedCount++;
                    });

                    if (totalClassesCount > 0) {
                        const dot = document.createElement('div');
                        dot.style.width = '6px';
                        dot.style.height = '6px';
                        dot.style.borderRadius = '50%';
                        dot.style.margin = '2px auto 0 auto';
                        dot.style.display = 'block';

                        let dotColor = '';
                        const allCancelled = cancelledCount === totalClassesCount && totalClassesCount > 0;
                        const anyAbsent = absentCount > 0;
                        const somePresent = presentCount > 0;
                        const allPresent = presentCount === (totalClassesCount - cancelledCount) && presentCount > 0;

                        if (allCancelled) {
                            dotColor = '#9ca3af'; // gray
                        } else if (allPresent) {
                            dotColor = '#16a34a'; // green
                        } else if (anyAbsent && somePresent) {
                            dotColor = '#f97316'; // orange
                        } else if (anyAbsent && !somePresent) {
                            dotColor = '#dc2626'; // red
                        } else if (unmarkedCount > 0) {
                            dotColor = '#3b82f6'; // blue
                        } else {
                            dotColor = '#3b82f6'; // fallback
                        }

                        if (dotColor) {
                            dot.style.background = dotColor;
                            cell.appendChild(dot);
                        }
                    }
                }

                // --- Tooltip Logic (works for ALL valid dates) ---
                cell.addEventListener('mouseenter', () => {
                    const allSubjects = data.subjects || [];
                    const schedule = data.timetable || {};
                    const checkDateObj = new Date(dStr);
                    const dayName = checkDateObj.toLocaleDateString('en-US', { weekday: 'long' });

                    const slotsOnDay = schedule[dayName] || [];
                    const exClasses = Array.isArray(data.extraClasses) ? data.extraClasses : [];
                    const extraClassesToday = exClasses.filter((ev: any) => ev.date === dStr);

                    let tooltipHTML = `<div style="font-weight:600; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:6px;">${checkDateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}</div>`;

                    if (slotsOnDay.length === 0 && extraClassesToday.length === 0) {
                        tooltipHTML += `<div style="color:#94a3b8; font-style:italic;">No classes scheduled</div>`;
                    } else {
                        const activeAtt = getActiveAttendance();

                        // Render regular slots
                        slotsOnDay.forEach((slot: any) => {
                            const subj = allSubjects.find((s: any) => s.name === slot.subjectName || s.id === slot.subjectId);
                            if (!subj) return;

                            const slotId = slot.id || `slot_${slot.subjectId}_${slot.startTime.replace(':', '')}`;
                            const status = activeAtt?.[dStr]?.[slotId] ?? activeAtt?.[dStr]?.[subj.id] ?? activeAtt?.[dStr]?.[String(subj.id)] ?? null;

                            const timeStr = `${slot.startTime || ''}–${slot.endTime || ''}`;
                            const hoursStr = getHours(slot.type) === 2 ? '2hrs' : '1hr';
                            const metaStr = timeStr && hoursStr ? ` <span style="opacity:0.6; font-size:0.7rem;">${timeStr} · ${hoursStr}</span>` : '';

                            let statusIcon = "—";
                            let statusText = "Not marked";
                            let sColor = "rgba(255,255,255,0.5)";

                            if (status === 'present') { statusIcon = "✅"; statusText = "Present"; sColor = "#86efac"; }
                            else if (status === 'absent') { statusIcon = "❌"; statusText = "Absent"; sColor = "#fca5a5"; }
                            else if (status === 'present_half') { statusIcon = "🌓"; statusText = "Half Day"; sColor = "#fde68a"; }
                            else if (status === 'class_cancelled') { statusIcon = "🚫"; statusText = "Cancelled"; sColor = "#d1d5db"; }
                            else if (status === 'excused') { statusIcon = "📝"; statusText = "Excused"; sColor = "#60a5fa"; }

                            tooltipHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; align-items:center; gap:12px;">
                                <span style="font-size:0.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="${subj.name}">${subj.name}${metaStr}</span>
                                <span style="font-size:0.75rem; color:${sColor}; white-space:nowrap;">${statusIcon} ${statusText}</span>
                            </div>`;
                        });

                        // Render extra classes
                        extraClassesToday.forEach((exc: any) => {
                            const subj = allSubjects.find((s: any) => s.name === exc.subjectName || s.id === exc.subjectId);
                            if (!subj) return;

                            const status = (exc.status || activeAtt?.[dStr]?.[exc.subjectId]) ?? activeAtt?.[dStr]?.[subj.id] ?? activeAtt?.[dStr]?.[String(subj.id)] ?? null;

                            const metaStr = ` <span style="background:#f59e0b; color:white; font-size:0.65rem; padding:1px 4px; border-radius:3px; margin-left:4px;">EXTRA</span>`;

                            let statusIcon = "—";
                            let statusText = "Not marked";
                            let sColor = "rgba(255,255,255,0.5)";

                            if (status === 'present') { statusIcon = "✅"; statusText = "Present"; sColor = "#86efac"; }
                            else if (status === 'absent') { statusIcon = "❌"; statusText = "Absent"; sColor = "#fca5a5"; }
                            else if (status === 'present_half') { statusIcon = "🌓"; statusText = "Half Day"; sColor = "#fde68a"; }
                            else if (status === 'class_cancelled') { statusIcon = "🚫"; statusText = "Cancelled"; sColor = "#d1d5db"; }
                            else if (status === 'excused') { statusIcon = "📝"; statusText = "Excused"; sColor = "#60a5fa"; }

                            tooltipHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; align-items:center; gap:12px;">
                                <span style="font-size:0.78rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;" title="${subj.name}">${subj.name}${metaStr}</span>
                                <span style="font-size:0.75rem; color:${sColor}; white-space:nowrap;">${statusIcon} ${statusText}</span>
                            </div>`;
                        });
                    }

                    if (tooltip) {
                        tooltip.innerHTML = tooltipHTML;
                        tooltip.style.display = 'block';
                    }
                });

                cell.addEventListener('mousemove', (e) => {
                    if (tooltip) {
                        let left = e.clientX + 12;
                        let top = e.clientY + 12;

                        // Edge detection
                        const tooltipRect = tooltip.getBoundingClientRect();
                        if (left + tooltipRect.width > window.innerWidth) {
                            left = e.clientX - tooltipRect.width - 12;
                        }
                        if (top + tooltipRect.height > window.innerHeight) {
                            top = e.clientY - tooltipRect.height - 12;
                        }

                        tooltip.style.left = left + 'px';
                        tooltip.style.top = top + 'px';
                    }
                });

                cell.addEventListener('mouseleave', () => {
                    if (tooltip) {
                        tooltip.style.display = 'none';
                    }
                });
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

        // --- Monthly Summary Calculation ---
        let presentDays = 0;
        let absentDays = 0;
        let cancelledDays = 0;
        let monthTotalHours = 0;
        let monthPresentHours = 0;
        let daysWithClasses = 0;

        const schedule = data.timetable || {};
        const exClasses = Array.isArray(data.extraClasses) ? data.extraClasses : [];

        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(y, m, i);
            const dStr = toDateStr(d);

            if (dStr < data.semesterConfig.startDate || dStr > data.semesterConfig.endDate) continue;

            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
            const dayClassIds = (schedule[dayName] || []).map((entry: any) => entry.subjectId);
            const extraClassesToday = exClasses.filter((e: any) => e.date === dStr).map((e: any) => e.subjectId);
            const uniqueSubjectIdsToday = Array.from(new Set([...dayClassIds, ...extraClassesToday]));

            if (uniqueSubjectIdsToday.length === 0 || activeHols.includes(dStr)) continue;

            daysWithClasses++;

            const dayRecord = activeAtt?.[dStr] || {};

            let dayHasPresent = false;
            let dayHasAbsent = false;
            let allCancelled = true;
            let classFound = false;

            uniqueSubjectIdsToday.forEach((subjectId: number) => {
                const dayClasses = schedule[dayName] || [];
                // Check Regular Classes
                for (const cls of dayClasses as any[]) {
                    if (String(cls.subjectId) === String(subjectId)) {
                        classFound = true;
                        const hrs = getHours(cls.type);
                        const slotId = cls.id || `slot_${cls.subjectId}_${cls.startTime?.replace(':', '')}`;
                        const status = dayRecord[slotId] ?? dayRecord[cls.subjectId] ?? null;

                        if (status !== 'class_cancelled') {
                            allCancelled = false;
                            monthTotalHours += hrs;
                            if (status === 'present') {
                                monthPresentHours += hrs;
                                dayHasPresent = true;
                            } else if (status === 'present_half') {
                                monthPresentHours += 0.5 * hrs;
                                dayHasPresent = true;
                            } else if (status === 'absent') {
                                dayHasAbsent = true;
                            }
                        }
                    }
                }

                // Check Extra Classes
                const extras = exClasses.filter((e: any) => String(e.subjectId) === String(subjectId) && e.date === dStr);
                for (const exc of extras as any[]) {
                    classFound = true;
                    const hrs = getHours(exc.type);
                    const status = exc.status || dayRecord[subjectId] || null;

                    if (status !== 'class_cancelled') {
                        allCancelled = false;
                        monthTotalHours += hrs;
                        if (status === 'present') {
                            monthPresentHours += hrs;
                            dayHasPresent = true;
                        } else if (status === 'present_half') {
                            monthPresentHours += 0.5 * hrs;
                            dayHasPresent = true;
                        } else if (status === 'absent') {
                            dayHasAbsent = true;
                        }
                    }
                }
            });

            if (dayHasPresent) presentDays++;
            if (dayHasAbsent) absentDays++;
            if (classFound && allCancelled) cancelledDays++;
        }

        const summaryBar = document.getElementById('cal-summary-bar');
        if (summaryBar) {
            if (daysWithClasses === 0) {
                summaryBar.innerHTML = `<div style="text-align:center; width:100%; color:#94a3b8;">No classes scheduled this month</div>`;
            } else {
                const monthAttendance = monthTotalHours === 0 ? 100 : (monthPresentHours / monthTotalHours) * 100;
                const percColor = monthAttendance >= targetPercentage ? '#16a34a' : '#dc2626';

                summaryBar.innerHTML = `
                    <span>📗 Present: ${presentDays} days</span>
                    <span style="color:#e5e7eb;">|</span>
                    <span>📕 Absent: ${absentDays} days</span>
                    <span style="color:#e5e7eb;">|</span>
                    <span>⬜ Cancelled: ${cancelledDays} days</span>
                    <span style="color:#e5e7eb;">|</span>
                    <span style="font-weight:700; color:${percColor};">📊 This Month: ${monthAttendance.toFixed(1)}%</span>
                `;
            }
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
            const emptyMsg = isWhatIfMode ? 'Select dates on the calendar to simulate.' : 'Select dates to view.';
            list.innerHTML = `<p style="color:#94a3b8; text-align:center; margin-top: 2rem;">${emptyMsg}</p>`;
            return;
        }

        const activeAtt = getActiveAttendance();
        const activeHols = getActiveHolidays();
        const currentData = store.getData(); // Fresh data for timetable/extra classes

        // Handle right panel visibility if in bulk mode
        if (isBulkMode) {
            dayControls.style.display = 'none';

            if (selectedDates.length === 0) {
                $('#panel-date').textContent = 'Select Multiple Dates';
                list.innerHTML = `
                    <div style="text-align:center; padding: 2rem 1rem;">
                        <p style="color:#6b7280; margin:0;">Tap dates on the calendar to select them</p>
                    </div>
                `;
            } else {
                $('#panel-date').textContent = '';

                const dateChips = selectedDates.map(d => {
                    const label = new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                    return `<span style="background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:500;">${label}</span>`;
                }).join('');

                list.innerHTML = `
                    <style>
                        .bulk-pnl-btn { transition: all 0.15s ease; }
                        .bulk-pnl-btn:hover { transform: translateY(-1px); }
                    </style>
                    <div style="font-size:0.95rem; font-weight:600; color:#111827; margin-bottom:10px;">
                        ${selectedDates.length} dates selected
                    </div>
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; max-height:120px; overflow-y:auto;">
                        ${dateChips}
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <button id="bulk-pnl-present" class="bulk-pnl-btn" style="width:100%; padding:12px 16px; border-radius:10px; font-size:0.875rem; font-weight:500; border:none; background:linear-gradient(135deg, #16a34a, #15803d); color:white; cursor:pointer; margin-bottom:8px; box-shadow:0 2px 8px rgba(22,163,74,0.3);">
                            ✅ Mark All Present
                        </button>
                        <button id="bulk-pnl-absent" class="bulk-pnl-btn" style="width:100%; padding:12px 16px; border-radius:10px; font-size:0.875rem; font-weight:500; border:none; background:linear-gradient(135deg, #dc2626, #b91c1c); color:white; cursor:pointer; margin-bottom:8px; box-shadow:0 2px 8px rgba(220,38,38,0.3);">
                            ❌ Mark All Absent
                        </button>
                        <button id="bulk-pnl-cancel" class="bulk-pnl-btn" style="width:100%; padding:12px 16px; border-radius:10px; font-size:0.875rem; font-weight:500; border:none; background:linear-gradient(135deg, #6b7280, #4b5563); color:white; cursor:pointer; margin-bottom:8px; box-shadow:0 2px 8px rgba(107,114,128,0.3);">
                            🚫 Mark All Cancelled
                        </button>
                        <button id="bulk-pnl-clear" class="bulk-pnl-btn" style="width:100%; padding:10px 16px; border-radius:10px; font-size:0.875rem; border:1.5px solid #e5e7eb; background:white; color:#6b7280; cursor:pointer;">
                            ✖ Clear Selection
                        </button>
                    </div>
                `;

                setTimeout(() => {
                    document.getElementById('bulk-pnl-present')?.addEventListener('click', () => applyBulk('present'));
                    document.getElementById('bulk-pnl-absent')?.addEventListener('click', () => applyBulk('absent'));
                    document.getElementById('bulk-pnl-cancel')?.addEventListener('click', () => applyBulk('class_cancelled'));
                    document.getElementById('bulk-pnl-clear')?.addEventListener('click', () => {
                        selectedDates = [];
                        renderCal(); renderPanel();
                    });
                }, 0);
            }
            return;
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
                <div style="text-align:center; padding:20px; background:#fffbeb; border-radius:12px; border:1px solid #fcd34d;">
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
            // Need entry.id for new slot-based keying. If missing, generate fallback.
            const slotId = entry.id || `slot_${entry.subjectId}_${entry.startTime.replace(':', '')}`;
            const status = activeAtt[dStr]?.[slotId] || undefined;
            const reason = activeReasons[dStr]?.[slotId];
            const row = createClassCard(entry, status, dStr, false, undefined, reason);
            list.appendChild(row);
        });

        // Render extra classes
        extraClasses.forEach((extraClass: any, idx: number) => {
            const subject = currentData!.subjects.find(s => s.name === extraClass.subjectName || s.id === extraClass.subjectId);
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
                    const slotId = entry.id || `slot_${entry.subjectId}_${entry.startTime.replace(':', '')}`;
                    markSingle(dStr, slotId, entry.subjectId, action);
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
    const markSingle = async (date: string, slotId: string, subId: number, status: string) => {
        const d = store.getData();
        const target = isWhatIfMode ? (simulatedAttendance || {}) : (d?.attendance || {});
        const reasons = isWhatIfMode ? {} : (d?.attendanceReasons || {});

        if (!target[date]) target[date] = {};
        if (!reasons[date]) reasons[date] = {};

        const subj = data.subjects.find(s => s.id === subId);
        const subjName = subj ? subj.name : 'Subject';
        const formattedDate = new Date(date).toLocaleDateString();

        const existingStatus = target[date][slotId];

        // Toggle Logic: If clicking same status, undo (delete)
        if (existingStatus === status) {
            delete target[date][slotId];
            if (reasons[date]?.[slotId]) delete reasons[date][slotId];
            showToast(`↩️ ${subjName} unmarked for ${formattedDate}`, '#6b7280');
        } else {
            // New Status
            if (status === 'absent') {
                if (isWhatIfMode) {
                    // Skip absence reason modal in simulation
                    showToast(`❌ ${subjName} marked Absent`, '#dc2626');
                } else {
                    const reason = await AbsenceModal.ask(date);
                    if (!reason) return; // Cancelled
                    reasons[date][slotId] = reason;
                    showToast(`❌ ${subjName} marked Absent`, '#dc2626');
                }
            } else {
                // If switching from absent to something else, remove reason
                if (reasons[date]?.[slotId]) delete reasons[date][slotId];

                if (status === 'present') showToast(`✅ ${subjName} marked Present`, '#16a34a');
                else if (status === 'present_half') showToast(`🌓 ${subjName} marked Half Day`, '#f97316');
                else if (status === 'class_cancelled') showToast(`🚫 Class marked Cancelled`, '#6b7280');
            }
            target[date][slotId] = status as any;
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
            if (isWhatIfMode) {
                // Skip absence reason modal in simulation
            } else {
                reason = await AbsenceModal.ask(selectedDates[0]);
                if (!reason) return; // Cancelled
            }
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
                    const slotId = entry.id || `slot_${entry.subjectId}_${entry.startTime.replace(':', '')}`;
                    if (target[dStr]?.[slotId] !== status) {
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
                        const slotId = entry.id || `slot_${entry.subjectId}_${entry.startTime.replace(':', '')}`;
                        if (allAlreadySet) {
                            // Toggle Off / Undo
                            delete target[dStr][slotId];
                            if (reasons[dStr]?.[slotId]) delete reasons[dStr][slotId];
                        } else {
                            // Set New
                            target[dStr][slotId] = status as any;
                            if (status === 'absent' && reason) {
                                reasons[dStr][slotId] = reason;
                            } else {
                                if (reasons[dStr]?.[slotId]) delete reasons[dStr][slotId];
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

            if (status === 'present') showToast(`✅ ${selectedDates.length} days marked as Present`, '#16a34a');
            else if (status === 'present_half' as any) showToast(`🌓 ${selectedDates.length} days marked as Half Day`, '#f97316');
            else if (status === 'absent') showToast(`❌ ${selectedDates.length} days marked as Absent`, '#dc2626');
            else if (status === 'class_cancelled') showToast(`🚫 ${selectedDates.length} days marked Cancelled`, '#6b7280');

            // Exit bulk mode
            isBulkMode = false;
            selectedDates = [toDateStr(new Date())];

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
                    const reason = await AbsenceModal.ask(date);
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

        // Keep track of risk counts for the summary bar
        let safeCount = 0;
        let atRiskCount = 0;
        let dangerCount = 0;

        subjects.forEach(sub => {
            if (!sub.totalClasses || sub.totalClasses === 0) return;

            // Build simulated data for getSubjectMetrics
            const simData = {
                ...d,
                attendance: simulatedAttendance,
                holidays: simulatedHolidays
            } as any;

            // Get metrics for real and simulated
            const realMetrics = getSubjectMetrics(sub, d);
            const simMetrics = getSubjectMetrics(sub, simData);

            const diff = simMetrics.currentPercent - realMetrics.currentPercent;
            const impactClass = diff > 0 ? 'positive' : (diff < 0 ? 'negative' : '');

            // Badge from simulated risk level
            let badgeText = '';
            let badgeBg = '';
            let badgeColor = '';

            if (simMetrics.riskLevel === 'Safe') {
                badgeText = '🟢 Safe';
                badgeBg = '#dcfce7';
                badgeColor = '#16a34a';
                safeCount++;
            } else if (simMetrics.riskLevel === 'At Risk') {
                badgeText = '🟡 At Risk';
                badgeBg = '#fef9c3';
                badgeColor = '#ca8a04';
                atRiskCount++;
            } else {
                badgeText = '🔴 Danger';
                badgeBg = '#fee2e2';
                badgeColor = '#dc2626';
                dangerCount++;
            }

            const riskBadge = `<span style="background:${badgeBg}; color:${badgeColor}; font-size:0.75rem; font-weight:700; padding:4px 10px; border-radius:12px; display:inline-block;">${badgeText}</span>`;

            // Line 2 — Semester target status
            let targetStatusHtml = '';
            if (simMetrics.bufferHours <= 0) {
                targetStatusHtml = `<div style="margin-top:0.5rem; font-size:0.85rem; color:#16a34a; font-weight:500;">✅ Semester target secured!</div>`;
            } else if (simMetrics.bufferHours <= simMetrics.remainingHours) {
                targetStatusHtml = `<div style="margin-top:0.5rem; font-size:0.85rem; color:#f97316; font-weight:500;">📚 Need ${Math.ceil(simMetrics.bufferHours)} more hrs to secure target</div>`;
            } else {
                targetStatusHtml = `<div style="margin-top:0.5rem; font-size:0.85rem; color:#ef4444; font-weight:500;">🔴 Cannot secure target — need ${Math.ceil(simMetrics.bufferHours)} hrs but only ${Math.ceil(simMetrics.remainingHours)} remaining</div>`;
            }

            // Summary line
            const summaryLine = `<div style="margin-top:0.25rem; font-size:0.78rem; color:#6b7280;">📅 ${simMetrics.presentHours} hrs present · ${simMetrics.hoursHeldSoFar} hrs held · ${simMetrics.totalHours} hrs total</div>`;

            // Display percent capped at 100
            const displayPercent = Math.min(simMetrics.currentPercent, 100);
            const isSimulated = simMetrics.presentHours > simMetrics.hoursHeldSoFar;
            const percentLabel = isSimulated ? `${displayPercent.toFixed(1)}% (simulated)` : `${displayPercent.toFixed(1)}%`;

            // Diff uses capped display percent vs real
            const cappedRealPercent = Math.min(realMetrics.currentPercent, 100);
            const displayDiff = displayPercent - cappedRealPercent;
            const isDiffPositive = displayDiff > 0;
            const isDiffNegative = displayDiff < 0;
            const displayDiffColor = isDiffPositive ? '#10b981' : (isDiffNegative ? '#ef4444' : '#94a3b8');
            const displayDiffIcon = isDiffPositive ? '↑' : (isDiffNegative ? '↓' : '—');

            html += `
                <div class="impact-item ${impactClass}">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
                        <div style="font-weight:600; color:#1e293b; font-size:0.95rem;">${sub.name}</div>
                        ${riskBadge}
                    </div>
                    
                    <div style="display:flex; align-items:baseline; justify-content:space-between;">
                        <div style="font-size:1.5rem; font-weight:700; color:${displayDiffColor};">
                            ${percentLabel}
                        </div>
                        <div style="font-size:0.85rem; color:${displayDiffColor}; font-weight:600;">
                            ${displayDiffIcon} ${displayDiff >= 0 ? '+' : ''}${displayDiff.toFixed(1)}%
                        </div>
                    </div>
                    <div style="font-size:0.8rem; color:#6b7280; margin-top:0.25rem;">Present: ${simMetrics.presentHours} hrs / ${simMetrics.hoursHeldSoFar} hrs held</div>
                    ${targetStatusHtml}
                    ${summaryLine}
                </div>
            `;
        });

        // Generate Summary Bar HTML
        let summaryMessage = '';
        if (dangerCount > 0) summaryMessage = `⚠️ Act now — ${dangerCount} subject${dangerCount > 1 ? 's' : ''} need immediate attention`;
        else if (atRiskCount > 0) summaryMessage = `📊 You're close on ${atRiskCount} subject${atRiskCount > 1 ? 's' : ''} — attend consistently`;
        else summaryMessage = `✅ You're on track across all subjects!`;

        const summaryBarHtml = `
            <div style="grid-column: 1 / -1; background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                <div style="display:flex; justify-content:space-evenly; font-weight:500; font-size:1rem; margin-bottom:8px;">
                     <span style="color:#16a34a;">🟢 ${safeCount} Safe</span>
                     <span style="color:#ca8a04;">🟡 ${atRiskCount} At Risk</span>
                     <span style="color:#dc2626;">🔴 ${dangerCount} Danger</span>
                </div>
                <div style="text-align:center; font-size:0.9rem; color:#4b5563;">
                    ${summaryMessage}
                </div>
            </div>
        `;

        preview.innerHTML = html ? (summaryBarHtml + html) : '<p style="color:#94a3b8; text-align:center;">No changes yet</p>';
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
        if (isBulkMode) {
            $('#toggle-bulk').classList.add('active');
            selectedDates = []; // Clear selection when entering bulk mode
        } else {
            $('#toggle-bulk').classList.remove('active');
            selectedDates = [toDateStr(new Date())]; // Reset to single today selection
        }
        renderCal(); renderPanel();
    });

    $('#today-btn').addEventListener('click', () => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        cursorDate.setMonth(currentMonth);
        cursorDate.setFullYear(currentYear);
        if (!isBulkMode) selectedDates = [toDateStr(now)];
        renderCal();
        renderPanel();
    });

    $('#prev-m')?.addEventListener('click', () => {
        let m = cursorDate.getMonth() - 1;
        let y = cursorDate.getFullYear();
        if (m < 0) {
            m = 11;
            y -= 1;
        }
        cursorDate.setMonth(m);
        cursorDate.setFullYear(y);
        renderCal();
    });

    $('#next-m')?.addEventListener('click', () => {
        let m = cursorDate.getMonth() + 1;
        let y = cursorDate.getFullYear();
        if (m > 11) {
            m = 0;
            y += 1;
        }
        cursorDate.setMonth(m);
        cursorDate.setFullYear(y);
        renderCal();
    });

    // Day control bindings (mark-day buttons are in the right panel)
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
    border-radius: 8px;
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
