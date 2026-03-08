import { store } from '../store';
import { $ } from '../utils';
import { Subject } from '../types';
import { Modal } from '../ui/modal';

let editingSubjectId: number | null = null;

export function renderSubjects(container: HTMLElement) {
    const subs = store.getData()?.subjects || [];

    // Main View
    container.innerHTML = `
        <header class="section-header" style="margin-bottom:2rem;">
            <div class="flex-between">
                <div>
                    <h1 style="font-size:2rem; margin-bottom:0.5rem;">Subject Management</h1>
                    <p style="color:#64748b;">Manage course details, credits, and evaluation schemes.</p>
                </div>
                <button id="add-sub-btn" class="btn">+ Add Subject</button>
            </div>
        </header>

        <!-- Subject Grid -->
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:16px; align-items:stretch;">
            ${subs.length === 0 ?
            `<div style="grid-column:1/-1; text-align:center; padding:4rem; border:2px dashed #e2e8f0; border-radius:16px; color:#94a3b8;">
                    No subjects added yet. Click "Add Subject" to begin.
                </div>`
            : subs.sort((a, b) => {
                const pMap = { high: 3, medium: 2, low: 1 };
                return (pMap[b.priority || 'medium'] || 0) - (pMap[a.priority || 'medium'] || 0);
            }).map(s => renderSubjectCard(s)).join('')}
        </div>

        <!-- Modal Overlay -->
        <div id="sub-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:100; backdrop-filter:blur(4px); place-items:center;">
            <div class="card" style="width:90%; max-width:600px; padding:20px; max-height:90vh; overflow-y:auto; animation:fadeUp 0.3s ease-out;">
                <div class="flex-between" style="margin-bottom:1.5rem;">
                    <h2 id="modal-title" style="font-size:1.5rem;">Add Subject</h2>
                    <button id="close-modal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                
                <form id="full-sub-form">
                    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem; margin-bottom:1rem;">
                        <div class="input-group">
                            <label>Subject Name</label>
                            <input id="f-name" placeholder="e.g. Data Structures" required>
                        </div>
                        <div class="input-group">
                            <label>Credits</label>
                            <input type="number" id="f-credits" min="0" max="10" required>
                        </div>
                    </div>

                    <div style="background:#f8fafc; padding:20px; border-radius:12px; margin-bottom:1rem;">
                        <label style="display:block; font-weight:600; margin-bottom:0.75rem; font-size:0.9rem;">Weekly Schedule</label>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px;">
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Theory (1hr)</label>
                                <input type="number" id="f-theory" min="0" value="0">
                            </div>
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Tutorial (1hr)</label>
                                <input type="number" id="f-tut" min="0" value="0">
                            </div>
                            <div class="input-group">
                                <label style="font-size:0.8rem;">Lab Sess (1hr)</label>
                                <input type="number" id="f-lab" min="0" value="0">
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:16px; margin-bottom:1rem;">
                        <div class="input-group">
                            <label>Evaluation Type</label>
                            <select id="f-eval">
                                <option value="internal">Internal Only</option>
                                <option value="internal_end" selected>Internal + End Term</option>
                            </select>
                        </div>
                         <div class="input-group">
                            <label>Total Hours (Sem)</label>
                            <input type="number" id="f-total-classes" value="40" required>
                        </div>
                        <div class="input-group">
                            <label>Priority</label>
                            <select id="f-priority">
                                <option value="high">High</option>
                                <option value="medium" selected>Medium</option>
                                <option value="low">Low</option>
                            </select>
                        </div>
                    </div>

                    <div id="marks-split" style="background:#eff6ff; padding:20px; border-radius:12px; margin-bottom:1.5rem; display:none;">
                         <label style="display:block; font-weight:600; margin-bottom:0.75rem; font-size:0.9rem; color:#1e40af;">Marks Distribution</label>
                         <div style="display:flex; align-items:center; gap:16px;">
                            <div class="input-group" style="flex:1">
                                <label>Internal</label>
                                <input type="number" id="f-internal" value="50">
                            </div>
                            <div style="font-weight:bold; padding-top:1rem;">+</div>
                            <div class="input-group" style="flex:1">
                                <label>End Term</label>
                                <input type="number" id="f-end" value="50">
                            </div>
                         </div>
                    </div>

                    <div id="internal-only-box" style="background:#f0fdf4; padding:20px; border-radius:12px; margin-bottom:1.5rem; display:none;">
                        <div class="input-group">
                            <label style="color:#15803d; font-weight:600;">Total Internal Marks</label>
                            <input type="number" id="f-internal-only" value="50">
                        </div>
                    </div>

                    <button class="btn" style="width:100%;">Save Subject</button>
                    <div style="text-align:center; margin-top:10px;">
                        <button type="button" id="delete-btn" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.9rem; display:none;">Delete Subject</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupLogic(container);
}

function renderSubjectCard(s: Subject) {
    return `
        <div class="card subject-card" data-id="${s.id}" style="cursor:pointer; position:relative;">
            <div class="flex-between" style="margin-bottom:1rem;">
                <h3 style="font-size:1.1rem; font-weight:700;">
                    ${s.name}
                    ${s.priority === 'high'
            ? `<span style="font-size:0.6rem; vertical-align:middle; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px; margin-left:6px;">HIGH</span>`
            : ''}
                </h3>
                <div style="display:flex; gap:5px; align-items:center;">
                    <span style="background:var(--color-primary-light); color:var(--color-primary); padding:4px 10px; border-radius:20px; font-size:0.75rem; font-weight:700;">
                        ${s.credits} Credits
                    </span>
                    <button style="border:none; background:none; cursor:pointer;" title="Edit Subject">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                </div>
            </div>
            
            <div style="display:flex; gap:1rem; margin-bottom:1rem;">
                <div style="background:#f1f5f9; padding:6px 10px; border-radius:8px; font-size:0.8rem; flex:1; text-align:center;">
                    <div style="font-weight:600; color:#64748b;">Theory</div>
                    <div>${s.breakdown?.theory || 0}</div>
                </div>
                <div style="background:#f1f5f9; padding:6px 10px; border-radius:8px; font-size:0.8rem; flex:1; text-align:center;">
                    <div style="font-weight:600; color:#64748b;">Tut</div>
                    <div>${s.breakdown?.tutorial || 0}</div>
                </div>
                <div style="background:#f1f5f9; padding:6px 10px; border-radius:8px; font-size:0.8rem; flex:1; text-align:center;">
                    <div style="font-weight:600; color:#64748b;">Lab</div>
                    <div>${s.breakdown?.lab || 0}</div>
                </div>
            </div>

            <div style="font-size:0.85rem; color:#64748b; padding-top:1rem; border-top:1px solid #f1f5f9;">
                <div class="flex-between mb-1">
                    <span>Evaluation:</span>
                    <span style="font-weight:500; color:#334155;">
                        ${s.evalType === 'internal' ? `Internal Only (${s.marks.internalMax})` : `Int: ${s.marks.internalMax} / End: ${s.marks.endTermMax}`}
                    </span>
                </div>
                <div class="flex-between">
                    <span>Est. Classes:</span>
                    <span style="font-weight:500; color:#334155;">${s.totalClasses}</span>
                </div>
            </div>
        </div>
    `;
}

function setupLogic(container: HTMLElement) {
    const modal = $<HTMLDivElement>('#sub-modal');
    const form = $<HTMLFormElement>('#full-sub-form');
    const evalSelect = $<HTMLSelectElement>('#f-eval');
    const splitBox = $<HTMLDivElement>('#marks-split');
    const delBtn = $<HTMLButtonElement>('#delete-btn');

    // Toggle logic
    const toggleModal = (show: boolean) => {
        modal.style.display = show ? 'grid' : 'none';
        if (!show) {
            form.reset();
            splitBox.style.display = 'none';
            editingSubjectId = null;
            delBtn.style.display = 'none';
            $('#modal-title').textContent = 'Add Subject';
        }
    };

    $('#add-sub-btn').addEventListener('click', () => toggleModal(true));
    $('#close-modal').addEventListener('click', async () => {
        if (await Modal.confirm("Discard changes and close?", "Unsaved Changes")) {
            toggleModal(false);
        }
    });

    // Smart Defaults
    const creditInput = $<HTMLInputElement>('#f-credits');
    const classesInput = $<HTMLInputElement>('#f-total-classes');
    creditInput.addEventListener('input', () => {
        const c = parseInt(creditInput.value) || 0;
        let classes = 15; // Default for 0 or 1
        if (c > 1) {
            classes = c * 15;
        }
        classesInput.value = classes.toString();
    });

    // Eval logic
    const updateEvalUI = () => {
        if (evalSelect.value === 'internal_end') {
            splitBox.style.display = 'block';
            $<HTMLDivElement>('#internal-only-box').style.display = 'none';
        } else {
            splitBox.style.display = 'none';
            $<HTMLDivElement>('#internal-only-box').style.display = 'block';
        }
    };
    evalSelect.addEventListener('change', updateEvalUI);

    // Edit logic
    container.querySelectorAll('.subject-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.getAttribute('data-id') || '0');
            const sub = store.getData()?.subjects.find(s => s.id === id);
            if (sub) {
                editingSubjectId = id;
                $('#modal-title').textContent = 'Edit Subject';
                delBtn.style.display = 'inline-block';

                // Populate
                $<HTMLInputElement>('#f-name').value = sub.name;
                $<HTMLInputElement>('#f-credits').value = sub.credits.toString();
                $<HTMLInputElement>('#f-total-classes').value = sub.totalClasses.toString();

                $<HTMLInputElement>('#f-theory').value = (sub.breakdown?.theory || 0).toString();
                $<HTMLInputElement>('#f-tut').value = (sub.breakdown?.tutorial || 0).toString();
                $<HTMLInputElement>('#f-lab').value = (sub.breakdown?.lab || 0).toString();

                evalSelect.value = sub.evalType;

                if (sub.evalType === 'internal_end') {
                    $<HTMLInputElement>('#f-internal').value = sub.marks.internalMax.toString();
                    $<HTMLInputElement>('#f-end').value = sub.marks.endTermMax.toString();
                } else {
                    $<HTMLInputElement>('#f-internal-only').value = sub.marks.internalMax.toString();
                }
                $<HTMLSelectElement>('#f-priority').value = sub.priority || 'medium';
                updateEvalUI();

                toggleModal(true);
            }
        });
    });

    // Delete
    delBtn.addEventListener('click', async () => {
        if (editingSubjectId && await Modal.confirm('Delete this subject?', 'Confirm Delete', true)) {
            const currentSubs = store.getData()?.subjects || [];
            store.updateUserData({ subjects: currentSubs.filter(s => s.id !== editingSubjectId) });
            toggleModal(false);
            renderSubjects(container);
        }
    });

    // Save
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const type = evalSelect.value as 'internal' | 'internal_end';
        let iMax = 100, eMax = 0;

        if (type === 'internal_end') {
            iMax = parseInt($<HTMLInputElement>('#f-internal').value) || 50;
            eMax = parseInt($<HTMLInputElement>('#f-end').value) || 50;
        } else {
            // For Internal Only, we ensure End Term is 0 and Internal is capturing the total
            iMax = parseInt($<HTMLInputElement>('#f-internal-only').value) || 100;
            eMax = 0;
        }

        const newSub: Subject = {
            id: editingSubjectId || Date.now(),
            name: $<HTMLInputElement>('#f-name').value,
            credits: parseInt($<HTMLInputElement>('#f-credits').value),
            totalClasses: parseInt($<HTMLInputElement>('#f-total-classes').value),
            breakdown: {
                theory: parseInt($<HTMLInputElement>('#f-theory').value) || 0,
                tutorial: parseInt($<HTMLInputElement>('#f-tut').value) || 0,
                lab: parseInt($<HTMLInputElement>('#f-lab').value) || 0,
            },
            evalType: type,
            marks: { internalMax: iMax, endTermMax: eMax },
            priority: $<HTMLSelectElement>('#f-priority').value as any
        };

        const currentSubs = store.getData()?.subjects || [];

        let updatedSubs;
        if (editingSubjectId) {
            updatedSubs = currentSubs.map(s => s.id === editingSubjectId ? newSub : s);
        } else {
            updatedSubs = [...currentSubs, newSub];
        }

        store.updateUserData({ subjects: updatedSubs });
        toggleModal(false);
        renderSubjects(container);
    });
}
