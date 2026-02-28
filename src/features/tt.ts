import { store } from '../store';
import { $ } from '../utils';
import { TimetableEntry } from '../types';
import { Modal } from '../ui/modal';


const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SLOT_START = 8; // 8 AM
const SLOT_END = 20;  // 8 PM
const ROW_HEIGHT = 60; // Pixels per hour

export function renderTimetable(container: HTMLElement) {
    const data = store.getData();
    if (!data) return;

    container.innerHTML = `
        <header class="section-header flex-between" style="margin-bottom:1.5rem;">
            <div>
                <h1 style="font-size:1.8rem; letter-spacing:-0.02em;">Weekly Timetable</h1>
                <p style="color:var(--color-text-muted);">Manage your weekly schedule. Defines your attendance tracking.</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button id="add-class-btn" class="btn">
                    + Add Class
                </button>
            </div>
        </header>

        <!-- Main Timetable Wrapper -->
        <div class="card" style="padding:0; overflow:hidden; display:flex; flex-direction:column; height:calc(100vh - 220px); border:1px solid var(--color-border);">
            
            <!-- Fixed Header (Days) -->
            <div style="display:grid; grid-template-columns: 60px repeat(7, 1fr); border-bottom:1px solid var(--color-border); background:#f8fafc; flex-shrink:0;">
                <div style="padding:1rem; border-right:1px solid var(--color-border);"></div>
                ${DAYS.map(d => `
                    <div style="padding:1rem 0.5rem; text-align:center; font-weight:600; color:#64748b; border-right:1px solid #e2e8f0; font-size:0.9rem;">
                        ${d.substring(0, 3)}
                    </div>
                `).join('')}
            </div>

            <!-- Scrollable Body (Time) -->
            <div style="overflow-y:auto; flex:1; position:relative;">
                <div style="display:grid; grid-template-columns: 60px repeat(7, 1fr); min-height:${(SLOT_END - SLOT_START) * ROW_HEIGHT}px;">
                    
                    <!-- Time Column -->
                    <div style="border-right:1px solid var(--color-border); background:white;">
                        ${renderTimeLabels()}
                    </div>

                    <!-- Day Columns -->
                    ${DAYS.map(d => `
                        <div id="col-${d}" class="tt-col" data-day="${d}">
                            <!-- Grid Lines -->
                            ${renderGridLines()}
                            <!-- Class Cards appended here -->
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <!-- Add Class Modal -->
        <div id="tt-modal" class="modal-backdrop hidden">
            <div class="modal-content" style="max-width:700px; width:95%; text-align:left; padding:0;">
                <div style="padding:1.5rem; border-bottom:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0;">Add Class Session</h3>
                    <button id="close-tt-modal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                
                <div style="padding:1.5rem; max-height:60vh; overflow-y:auto;">
                    <div class="input-group" style="margin-bottom:1.5rem;">
                        <label>Select Subject</label>
                        <select id="tt-subject" style="width:100%; padding:0.8rem; border-radius:var(--radius-md); border:1px solid var(--color-border);">
                            <option value="">-- Choose Subject --</option>
                            ${data.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                        </select>
                    </div>

                    <div style="background:#f8fafc; padding:1rem; border-radius:var(--radius-lg); border:1px solid #e2e8f0;">
                         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                            <label style="font-weight:600; margin:0;">Weekly Sessions</label>
                            <button id="add-slot-btn" class="btn btn-secondary btn-small">+ Add Session</button>
                         </div>
                         <div id="slot-list" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                </div>

                <div style="padding:1.5rem; border-top:1px solid #e2e8f0; display:flex; justify-content:flex-end; gap:1rem;">
                    <button id="cancel-tt-btn" class="btn-secondary">Cancel</button>
                    <button id="save-tt-btn" class="btn">Save Timetable</button>
                </div>
            </div>
        </div>


    `;

    renderGrid(data.timetable || {});
    attachHandlers();
}

function renderTimeLabels() {
    let html = '';
    for (let i = SLOT_START; i < SLOT_END; i++) {
        html += `
        <div style="height:${ROW_HEIGHT}px; position:relative; border-bottom:1px solid #f1f5f9;">
            <span style="position:absolute; top:-10px; right:8px; font-size:0.75rem; color:#94a3b8; background:white; padding:0 2px;">
                ${i}:00
            </span>
        </div>`;
    }
    return html;
}

function renderGridLines() {
    let html = '';
    for (let i = SLOT_START; i < SLOT_END; i++) {
        html += `<div style="height:${ROW_HEIGHT}px; border-bottom:1px solid #f1f5f9;"></div>`;
    }
    return html;
}

function renderGrid(ttData: any) {
    DAYS.forEach(day => {
        const col = $(`#col-${day}`);
        // Clear old cards but KEEP grid lines (which are static, wait... simpler to rebuild all)
        col.innerHTML = renderGridLines();

        const entries: TimetableEntry[] = ttData[day] || [];
        entries.forEach((ent, idx) => {
            const card = createClassCard(ent, day, idx);
            col.appendChild(card);
        });
    });
}

