import { store } from '../store';
import { $ } from '../utils';
import { renderTimetable } from './tt';
import { Modal } from '../ui/modal';

export function renderOnboarding(container: HTMLElement, onComplete: () => void) {
    let step = 1;
    let setupData: any = {
        semesterConfig: {},
        subjects: []
    };
    // Clean up old listeners if any (though usually renderOnboarding called once per clean load)
    // Event Delegation for robustness
    // Clean up old listeners
    container.onclick = null; // Remove any previous global listeners to prevent conflicts

    const renderStep = () => {
        container.innerHTML = `
            <div class="onboarding-wrapper" style="max-width:850px; margin:0 auto; padding-top:3rem; font-family:'Inter', sans-serif;">
                <!-- Header -->
                <div style="text-align:center; margin-bottom:2rem;">
                     <h1 style="font-size:2rem; color:var(--color-primary); margin-bottom:0.5rem;">Setup Your Academic Profile</h1>
                     <p style="color:var(--color-text-muted);">Let's personalize your experience in 3 simple steps.</p>
                </div>

                <!-- Stepper -->
                <div style="display:flex; justify-content:center; align-items:center; gap:1rem; margin-bottom:3rem;">
                    <div style="display:flex; align-items:center; gap:8px; opacity:${step >= 1 ? 1 : 0.5}">
                        <div style="width:32px; height:32px; border-radius:50%; background:${step >= 1 ? 'var(--color-primary)' : '#e2e8f0'}; color:white; display:grid; place-items:center; font-weight:700;">1</div>
                        <span style="font-weight:600; color:${step >= 1 ? 'var(--color-primary)' : '#64748b'};">Identity</span>
                    </div>
                    <div style="width:50px; height:2px; background:#e2e8f0;"></div>
                    <div style="display:flex; align-items:center; gap:8px; opacity:${step >= 2 ? 1 : 0.5}">
                        <div style="width:32px; height:32px; border-radius:50%; background:${step >= 2 ? 'var(--color-primary)' : '#e2e8f0'}; color:white; display:grid; place-items:center; font-weight:700;">2</div>
                        <span style="font-weight:600; color:${step >= 2 ? 'var(--color-primary)' : '#64748b'};">Academics</span>
                    </div>
                     <div style="width:50px; height:2px; background:#e2e8f0;"></div>
                    <div style="display:flex; align-items:center; gap:8px; opacity:${step >= 3 ? 1 : 0.5}">
                        <div style="width:32px; height:32px; border-radius:50%; background:${step >= 3 ? 'var(--color-primary)' : '#e2e8f0'}; color:white; display:grid; place-items:center; font-weight:700;">3</div>
                        <span style="font-weight:600; color:${step >= 3 ? 'var(--color-primary)' : '#64748b'};">Schedule</span>
                    </div>
                </div>

                <div class="card" style="padding:2.5rem; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
                    ${getStepContent(step)}
                </div>
            </div>
        `;

        if (step === 3) {
            renderTimetable($('#tt-wrapper'));
        }

        setupHandlers();
    };

    const getStepContent = (s: number) => {
        // Step 1: Student & Academic Context
        if (s === 1) {
            const user = store.getCurrentUser();
            return `
            <div style="animation:fadeUp 0.3s ease-out;">
                <h2 style="font-size:1.5rem; margin-bottom:1.5rem;">Student Identity</h2>
                <form id="step1-form">
                    <div class="input-group">
                        <label>Full Name</label>
                        <input id="s1-name" value="${user?.name || ''}" required>
                    </div>
                    <div class="split" style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                         <div class="input-group">
                            <label>College / University <small>(Optional)</small></label>
                            <input id="s1-college" placeholder="e.g. IIT Delhi">
                        </div>
                        <div class="input-group">
                            <label>Academic Program</label>
                            <input id="s1-program" placeholder="e.g. B.Tech Computer Science" required>
                        </div>
                    </div>
                    <div class="input-group" style="width:50%;">
                         <label>Current Semester</label>
                         <input type="number" id="s1-sem" value="1" min="1" max="10" required>
                    </div>

                    <div style="display:flex; justify-content:space-between; margin-top:2rem;">
                         <button type="button" id="cancel-setup" class="btn btn-secondary" style="border-color:#ef4444; color:#ef4444;">Cancel</button>
                         <button class="btn" style="padding:0.75rem 2rem;">Continue &rarr;</button>
                    </div>
                </form>
            </div>
            `;
        }

        // Step 2: Semester & Subject Structure
        if (s === 2) return `
             <div style="animation:fadeUp 0.3s ease-out;">
                <div class="flex-between">
                    <h2 style="font-size:1.5rem; margin-bottom:1rem;">Semester Config & Subjects</h2>
                    <button class="btn btn-secondary btn-small" id="back-step">Back</button>
                </div>
                
                <div style="background:#f0f9ff; padding:1.5rem; border-radius:12px; margin-bottom:2rem; border:1px solid #bae6fd;">
                    <h4 style="margin-bottom:1rem; color:#0369a1;">Semester Dates & Criteria</h4>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem;">
                        <div class="input-group">
                            <label>Start Date</label>
                            <input type="date" id="s2-start" value="${setupData.semesterConfig.startDate || ''}" required>
                        </div>
                        <div class="input-group">
                            <label>End Date</label>
                            <input type="date" id="s2-end" value="${setupData.semesterConfig.endDate || ''}" required>
                        </div>
                         <div class="input-group">
                            <label>Min Attendance (%)</label>
                            <input type="number" id="s2-att" value="${setupData.semesterConfig.minAttendance || 75}" min="1" max="100">
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:1rem;">
                    <h4 style="margin-bottom:0.5rem;">Add Subjects</h4>
                    <p style="font-size:0.9rem; color:#64748b; margin-bottom:1rem;">Add courses to configure attendance and CGPA.</p>
                    
                    <form id="s2-sub-form" style="background:#f8fafc; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0;">
                         <div class="input-group"><label>Subject Name</label><input id="sub-name" placeholder="e.g. Data Structures" required></div>
                         
                         <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                            <div class="input-group"><label>Credits</label><input type="number" id="sub-cred" value="4" required></div>
                             <div class="input-group"><label>Eval Type</label>
                                <select id="sub-eval">
                                    <option value="internal_end" selected>Int + End</option>
                                    <option value="internal">Internal Only</option>
                                </select>
                            </div>
                             <div class="input-group"><label>Priority</label>
                                <select id="sub-priority">
                                    <option value="high">High</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                         </div>

                         <!-- Marks & Hours -->
                         <div style="display:grid; grid-template-columns: 2fr 3fr; gap:1rem;">
                             <div id="marks-config" style="background:white; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                                  <!-- Dynamic -->
                             </div>
                             <div style="background:white; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
                                  <label style="font-size:0.8rem; font-weight:600; display:block; margin-bottom:8px;">Weekly Schedule</label>
                                  <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                                      <div class="input-group" style="margin-bottom:0;">
                                          <label style="font-size:0.7rem;">Theory (1hr)</label>
                                          <input type="number" id="h-theory" value="3" min="0">
                                      </div>
                                      <div class="input-group" style="margin-bottom:0;">
                                          <label style="font-size:0.7rem;">Tutorial (1hr)</label>
                                          <input type="number" id="h-tut" value="0" min="0">
                                      </div>
                                      <div class="input-group" style="margin-bottom:0;">
                                          <label style="font-size:0.7rem;">Lab Sessions (1hr)</label>
                                          <input type="number" id="h-lab" value="0" min="0">
                                      </div>
                                  </div>
                             </div>
                         </div>
                         
                         <div class="input-group" style="margin-top:1rem;">
                              <label>Total Hours (Sem)</label>
                              <input type="number" id="sub-total" value="45" required>
                              <small style="color:#64748b;">Total estimated hours for lectures and labs for this subject.</small>
                         </div>

                         <button type="submit" class="btn btn-secondary btn-small" style="margin-top:1rem; width:100%;">+ Add Subject to List</button>
                    </form>
                </div>

                <div id="sub-list-display" style="max-height:200px; overflow-y:auto; border:1px solid #eee; border-radius:8px; padding:1rem; margin-bottom:2rem;">
                     ${setupData.subjects.length === 0 ? '<p style="text-align:center; color:gray">No subjects added yet.</p>' : ''}
                     ${setupData.subjects.map((sub: any) => `
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #f1f5f9;">
                            <div>
                                <div style="font-weight:600;">${sub.name} <span style="font-size:0.75rem; background:#eff6ff; color:var(--color-primary); padding:2px 6px; border-radius:4px;">${sub.credits}cr</span></div>
                                <div style="font-size:0.8rem; color:#64748b;">${sub.breakdown.theory}L-${sub.breakdown.tutorial}T-${sub.breakdown.lab}P • ${sub.priority}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div style="display:flex; justify-content:flex-end;">
                     <button class="btn" id="next-step-2">Continue to Timetable &rarr;</button>
                </div>
            </div>
        `;

        // Step 3: Timetable & Preferences
        if (s === 3) return `
            <div style="animation:fadeUp 0.3s ease-out;">
                <div class="flex-between">
                    <h2 style="font-size:1.5rem; margin-bottom:1rem;">Schedule & Preferences</h2>
                    <button class="btn btn-secondary btn-small" id="back-step">Back</button>
                </div>

                <div style="margin-bottom:2rem;">
                    <div class="flex-between" style="margin-bottom:0.5rem;">
                         <label style="font-weight:600;">Weekly Timetable</label>
                         <p style="font-size:0.85rem; color:#64748b;">Drag subjects to grid</p>
                    </div>
                    <div id="tt-wrapper" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; height:400px;"></div>
                </div>

                <div style="background:#f8fafc; padding:1.5rem; border-radius:12px; margin-bottom:2rem;">
                     <h4 style="margin-bottom:1rem;">Final Preferences</h4>
                     <div class="input-group">
                        <label>CGPA Calculation Mode</label>
                        <select id="s3-cgpa">
                            <option value="grade" selected>Grade Based (O, A+...)</option>
                            <option value="marks">Marks Based (Internal + End)</option>
                        </select>
                        <small style="color:#64748b;">You can change this anytime later.</small>
                    </div>
                </div>

                <button class="btn" id="finish-setup" style="width:100%; padding:1rem; font-size:1.1rem;">Complete Setup 🎉</button>
            </div>
        `;
        return '';
    };

    const setupHandlers = () => {
        if (step === 1) {
            $('#step1-form').addEventListener('submit', (e) => {
                e.preventDefault();
                // Save Context temporarily
                setupData.context = {
                    name: $<HTMLInputElement>('#s1-name').value,
                    college: $<HTMLInputElement>('#s1-college').value,
                    program: $<HTMLInputElement>('#s1-program').value,
                    semester: parseInt($<HTMLInputElement>('#s1-sem').value)
                };
                step++; renderStep();
            });

            const cancelBtn = document.getElementById('cancel-setup');
            if (cancelBtn) {
                cancelBtn.onclick = async (e) => {
                    e.preventDefault();

                    const user = store.getCurrentUser();
                    // If adding a new semester (not the first one), warn about deleting it
                    if (user && user.currentSemesterId > 1) {
                        if (await Modal.confirm(`Stop setup and delete Semester ${user.currentSemesterId}?`)) {
                            store.deleteSemester(user.currentSemesterId);
                            location.reload();
                        }
                    } else {
                        // Initial setup
                        if (await Modal.confirm("Cancel setup and return to home?", "Cancel Setup")) {
                            window.location.href = '/';
                        }
                    }
                };
            }
        }

        if (step === 2) {
            $('#back-step').addEventListener('click', () => { step--; renderStep(); });

            import('../datepicker').then(({ DatePicker }) => {
                // Only init if validation passes or elements exist.
                // Value is pre-filled by HTML if exists in setupData.
                new DatePicker('#s2-start');
                new DatePicker('#s2-end');
            });

            // Subject Form Logic
            const marksDiv = $<HTMLDivElement>('#marks-config');
            const evalSelect = $<HTMLSelectElement>('#sub-eval');

            const updateMarks = () => {
                const v = evalSelect.value;
                let h = '';
                if (v === 'internal_end') {
                    h = `<div style="display:flex; gap:10px;">
                            <div class="input-group"><label style="font-size:0.75rem">Int Max</label><input type="number" id="m-int" value="50"></div>
                            <div class="input-group"><label style="font-size:0.75rem">End Max</label><input type="number" id="m-end" value="50"></div>
                         </div>`;
                } else if (v === 'internal') {
                    h = `<div class="input-group"><label style="font-size:0.75rem">Int Max</label><input type="number" id="m-int" value="50"></div>`;
                } else if (v === 'end_term') {
                    h = `<div class="input-group"><label style="font-size:0.75rem">End Max</label><input type="number" id="m-end" value="100"></div>`;
                }
                marksDiv.innerHTML = h;
            };
            evalSelect.addEventListener('change', updateMarks);
            updateMarks();

            $('#s2-sub-form').addEventListener('submit', async (e) => {
                e.preventDefault(); // CRITICAL: Stop reload

                try {
                    // Capture current input state for Persistence
                    setupData.semesterConfig.startDate = $<HTMLInputElement>('#s2-start').value;
                    setupData.semesterConfig.endDate = $<HTMLInputElement>('#s2-end').value;
                    setupData.semesterConfig.minAttendance = parseInt($<HTMLInputElement>('#s2-att').value);

                    const name = $<HTMLInputElement>('#sub-name').value;
                    const credits = parseInt($<HTMLInputElement>('#sub-cred').value);
                    const evalType = $<HTMLSelectElement>('#sub-eval').value;
                    const priority = $<HTMLSelectElement>('#sub-priority').value;

                    // Safe Selection for Conditional Inputs
                    const mIntInput = document.getElementById('m-int') as HTMLInputElement | null;
                    const mEndInput = document.getElementById('m-end') as HTMLInputElement | null;

                    const iMax = mIntInput ? (parseInt(mIntInput.value) || 0) : 0;
                    const eMax = mEndInput ? (parseInt(mEndInput.value) || 0) : 0;

                    const th = parseInt($<HTMLInputElement>('#h-theory').value) || 0;
                    const tu = parseInt($<HTMLInputElement>('#h-tut').value) || 0;
                    const la = parseInt($<HTMLInputElement>('#h-lab').value) || 0;
                    const totalClasses = parseInt($<HTMLInputElement>('#sub-total').value) || 45;

                    setupData.subjects.push({
                        id: Date.now(),
                        name, credits, evalType, priority,
                        breakdown: { theory: th, tutorial: tu, lab: la },
                        totalClasses,
                        marks: { internalMax: iMax, endTermMax: eMax }
                    });

                    // Reset name & focus for rapid entry
                    $<HTMLInputElement>('#sub-name').value = '';
                    $<HTMLInputElement>('#sub-name').focus();

                    // Update the list display without full re-render (optional, but safer to re-render to match state)
                    renderStep();
                } catch (err) {
                    console.error("Form Error:", err);
                    await Modal.alert("Error adding subject. Please check inputs.");
                }
            });

            $('#next-step-2').addEventListener('click', async () => {
                if (setupData.subjects.length === 0) { await Modal.alert("Please add at least one subject."); return; }
                const start = $<HTMLInputElement>('#s2-start').value;
                const end = $<HTMLInputElement>('#s2-end').value;
                if (!start || !end) { await Modal.alert("Please set semester dates."); return; }

                setupData.semesterConfig = {
                    startDate: start,
                    endDate: end,
                    minAttendance: parseInt($<HTMLInputElement>('#s2-att').value)
                };

                // Persist partial state (Subjects)
                store.updateUserData({ subjects: setupData.subjects });
                step++; renderStep();
            });
        }

        if (step === 3) {
            $('#back-step').addEventListener('click', () => { step--; renderStep(); });
            $('#finish-setup').addEventListener('click', () => {
                const cgpaMode = $<HTMLSelectElement>('#s3-cgpa').value;

                // Final Save
                // 1. Update Profile Context
                const ctx = setupData.context;
                store.updateUserProfile({
                    name: ctx.name,
                    collegeName: ctx.college,
                    programName: ctx.program,
                    currentSemesterId: ctx.semester
                });

                // 2. Update Semester Data (Config + Prefs + SetupComplete)
                store.updateUserData({
                    semesterConfig: setupData.semesterConfig,
                    preferences: { cgpaMode: cgpaMode as 'grade' | 'marks' },
                    setupComplete: true
                });

                onComplete();
            });
        }
    };

    renderStep();
}
