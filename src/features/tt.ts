import { store } from '../store';
// utils not needed — using document.getElementById directly
import { TimetableEntry } from '../types';
import { Modal } from '../ui/modal';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_START = 9;
const SLOT_END = 18;

let activePopover: HTMLElement | null = null;
let editingSlot: { day: string; idx: number } | null = null;

// ── Toast ──────────────────────────────────────────
function showToast(msg: string) {
    let t = document.getElementById('tt-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'tt-toast';
        t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#1e293b;color:white;padding:10px 20px;border-radius:10px;font-size:0.85rem;z-index:9999;opacity:0;transition:all 0.3s ease;pointer-events:none;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
        t!.style.opacity = '0';
        t!.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2000);
}

// ── Main render ────────────────────────────────────
export function renderTimetable(container: HTMLElement) {
    const data = store.getData();
    if (!data) return;

    container.innerHTML = `
        <header class="section-header flex-between" style="margin-bottom:1.5rem;">
            <div>
                <h1 style="font-size:1.8rem; letter-spacing:-0.02em;">Weekly Timetable</h1>
                <p style="color:var(--color-text-muted);">Click any empty cell to add a class, or use the button.</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="add-class-btn" class="btn">+ Add Class</button>
            </div>
        </header>

        <!-- Grid Container -->
        <div id="tt-grid-container" style="border:1px solid #e5e7eb; border-radius:12px; overflow:hidden; background:white; height:calc(100vh - 200px);">
            <!-- Header Row -->
            <div style="display:grid; grid-template-columns: 60px repeat(7, 1fr); background:#f8fafc; border-bottom:2px solid #e5e7eb;">
                <div style="padding:10px 0;"></div>
                ${DAYS.map((_, i) => `
                    <div style="padding:10px 0; text-align:center; font-size:0.8rem; font-weight:600; color:#374151; text-transform:uppercase; letter-spacing:0.05em; border-left:1px solid #f1f5f9;">
                        ${DAY_SHORT[i]}
                    </div>
                `).join('')}
            </div>

            <!-- Body (no scroll) -->
            <div style="overflow:hidden; height:calc(100% - 42px);">
                <div style="display:grid; grid-template-columns: 60px repeat(7, 1fr); height:100%;">
                    <!-- Time Labels Column -->
                    <div style="display:flex; flex-direction:column;">
                        ${renderTimeLabels()}
                    </div>

                    <!-- Day Columns -->
                    ${DAYS.map(d => `
                        <div id="col-${d}" class="tt-col" data-day="${d}" style="position:relative; border-left:1px solid #f1f5f9; display:flex; flex-direction:column; height:100%;">
                            ${renderGridCells(d)}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Legend -->
        <div style="display:flex; gap:20px; align-items:center; padding:10px 4px; font-size:0.8rem; color:#6b7280;">
            <div style="display:flex; gap:6px; align-items:center;"><span style="width:8px; height:8px; border-radius:50%; background:#2563eb; display:inline-block;"></span> Lecture</div>
            <div style="display:flex; gap:6px; align-items:center;"><span style="width:8px; height:8px; border-radius:50%; background:#7c3aed; display:inline-block;"></span> Lab</div>
            <div style="display:flex; gap:6px; align-items:center;"><span style="width:8px; height:8px; border-radius:50%; background:#16a34a; display:inline-block;"></span> Tutorial</div>
        </div>

        <!-- Popover anchor -->
        <div id="tt-popover-anchor"></div>
        <!-- Tooltip element -->
        <div id="tt-tooltip" style="position:fixed; z-index:9999; background:#1e293b; color:white; border-radius:8px; padding:10px 14px; font-size:0.8rem; box-shadow:0 4px 16px rgba(0,0,0,0.2); pointer-events:none; opacity:0; transition:opacity 0.15s ease; white-space:nowrap;"></div>
    `;

    renderSlotCards(data.timetable || {});
    attachHandlers(container);
}

// ── Time labels ────────────────────────────────────
function renderTimeLabels(): string {
    let html = '';
    for (let i = SLOT_START; i < SLOT_END; i++) {
        const label = i <= 12 ? `${i}` : `${i - 12}`;
        const ampm = i < 12 ? 'AM' : 'PM';
        html += `
            <div style="flex:1; border-bottom:1px solid #f1f5f9; display:flex; align-items:flex-start; justify-content:flex-end; padding-right:12px; padding-top:2px;">
                <span style="font-size:0.72rem; color:#9ca3af; font-weight:400; white-space:nowrap;">${label} ${ampm}</span>
            </div>`;
    }
    return html;
}

// ── Grid cells (clickable) ─────────────────────────
function renderGridCells(day: string): string {
    let html = '';
    for (let i = SLOT_START; i < SLOT_END; i++) {
        html += `<div class="tt-cell" data-day="${day}" data-hour="${i}" style="flex:1; border-bottom:1px solid #f1f5f9; position:relative; transition:background 0.1s ease; cursor:pointer;"></div>`;
    }
    return html;
}

// ── Render slot cards ──────────────────────────────
function renderSlotCards(ttData: any) {
    DAYS.forEach(day => {
        const col = document.getElementById(`col-${day}`);
        if (!col) return;

        // Remove old slot cards (keep grid cells)
        col.querySelectorAll('.tt-slot-card').forEach(c => c.remove());

        const entries: TimetableEntry[] = ttData[day] || [];
        entries.forEach((ent, idx) => {
            const card = createSlotCard(ent, day, idx);
            col.appendChild(card);
        });
    });
}

// ── Create a slot card ─────────────────────────────
function createSlotCard(ent: TimetableEntry, day: string, idx: number): HTMLElement {
    const [sh, sm] = ent.startTime.split(':').map(Number);
    const [eh, em] = ent.endTime.split(':').map(Number);
    const startDec = sh + sm / 60;
    const endDec = eh + em / 60;
    const duration = endDec - startDec;
    const totalSlots = SLOT_END - SLOT_START; // 9

    const topPct = ((startDec - SLOT_START) / totalSlots) * 100;
    const heightPct = Math.max((duration / totalSlots) * 100, 3);

    // Type-based colors
    let borderColor = '#2563eb';
    let bgColor = '#eff6ff';
    let nameColor = '#1e40af';
    if (ent.type === 'Lab') { borderColor = '#7c3aed'; bgColor = '#f5f3ff'; nameColor = '#5b21b6'; }
    if (ent.type === 'Tutorial') { borderColor = '#16a34a'; bgColor = '#f0fdf4'; nameColor = '#166534'; }

    const el = document.createElement('div');
    el.className = 'tt-slot-card';
    el.style.cssText = `position:absolute; top:${topPct}%; height:${heightPct}%; left:3px; right:3px; z-index:10;`;

    el.innerHTML = `
        <div class="tt-slot-inner" style="height:100%; background:${bgColor}; border-left:3px solid ${borderColor}; border-radius:8px; padding:8px 10px; overflow:hidden; cursor:pointer; position:relative; transition:all 0.15s ease;">
            <div style="font-size:0.82rem; font-weight:600; color:${nameColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.3;">
                ${ent.subjectName}
            </div>
            <span style="position:absolute; bottom:6px; right:6px; width:8px; height:8px; border-radius:50%; background:${borderColor};"></span>
            <button class="tt-del-btn" style="position:absolute; top:3px; right:3px; width:16px; height:16px; background:rgba(0,0,0,0.1); border:none; border-radius:50%; font-size:0.65rem; line-height:16px; text-align:center; cursor:pointer; opacity:0; transition:opacity 0.15s ease; color:#374151;">&times;</button>
        </div>
    `;

    const inner = el.querySelector('.tt-slot-inner') as HTMLElement;
    const delBtn = el.querySelector('.tt-del-btn') as HTMLElement;

    // Hover: show delete + tooltip + card effect
    inner.addEventListener('mouseenter', (e) => {
        delBtn.style.opacity = '1';
        inner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        inner.style.transform = 'scale(1.01)';
        inner.style.filter = 'brightness(1.03)';
        showSlotTooltip(ent, e as MouseEvent);
    });
    inner.addEventListener('mousemove', (e) => {
        moveSlotTooltip(e as MouseEvent);
    });
    inner.addEventListener('mouseleave', () => {
        delBtn.style.opacity = '0';
        inner.style.boxShadow = 'none';
        inner.style.transform = 'none';
        inner.style.filter = 'none';
        hideSlotTooltip();
    });

    // Click slot → edit
    inner.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).classList.contains('tt-del-btn')) return;
        editingSlot = { day, idx };
        const data = store.getData();
        if (!data) return;
        openPopover(e.clientX, e.clientY, day, ent.startTime.split(':').map(Number)[0], ent, data.subjects);
    });

    // Delete
    delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const conf = await Modal.confirm(`Delete ${ent.subjectName} (${ent.type}) from ${day}?`, 'Delete Class', true);
        if (conf) {
            const d = store.getData();
            if (d && d.timetable[day]) {
                d.timetable[day].splice(idx, 1);
                store.updateUserData({ timetable: d.timetable });
                renderSlotCards(d.timetable);
                showToast('🗑️ Class removed');
            }
        }
    });

    return el;
}

// ── Tooltip helpers ────────────────────────────────
function showSlotTooltip(ent: TimetableEntry, e: MouseEvent) {
    const tip = document.getElementById('tt-tooltip');
    if (!tip) return;
    tip.innerHTML = `<div style="font-weight:600; margin-bottom:2px;">${ent.subjectName}</div><div style="color:#94a3b8;">Time: ${ent.startTime} – ${ent.endTime}</div><div style="color:#94a3b8;">Type: ${ent.type}</div>`;
    tip.style.opacity = '1';
    positionTooltip(tip, e);
}

function moveSlotTooltip(e: MouseEvent) {
    const tip = document.getElementById('tt-tooltip');
    if (!tip) return;
    positionTooltip(tip, e);
}

function positionTooltip(tip: HTMLElement, e: MouseEvent) {
    let left = e.clientX + 12;
    const top = e.clientY + 12;
    const rect = tip.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - 16) {
        left = e.clientX - rect.width - 12;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
}

function hideSlotTooltip() {
    const tip = document.getElementById('tt-tooltip');
    if (tip) tip.style.opacity = '0';
}

// ── Attach handlers ────────────────────────────────
function attachHandlers(container: HTMLElement) {
    // + Add Class button (no pre-fill)
    document.getElementById('add-class-btn')?.addEventListener('click', (ev) => {
        const data = store.getData();
        if (!data) return;
        editingSlot = null;
        openPopover(ev.clientX, ev.clientY, '', 9, null, data.subjects);
    });

    // Click empty cell → pre-fill day + hour
    container.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('.tt-cell') as HTMLElement | null;
        if (!cell) return;

        const data = store.getData();
        if (!data) return;

        const day = cell.dataset.day || '';
        const hour = parseInt(cell.dataset.hour || '9');
        editingSlot = null;

        openPopover(e.clientX, e.clientY, day, hour, null, data.subjects);
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePopover();
    });

    // Close on click outside
    document.addEventListener('mousedown', (e) => {
        if (activePopover && !activePopover.contains(e.target as Node)) {
            // Don't close if clicking on a tt-cell or add-class-btn (they open a new one)
            const t = e.target as HTMLElement;
            if (t.closest('.tt-cell') || t.closest('#add-class-btn')) return;
            closePopover();
        }
    });
}

// ── Popover ────────────────────────────────────────
function openPopover(x: number, y: number, preDay: string, preHour: number, editEntry: TimetableEntry | null, subjects: any[]) {
    closePopover();

    const isEdit = !!editEntry;
    const popoverWidth = 320;
    const popoverMaxH = Math.min(480, window.innerHeight - 40);

    const pop = document.createElement('div');
    pop.id = 'tt-popover';
    pop.style.cssText = `position:fixed; width:min(${popoverWidth}px, calc(100vw - 48px)); background:white; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 8px 24px rgba(0,0,0,0.12); padding:14px; z-index:9999; max-height:${popoverMaxH}px; overflow-y:auto; scrollbar-width:thin; box-sizing:border-box; animation:popoverIn 0.15s ease;`;

    // Smart positioning — never clip against viewport edges
    let leftPos = x + 12;
    if (leftPos + popoverWidth > window.innerWidth - 20) {
        leftPos = x - popoverWidth - 12;
    }
    if (leftPos < 12) leftPos = 12;

    let topPos = y + 12;
    if (topPos + popoverMaxH > window.innerHeight - 20) {
        topPos = y - popoverMaxH - 12;
    }
    if (topPos < 12) topPos = 12;

    pop.style.left = leftPos + 'px';
    pop.style.top = topPos + 'px';

    // Pre-selected values
    const selSubject = editEntry ? editEntry.subjectId : '';
    const selType = editEntry ? editEntry.type : 'Lecture';
    const defaultStart = editEntry ? editEntry.startTime : `${String(preHour).padStart(2, '0')}:00`;
    const durHrs = (editEntry?.type || selType) === 'Lab' ? 2 : 1;
    const defaultEnd = editEntry ? editEntry.endTime : `${String(preHour + durHrs).padStart(2, '0')}:00`;
    const selDay = preDay || '';

    // Type colors
    const typeColors: any = { Lecture: '#2563eb', Lab: '#7c3aed', Tutorial: '#16a34a' };

    pop.innerHTML = `
        <div style="font-weight:600; font-size:0.95rem; color:#1e293b; margin-bottom:12px;">${isEdit ? 'Edit Class' : 'Add Class'}</div>

        <!-- Subject -->
        <select id="pop-subject" style="width:100%; padding:8px 12px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.875rem; margin-bottom:10px; outline:none; transition:border-color 0.15s; box-sizing:border-box;">
            <option value="">— Select Subject —</option>
            ${subjects.map(s => `<option value="${s.id}" ${s.id == selSubject ? 'selected' : ''}>${s.name}</option>`).join('')}
        </select>

        <!-- Day -->
        ${!isEdit ? `
        <div style="margin-bottom:10px;">
            <div style="font-size:0.78rem; color:#6b7280; margin-bottom:4px;">Day${selDay ? '' : 's'}</div>
            ${selDay ? `
                <input type="hidden" id="pop-day-hidden" value="${selDay}">
                <div style="display:flex;"><span style="padding:4px 10px; border-radius:20px; background:#2563eb; color:white; font-size:0.78rem; font-weight:500;">${DAY_SHORT[DAYS.indexOf(selDay)]}</span></div>
            ` : `
                <div id="pop-day-pills" style="display:flex; flex-wrap:wrap; gap:4px;">
                    ${DAYS.map((d, i) => `<button class="pop-day-pill" data-day="${d}" style="padding:4px 10px; border-radius:20px; border:1px solid #e5e7eb; font-size:0.8rem; cursor:pointer; background:#f8fafc; color:#374151; font-weight:500; transition:all 0.15s;">${DAY_SHORT[i]}</button>`).join('')}
                </div>
            `}
        </div>
        ` : `<input type="hidden" id="pop-day-hidden" value="${editEntry ? editingSlot?.day : ''}">`}

        <!-- Time section: will be dynamically rendered -->
        <div id="pop-time-section"></div>

        <!-- Type (shown for single day / edit; hidden for multi-day) -->
        <div id="pop-global-type" style="margin-bottom:12px;">
            <div style="font-size:0.78rem; color:#6b7280; margin-bottom:4px;">Type</div>
            <div id="pop-type-pills" style="display:flex; gap:4px;">
                ${['Lecture', 'Lab', 'Tutorial'].map(t => {
        const isActive = t === selType;
        const c = typeColors[t];
        return `<button class="pop-type-pill" data-type="${t}" style="padding:5px 14px; border-radius:20px; border:1px solid ${isActive ? c : '#e5e7eb'}; font-size:0.78rem; cursor:pointer; background:${isActive ? c : '#f8fafc'}; color:${isActive ? 'white' : '#374151'}; font-weight:500; transition:all 0.15s;">${t}</button>`;
    }).join('')}
            </div>
        </div>

        <!-- Validation message -->
        <div id="pop-error" style="font-size:0.78rem; color:#dc2626; margin-bottom:8px; display:none;"></div>

        <!-- Buttons -->
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <button id="pop-cancel" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:0.85rem; padding:4px;">Cancel</button>
            <button id="pop-save" style="background:#2563eb; color:white; border:none; border-radius:8px; padding:8px 20px; cursor:pointer; font-size:0.85rem; font-weight:600; transition:background 0.15s;">${isEdit ? 'Update Class' : 'Add Class'}</button>
        </div>

        ${isEdit ? `<div style="text-align:center; margin-top:10px;"><button id="pop-delete" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:0.8rem;">Delete Class</button></div>` : ''}
    `;

    document.body.appendChild(pop);
    activePopover = pop;

    // ── State ──
    let selectedDays: string[] = selDay ? [selDay] : [];
    let selectedType = selType;
    // Store per-day data: { [day]: { start, end, type } }
    const dayData: { [day: string]: { start: string; end: string; type: string } } = {};
    if (selDay) {
        dayData[selDay] = { start: defaultStart, end: defaultEnd, type: selType };
    }

    const timeSection = pop.querySelector('#pop-time-section') as HTMLElement;

    // Per-row type pill colors
    const rowTypeStyles: any = {
        Lecture: { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' },
        Lab: { bg: '#ede9fe', color: '#6d28d9', border: '#ddd6fe' },
        Tutorial: { bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' }
    };
    const unselStyle = 'background:#f8fafc; color:#9ca3af; border:1px solid #e5e7eb;';

    // Compute end time from start + type
    const calcEnd = (start: string, type?: string): string => {
        if (!start) return '';
        const [h, m] = start.split(':').map(Number);
        const dur = (type || selectedType) === 'Lab' ? 2 : 1;
        return `${String(h + dur).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // Get the last entered time as default for new rows
    const getLastData = (): { start: string; end: string; type: string } => {
        const dayOrder = DAYS.filter(d => selectedDays.includes(d));
        for (let i = dayOrder.length - 1; i >= 0; i--) {
            if (dayData[dayOrder[i]]) return dayData[dayOrder[i]];
        }
        return { start: defaultStart, end: defaultEnd, type: selType };
    };

    // ── Render time rows ──
    const renderTimeRows = () => {
        if (selectedDays.length === 0) {
            // No days selected — show single default row
            timeSection.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                    <div>
                        <div style="font-size:0.78rem; color:#6b7280; margin-bottom:4px;">From</div>
                        <input type="time" class="pop-start-single" value="${defaultStart}" style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.875rem; outline:none;">
                    </div>
                    <div>
                        <div style="font-size:0.78rem; color:#6b7280; margin-bottom:4px;">To</div>
                        <input type="time" class="pop-end-single" value="${defaultEnd}" style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.875rem; background:#f8fafc; outline:none;" readonly>
                    </div>
                </div>
            `;
            const si = timeSection.querySelector('.pop-start-single') as HTMLInputElement;
            si?.addEventListener('change', () => {
                const ei = timeSection.querySelector('.pop-end-single') as HTMLInputElement;
                if (ei) ei.value = calcEnd(si.value, selectedType);
            });
            return;
        }

        if (selectedDays.length === 1) {
            // Single day — simple From/To (type uses shared pills from 18A)
            const day = selectedDays[0];
            const dd = dayData[day] || { start: defaultStart, end: calcEnd(defaultStart, selectedType), type: selectedType };
            dayData[day] = dd;
            timeSection.innerHTML = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                    <div>
                        <div style="font-size:0.78rem; color:#6b7280; margin-bottom:4px;">From</div>
                        <input type="time" data-day="${day}" class="pop-row-start" value="${dd.start}" style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.875rem; outline:none;">
                    </div>
                    <div>
                        <div style="font-size:0.78rem; color:#6b7280; margin-bottom:4px;">To</div>
                        <input type="time" data-day="${day}" class="pop-row-end" value="${dd.end}" style="width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.875rem; background:#f8fafc; outline:none;" readonly>
                    </div>
                </div>
            `;
            attachTimeRowListeners(timeSection, day);
            return;
        }

        // Multiple days — per-day rows with per-row type pills
        const orderedDays = DAYS.filter(d => selectedDays.includes(d));
        let html = '<div style="margin-bottom:10px; display:flex; flex-direction:column; gap:8px;">';
        orderedDays.forEach(day => {
            const dd = dayData[day] || getLastData();
            dayData[day] = dd;
            const short = DAY_SHORT[DAYS.indexOf(day)];
            const rowType = dd.type || 'Lecture';

            const typePillsHtml = ['Lecture', 'Lab', 'Tutorial'].map(t => {
                const active = t === rowType;
                const s = rowTypeStyles[t];
                const style = active
                    ? `background:${s.bg}; color:${s.color}; border:1px solid ${s.border};`
                    : unselStyle;
                return `<button class="pop-row-type" data-day="${day}" data-type="${t}" style="${style} padding:3px 8px; border-radius:20px; font-size:0.72rem; cursor:pointer; font-weight:500; transition:all 0.12s; white-space:nowrap;">${t === 'Lecture' ? 'Lec' : t === 'Tutorial' ? 'Tut' : t}</button>`;
            }).join('');

            html += `
                <div class="pop-time-row" data-day="${day}" style="display:grid; grid-template-columns:36px 1fr 1fr auto; gap:5px; align-items:center;">
                    <span style="font-size:0.8rem; font-weight:500; color:#374151;">${short}</span>
                    <input type="time" data-day="${day}" class="pop-row-start" value="${dd.start}" style="width:100%; padding:5px 6px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.82rem; outline:none;">
                    <input type="time" data-day="${day}" class="pop-row-end" value="${dd.end}" style="width:100%; padding:5px 6px; border:1px solid #e5e7eb; border-radius:8px; font-size:0.82rem; background:#f8fafc; outline:none;" readonly>
                    <div style="display:flex; gap:3px;">${typePillsHtml}</div>
                </div>
            `;
        });
        html += '</div>';
        timeSection.innerHTML = html;

        // Attach listeners for each row (time + type)
        orderedDays.forEach(day => {
            attachTimeRowListeners(timeSection, day);
            attachRowTypePillListeners(timeSection, day);
        });
    };

    const attachTimeRowListeners = (container: HTMLElement, day: string) => {
        const startEl = container.querySelector(`input.pop-row-start[data-day="${day}"]`) as HTMLInputElement;
        if (startEl) {
            startEl.addEventListener('change', () => {
                const endEl = container.querySelector(`input.pop-row-end[data-day="${day}"]`) as HTMLInputElement;
                const rowType = dayData[day]?.type || selectedType;
                const newEnd = calcEnd(startEl.value, rowType);
                if (endEl) endEl.value = newEnd;
                dayData[day] = { ...dayData[day], start: startEl.value, end: newEnd };
            });
        }
    };

    const attachRowTypePillListeners = (container: HTMLElement, day: string) => {
        const pills = container.querySelectorAll(`button.pop-row-type[data-day="${day}"]`);
        pills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.preventDefault();
                const newType = (pill as HTMLElement).dataset.type || 'Lecture';
                dayData[day] = { ...dayData[day], type: newType };
                // Recalc end time for this row
                const newEnd = calcEnd(dayData[day].start, newType);
                dayData[day].end = newEnd;
                const endEl = container.querySelector(`input.pop-row-end[data-day="${day}"]`) as HTMLInputElement;
                if (endEl) endEl.value = newEnd;
                // Update pill visuals
                pills.forEach(p => { (p as HTMLElement).style.cssText = `${unselStyle} padding:3px 8px; border-radius:20px; font-size:0.72rem; cursor:pointer; font-weight:500; transition:all 0.12s; white-space:nowrap;`; });
                const s = rowTypeStyles[newType];
                (pill as HTMLElement).style.cssText = `background:${s.bg}; color:${s.color}; border:1px solid ${s.border}; padding:3px 8px; border-radius:20px; font-size:0.72rem; cursor:pointer; font-weight:500; transition:all 0.12s; white-space:nowrap;`;
            });
        });
    };

    // Toggle global type selector visibility
    const updateGlobalTypeVisibility = () => {
        const globalType = pop.querySelector('#pop-global-type') as HTMLElement;
        if (globalType) {
            globalType.style.display = selectedDays.length > 1 ? 'none' : '';
        }
    };

    // Initial render
    renderTimeRows();
    updateGlobalTypeVisibility();

    // ── Day pills (multi-select) ──
    const dayPills = pop.querySelectorAll('.pop-day-pill');
    dayPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const day = (pill as HTMLElement).dataset.day || '';
            const idx = selectedDays.indexOf(day);
            if (idx >= 0) {
                // Deselect
                selectedDays.splice(idx, 1);
                (pill as HTMLElement).style.background = '#f8fafc';
                (pill as HTMLElement).style.color = '#374151';
                (pill as HTMLElement).style.border = '1px solid #e5e7eb';
                // Don't delete dayTimes[day] so if user re-selects, time is preserved
            } else {
                // Select — carry last time as default
                selectedDays.push(day);
                if (!dayData[day]) {
                    const last = getLastData();
                    dayData[day] = { start: last.start, end: last.end, type: last.type };
                }
                (pill as HTMLElement).style.background = '#2563eb';
                (pill as HTMLElement).style.color = 'white';
                (pill as HTMLElement).style.border = '1px solid #2563eb';
            }
            renderTimeRows();
            updateGlobalTypeVisibility();
        });
    });

    // ── Type pills ──
    const typePills = pop.querySelectorAll('.pop-type-pill');
    typePills.forEach(pill => {
        pill.addEventListener('click', () => {
            selectedType = (pill as HTMLElement).dataset.type || 'Lecture';
            const c = typeColors[selectedType];
            typePills.forEach(p => { (p as HTMLElement).style.background = '#f8fafc'; (p as HTMLElement).style.color = '#374151'; (p as HTMLElement).style.border = '1px solid #e5e7eb'; });
            (pill as HTMLElement).style.background = c;
            (pill as HTMLElement).style.color = 'white';
            (pill as HTMLElement).style.border = `1px solid ${c}`;
            // Recalculate end times for single-day mode only
            // Multi-day has per-row types, so only update dayData for single selection
            if (selectedDays.length <= 1) {
                for (const day of Object.keys(dayData)) {
                    dayData[day].type = selectedType;
                    dayData[day].end = calcEnd(dayData[day].start, selectedType);
                }
            }
            renderTimeRows();
        });
    });

    // Cancel
    pop.querySelector('#pop-cancel')?.addEventListener('click', closePopover);

    // ── Save ──
    pop.querySelector('#pop-save')?.addEventListener('click', () => {
        const errEl = pop.querySelector('#pop-error') as HTMLElement;
        errEl.style.display = 'none';

        // Clear any row-level errors
        pop.querySelectorAll('.pop-row-error').forEach(e => e.remove());
        pop.querySelectorAll('.pop-row-start, .pop-row-end, .pop-start-single, .pop-end-single').forEach(e => (e as HTMLElement).style.borderColor = '#e5e7eb');

        const subId = parseInt((pop.querySelector('#pop-subject') as HTMLSelectElement).value);
        if (!subId) {
            const sel = pop.querySelector('#pop-subject') as HTMLElement;
            sel.style.borderColor = '#dc2626';
            sel.style.animation = 'shake 0.3s ease';
            setTimeout(() => { sel.style.borderColor = '#e5e7eb'; sel.style.animation = ''; }, 600);
            return;
        }

        // Determine days to process
        const dayHidden = pop.querySelector('#pop-day-hidden') as HTMLInputElement | null;
        let daysToProcess: string[];

        if (dayHidden) {
            daysToProcess = [dayHidden.value];
        } else if (selectedDays.length > 0) {
            daysToProcess = DAYS.filter(d => selectedDays.includes(d));
        } else {
            errEl.textContent = '⚠️ Please select a day';
            errEl.style.display = 'block';
            return;
        }

        // Read times from inputs (they may have been manually changed)
        daysToProcess.forEach(day => {
            const startEl = pop.querySelector(`input.pop-row-start[data-day="${day}"]`) as HTMLInputElement;
            const endEl = pop.querySelector(`input.pop-row-end[data-day="${day}"]`) as HTMLInputElement;
            if (startEl && endEl) {
                dayData[day] = { ...dayData[day], start: startEl.value, end: endEl.value };
            } else {
                // Single no-day-selected fallback
                const singleStart = pop.querySelector('.pop-start-single') as HTMLInputElement;
                const singleEnd = pop.querySelector('.pop-end-single') as HTMLInputElement;
                if (singleStart && singleEnd) {
                    dayData[day] = { start: singleStart.value, end: singleEnd.value, type: selectedType };
                }
            }
        });

        const data = store.getData();
        if (!data) return;
        const sub = data.subjects.find(s => s.id === subId);
        if (!sub) return;

        const newTT = { ...data.timetable };

        // Validate each day independently
        let hasError = false;
        const validEntries: { day: string; entry: TimetableEntry }[] = [];

        for (const day of daysToProcess) {
            const dd = dayData[day];
            if (!dd || !dd.start || !dd.end) {
                showRowError(pop, day, '⚠️ Enter start time');
                hasError = true;
                continue;
            }
            if (dd.end <= dd.start) {
                highlightRow(pop, day);
                showRowError(pop, day, '⚠️ End time must be after start time');
                hasError = true;
                continue;
            }

            const [sH, sM] = dd.start.split(':').map(Number);
            const [eH, eM] = dd.end.split(':').map(Number);
            const sDec = sH + sM / 60;
            const eDec = eH + eM / 60;

            if (sDec < SLOT_START || eDec > SLOT_END) {
                showRowError(pop, day, `⚠️ Time must be ${SLOT_START}:00–${SLOT_END}:00`);
                hasError = true;
                continue;
            }

            // Conflict check
            if (!newTT[day]) newTT[day] = [];
            const existing = newTT[day] || [];
            const conflict = existing.find((e: any, i: number) => {
                if (editingSlot && editingSlot.day === day && editingSlot.idx === i) return false;
                const [esH, esM] = e.startTime.split(':').map(Number);
                const [eeH, eeM] = e.endTime.split(':').map(Number);
                const esDec = esH + esM / 60;
                const eeDec = eeH + eeM / 60;
                return (sDec < eeDec && eDec > esDec);
            });

            if (conflict) {
                showRowError(pop, day, `⚠️ Conflicts with ${conflict.subjectName}`);
                hasError = true;
                continue;
            }

            // Use per-day type for multi-day, global selectedType for single-day/edit
            const entryType = (selectedDays.length > 1 ? dd.type : selectedType) || selectedType;

            validEntries.push({
                day,
                entry: {
                    id: (isEdit && editingSlot) ? (existing[editingSlot.idx]?.id || `slot_${sub.id}_${dd.start.replace(':', '')}`) : `slot_${sub.id}_${dd.start.replace(':', '')}`,
                    subjectId: sub.id,
                    subjectName: sub.name,
                    startTime: dd.start,
                    endTime: dd.end,
                    type: entryType as any,
                    location: ''
                }
            });
        }

        if (hasError) return;

        // Commit
        if (isEdit && editingSlot) {
            const e = validEntries[0];
            if (editingSlot.day !== e.day) {
                newTT[editingSlot.day].splice(editingSlot.idx, 1);
                if (!newTT[e.day]) newTT[e.day] = [];
                newTT[e.day].push(e.entry);
            } else {
                newTT[e.day][editingSlot.idx] = e.entry;
            }
            showToast('✅ Class updated');
        } else {
            validEntries.forEach(v => {
                if (!newTT[v.day]) newTT[v.day] = [];
                newTT[v.day].push(v.entry);
            });
            const count = validEntries.length;
            showToast(`✅ ${count} class${count > 1 ? 'es' : ''} added`);
        }

        store.updateUserData({ timetable: newTT });
        closePopover();
        renderSlotCards(newTT);
    });

    // Delete (edit mode only)
    pop.querySelector('#pop-delete')?.addEventListener('click', async () => {
        if (!editingSlot) return;
        const d = store.getData();
        if (!d) return;
        const conf = await Modal.confirm('Delete this class?', 'Delete Class', true);
        if (conf) {
            d.timetable[editingSlot.day].splice(editingSlot.idx, 1);
            store.updateUserData({ timetable: d.timetable });
            closePopover();
            renderSlotCards(d.timetable);
            showToast('🗑️ Class removed');
        }
    });
}