function createClassCard(ent: TimetableEntry, day: string, idx: number) {
    const [sh, sm] = ent.startTime.split(':').map(Number);
    // const [eh, em] = ent.endTime.split(':').map(Number);
    const startDec = sh + sm / 60;

    // Calculate duration
    const [eh, em] = ent.endTime.split(':').map(Number);
    const endDec = eh + em / 60;
    const duration = endDec - startDec;

    const top = (startDec - SLOT_START) * ROW_HEIGHT;
    const height = duration * ROW_HEIGHT;

    const el = document.createElement('div');
    el.className = 'tt-card-abs'; // New class
    el.style.top = `${top}px`;
    el.style.height = `${Math.max(height, 30)}px`; // Min height for visibility
    el.style.left = '4px';
    el.style.right = '4px';

    // Color Coding based on Type
    let typeColor = '#3b82f6'; // Lecture Blue
    let bgColor = '#eff6ff';
    if (ent.type === 'Lab') { typeColor = '#8b5cf6'; bgColor = '#f5f3ff'; } // Purple
    if (ent.type === 'Tutorial') { typeColor = '#f59e0b'; bgColor = '#fffbeb'; } // Amber

    el.innerHTML = `
        <div style="height:100%; border-left:3px solid ${typeColor}; background:${bgColor}; padding:4px 6px; border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.05); font-size:0.75rem; overflow:hidden; cursor:pointer; transition:transform 0.1s; position:relative;">
            <div style="font-weight:700; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">
                ${ent.subjectName}
            </div>
            <div style="color:#64748b; font-size:0.7rem;">
                ${ent.startTime} - ${ent.endTime}
            </div>
             <div style="color:${typeColor}; font-size:0.65rem; font-weight:600; text-transform:uppercase; margin-top:2px;">
                ${ent.type}
            </div>
            <button class="rm-btn" style="position:absolute; top:4px; right:4px; border:none; background:none; color:#ef4444; font-weight:bold; cursor:pointer; display:none;">&times;</button>
        </div>
    `;

    // Hover effect for delete button
    const inner = el.firstElementChild as HTMLElement;
    inner.addEventListener('mouseenter', () => { inner.querySelector('.rm-btn')?.setAttribute('style', 'position:absolute; top:4px; right:4px; border:none; background:none; color:#ef4444; font-weight:bold; cursor:pointer; display:block;'); });
    inner.addEventListener('mouseleave', () => { inner.querySelector('.rm-btn')?.setAttribute('style', 'position:absolute; top:4px; right:4px; border:none; background:none; color:#ef4444; font-weight:bold; cursor:pointer; display:none;'); });

    el.querySelector('.rm-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const conf = await Modal.confirm(`Delete ${ent.subjectName} (${ent.type}) from ${day}?`, 'Delete Class', true);
        if (conf) {
            const d = store.getData();
            if (d && d.timetable[day]) {
                d.timetable[day].splice(idx, 1);
                store.updateUserData({ timetable: d.timetable });
                renderGrid(d.timetable);
            }
        }
    });

    return el;
}