function showRowError(pop: HTMLElement, day: string, msg: string) {
    const row = pop.querySelector(`.pop-time-row[data-day="${day}"]`) as HTMLElement;
    if (row) {
        const err = document.createElement('div');
        err.className = 'pop-row-error';
        err.style.cssText = 'grid-column:1/-1; font-size:0.72rem; color:#dc2626; margin-top:-2px;';
        err.textContent = msg;
        row.appendChild(err);
    } else {
        // Fallback: show in global error
        const errEl = pop.querySelector('#pop-error') as HTMLElement;
        if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    }
}

function highlightRow(pop: HTMLElement, day: string) {
    const startEl = pop.querySelector(`input.pop-row-start[data-day="${day}"]`) as HTMLElement;
    const endEl = pop.querySelector(`input.pop-row-end[data-day="${day}"]`) as HTMLElement;
    if (startEl) startEl.style.borderColor = '#dc2626';
    if (endEl) endEl.style.borderColor = '#dc2626';
}

function closePopover() {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
    }
    editingSlot = null;
}

// ── Inject styles ──────────────────────────────────
const ttStyle = document.createElement('style');
ttStyle.innerHTML = `
.tt-col .tt-cell:hover {
    background: #f0f9ff !important;
}
.tt-slot-card {
    transition: all 0.15s ease;
}
.tt-slot-card:hover {
    z-index: 20 !important;
}
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    50% { transform: translateX(4px); }
    75% { transform: translateX(-4px); }
}
@keyframes popoverIn {
    from { opacity: 0; transform: scale(0.95); }
    to   { opacity: 1; transform: scale(1); }
}
`;
document.head.appendChild(ttStyle);