function attachHandlers() {
    // 1. Add Class Modal Logic
    const modal = $('#tt-modal');
    const toggle = (show: boolean) => {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    };

    $('#add-class-btn').addEventListener('click', () => {
        $('#slot-list').innerHTML = ''; // Reset slots
        addSlotRow(); // Default 1 row
        toggle(true);
    });
    $('#close-tt-modal').addEventListener('click', async () => {
        if (await Modal.confirm("Discard changes and close?", "Unsaved Changes")) {
            toggle(false);
        }
    });

    $('#cancel-tt-btn').addEventListener('click', async () => {
        // Check if there are any slots added? Or simply ask.
        // User requested explicit confirmation.
        if (await Modal.confirm("Discard changes and close?", "Unsaved Changes")) {
            toggle(false);
        }
    });

    $('#add-slot-btn').addEventListener('click', addSlotRow);

    $('#save-tt-btn').addEventListener('click', async () => {
        const subId = parseInt(($('#tt-subject') as HTMLSelectElement).value);
        if (!subId) { await Modal.alert("Please select a subject."); return; }

        const data = store.getData();
        if (!data) return;
        const sub = data.subjects.find(s => s.id === subId);
        if (!sub) return;

        const newTT = { ...data.timetable };
        const updates: { day: string, entry: TimetableEntry }[] = [];

        // Validate
        const rows = document.querySelectorAll('.slot-row');
        for (const row of Array.from(rows)) {
            const r = row as HTMLElement;
            const day = (r.querySelector('.s-day') as HTMLSelectElement).value;
            const start = (r.querySelector('.s-start') as HTMLInputElement).value;
            const end = (r.querySelector('.s-end') as HTMLInputElement).value;
            const type = (r.querySelector('.s-type') as HTMLSelectElement).value;

            if (!start || !end) { await Modal.alert("Start and End times are required."); return; }
            if (start >= end) { await Modal.alert(`Invalid time range on ${day}: End time must be after Start time.`); return; }

            // Enforce Duration Rules
            const [sH, sM] = start.split(':').map(Number);
            const [eH, eM] = end.split(':').map(Number);
            const actualDuration = (eH + eM / 60) - (sH + sM / 60);
            const expectedDuration = type === 'Lab' ? 2 : 1;

            if (Math.abs(actualDuration - expectedDuration) > 0.01) {
                await Modal.alert(`${type} classes must be exactly ${expectedDuration} hour(s). Please adjust the time.`);
                return;
            }

            // Collision Check (Simple overlap)
            const sDec = sH + sM / 60;
            const eDec = eH + eM / 60;

            if (sDec < SLOT_START || eDec > SLOT_END) {
                await Modal.alert(`Class time must be between ${SLOT_START}:00 and ${SLOT_END}:00.`);
                return;
            }

            const existing = newTT[day] || [];
            const conflict = existing.find((e: any) => {
                const [esH, esM] = e.startTime.split(':').map(Number);
                const [eeH, eeM] = e.endTime.split(':').map(Number);
                const esDec = esH + esM / 60;
                const eeDec = eeH + eeM / 60;
                return (sDec < eeDec && eDec > esDec);
            });

            if (conflict) {
                await Modal.alert(`Conflict on ${day}: Overlaps with ${conflict.subjectName} (${conflict.startTime}-${conflict.endTime}).`);
                return;
            }

            updates.push({
                day,
                entry: {
                    subjectId: sub.id,
                    subjectName: sub.name,
                    startTime: start,
                    endTime: end,
                    type: type as any,
                    location: ''
                }
            });
        }

        // Commit
        updates.forEach(u => {
            if (!newTT[u.day]) newTT[u.day] = [];
            newTT[u.day].push(u.entry);
        });

        store.updateUserData({ timetable: newTT });
        toggle(false);
        renderGrid(newTT);
    });
}

function addSlotRow() {
    const row = document.createElement('div');
    row.className = 'slot-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1.2fr 1fr 1fr 1fr 30px';
    row.style.gap = '10px';
    row.style.alignItems = 'center';
    row.style.background = 'white';
    row.style.padding = '8px';
    row.style.borderRadius = '8px';
    row.style.marginBottom = '8px';
    row.style.border = '1px solid #f1f5f9';

    row.innerHTML = `
        <select class="s-day" style="padding:6px; border:1px solid #e2e8f0; border-radius:6px; width:100%;">
            ${DAYS.map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
        <input type="time" class="s-start" value="09:00" style="padding:6px; border:1px solid #e2e8f0; border-radius:6px; width:100%;">
        <input type="time" class="s-end" value="10:00" style="padding:6px; border:1px solid #e2e8f0; border-radius:6px; width:100%; background:#f1f5f9;" readonly>
        <select class="s-type" style="padding:6px; border:1px solid #e2e8f0; border-radius:6px; width:100%;">
            <option value="Lecture">Lecture (1hr)</option>
            <option value="Lab">Lab (2hrs)</option>
            <option value="Tutorial">Tutorial (1hr)</option>
        </select>
        <button class="remove-slot" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:1.2rem;">&times;</button>
    `;

    // Auto-calculate end time based on type
    const typeSelect = row.querySelector('.s-type') as HTMLSelectElement;
    const startInput = row.querySelector('.s-start') as HTMLInputElement;
    const endInput = row.querySelector('.s-end') as HTMLInputElement;

    const updateEndTime = (newStartTime?: string) => {
        const type = typeSelect.value;
        const start = newStartTime || startInput.value;
        if (!start) return;

        const [h, m] = start.split(':').map(Number);
        const duration = type === 'Lab' ? 2 : 1; // Lab = 2hrs, Theory/Tutorial = 1hr
        let endH = h + duration;

        // Wrap around 24h if needed (though unlikely for classes)
        // But logic relies on linear time for slots. 

        const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        endInput.value = endTime;
    };

    startInput.addEventListener('change', () => updateEndTime());
    typeSelect.addEventListener('change', () => updateEndTime());
    updateEndTime(); // Init

    row.querySelector('.remove-slot')?.addEventListener('click', () => row.remove());
    $('#slot-list').appendChild(row);
}

// Inject Grid Styles
const style = document.createElement('style');
style.innerHTML = `
.tt-col {
    border-right: 1px solid #e2e8f0;
    position: relative;
    background-image: linear-gradient(to bottom, #f8fafc 1px, transparent 1px);
    background-size: 100% 30px; /* Half hour guides (optional) */
}
.tt-card-abs {
    position: absolute;
    left: 4px;
    right: 4px;
    z-index: 10;
    transition: all 0.2s;
}
.tt-card-abs:hover {
    z-index: 20;
    transform: scale(1.02);
}
`;
document.head.appendChild(style);


