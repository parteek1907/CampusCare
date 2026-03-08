import { store } from '../store';
import { $ } from '../utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateSubjectAttendance } from './stats';

const GRADE_POINTS: { [key: string]: number } = {
    'O': 10, 'A+': 9, 'A': 8, 'B+': 7, 'B': 6, 'C': 5, 'F': 0
};

const MARKS_TO_GRADE = (percent: number) => {
    if (percent >= 90) return 'O';
    if (percent >= 80) return 'A+';
    if (percent >= 70) return 'A';
    if (percent >= 60) return 'B+';
    if (percent >= 50) return 'B';
    if (percent >= 40) return 'C';
    return 'F';
};

// State for "Other" mode
interface OtherSubject {
    id: number;
    name: string;
    credits: number;
    grade: string;
}

let activeMode: 'me' | 'other' = 'me';
let entryMode: 'grade' | 'marks' = 'grade';
let isSimulator: boolean = false;
let simGrades: any[] = []; // Temporary buffer for simulator

let calcTabMode: 'sgpa' | 'whatif' = 'sgpa';

let otherSubjects: OtherSubject[] = [
    { id: 1, name: 'Subject 1', credits: 4, grade: 'O' },
    { id: 2, name: 'Subject 2', credits: 4, grade: 'O' }
];

export function renderCGPA(container: HTMLElement) {
    const data = store.getData();
    if (!data) return;
    const isLoading = document.getElementById('app')?.classList.contains('is-loading-data');

    container.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <header style="margin-bottom: 2rem;">
                <h1 style="font-size: 2.5rem; color: #1e293b; margin-bottom: 0.5rem;">CGPA Calculator</h1>
                <p style="font-size: 1.1rem; color: #64748b;">Calculate your academic performance or simulate scenarios.</p>
                
                <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1rem;">
                     <!-- Controls -->
                     ${activeMode === 'me' ? `<button id="mode-toggle" class="btn btn-secondary btn-small">${entryMode === 'grade' ? 'Input Marks' : 'Input Grades'}</button>` : ''}
                </div>
            </header>

            <!-- Formula Section -->
            <div style="display:flex; justify-content:center; margin-bottom: 3rem;">
                <div style="font-family: 'Times New Roman', serif; font-size: 1.5rem; font-style: italic;">
                    CGPA = 
                    <span style="display:inline-flex; flex-direction:column; align-items:center; vertical-align:middle; margin:0 10px;">
                        <span style="border-bottom:1px solid #000; padding:0 5px;">&sum;<sub style="font-size:0.8rem">i=1</sub><sup>n</sup>(grade<sub>i</sub> * credit<sub>i</sub>)</span>
                        <span>&sum;<sub style="font-size:0.8rem">i=1</sub><sup>n</sup> credit<sub>i</sub></span>
                    </span>
                </div>
            </div>

            <div class="cgpa-split-layout">
                <!-- Left: Grade Table Reference -->
                <div class="card" style="padding:20px; overflow:hidden; height:fit-content;">
                    <button id="toggle-table" style="width:100%; text-align:left; padding:10px; background:#f8fafc; border:none; border-bottom:1px solid #e2e8f0; font-weight:600; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                        Grade Table
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <div style="padding:1.5rem;">
                        <table style="width:100%; border-collapse:separate; border-spacing:0;">
                            <thead>
                                <tr style="background:#f1f5f9;">
                                    <th style="padding:12px; text-align:left; border-radius:6px 0 0 6px;">Marks</th>
                                    <th style="padding:12px; text-align:center;">Grade</th>
                                    <th style="padding:12px; text-align:center; border-radius:0 6px 6px 0;">Points</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style="border-bottom:1px solid #eee;"><td style="padding:12px; border-bottom:1px solid #f1f5f9;">90 - 100</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">O</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">10</td></tr>
                                <tr><td style="padding:12px; border-bottom:1px solid #f1f5f9;">80 - 89</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">A+</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">9</td></tr>
                                <tr><td style="padding:12px; border-bottom:1px solid #f1f5f9;">70 - 79</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">A</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">8</td></tr>
                                <tr><td style="padding:12px; border-bottom:1px solid #f1f5f9;">60 - 69</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">B+</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">7</td></tr>
                                <tr><td style="padding:12px; border-bottom:1px solid #f1f5f9;">50 - 59</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">B</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">6</td></tr>
                                <tr><td style="padding:12px; border-bottom:1px solid #f1f5f9;">40 - 49</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">C</td><td style="padding:12px; text-align:center; border-bottom:1px solid #f1f5f9;">5</td></tr>
                                <tr><td style="padding:12px;">< 40</td><td style="padding:12px; text-align:center;">F</td><td style="padding:12px; text-align:center;">0</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Right: Calculator Input -->
                <div class="card" style="padding:20px; overflow:hidden;">
                    
                    <!-- Goal Calculator Toggle -->
                    <div style="padding:1.5rem; border-bottom:1px solid #e2e8f0; display:flex; justify-content:center; gap:10px; background:#f8fafc;">
                        <button id="toggle-sgpa-calc" class="pill-toggle ${calcTabMode === 'sgpa' ? 'active' : ''}">🎯 Calculate SGPA</button>
                        <button id="toggle-whatif-calc" class="pill-toggle ${calcTabMode === 'whatif' ? 'active' : ''}">🤔 What Do I Need?</button>
                    </div>

                    <!-- SGPA Calc Panel -->
                    <div style="${calcTabMode === 'sgpa' ? '' : 'display:none;'}">
                        <!-- Tabs -->
                        <div style="display:flex; border-bottom:1px solid #e2e8f0;">
                         <button id="tab-me" class="tab-btn ${activeMode === 'me' ? 'active' : ''}">Calculate for Me</button>
                         <button id="tab-other" class="tab-btn ${activeMode === 'other' ? 'active' : ''}">Calculate for Other</button>
                    </div>

                    <div style="padding:2rem;">
                         <div class="flex-between" style="margin-bottom:2rem;">
                            <h2 style="font-size:1.25rem;">
                                ${activeMode === 'me' ? 'My Subjects' : 'Custom Calculator'}
                                ${isSimulator ? '<span style="font-size:0.8rem; background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:20px; margin-left:8px;">SIMULATOR ACTIVE - Changes not saved</span>' : ''}
                            </h2>
                            
                            <div style="text-align:right;">
                                ${activeMode === 'me' ?
            `<button class="btn btn-small" onclick="document.querySelector('[data-target=subjects]').click()">Manage Subjects</button>` :
            `<button class="btn btn-small" id="add-other-row">+ Add Subject</button>`
        }
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 3fr 1fr 1fr 40px; gap:10px; padding-bottom:10px; border-bottom:1px solid #eee; margin-bottom:1rem; color:#64748b; font-size:0.9rem;">
                            <div>Subject</div>
                            <div style="text-align:center;">Credits</div>
                            <div>${entryMode === 'grade' ? 'Grade' : 'Marks (Int / End)'}</div>
                            <div></div>
                        </div>

                        <div id="cgpa-rows" style="display:flex; flex-direction:column; gap:10px;"></div>

                        <div style="margin-top:2rem; text-align:right;">
                            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:12px;">
                                <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:20px; width:100%;">
                                    <button id="export-pdf-report" class="btn btn-secondary btn-small" style="height:fit-content; border-color:var(--color-primary); color:var(--color-primary);">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        Download Report
                                    </button>
                                    <div>
                                         <div style="font-size:0.9rem; color:gray;">Calculated SGPA</div>
                                         <div id="current-sgpa" style="font-size:2.5rem; font-weight:800; color:var(--color-primary);">0.00</div>
                                    </div>
                                </div>
                                <!-- Save SGPA Button Placeholder -->
                                ${activeMode === 'me' && !isSimulator ? `
                                    <button id="save-sgpa-btn" class="btn btn-small" style="width:100%; background:transparent; border:1px solid #2563eb; color:#2563eb; transition: background 0.2s; margin-top:12px;" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='transparent'">
                                        💾 Save SGPA to History
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    </div> <!-- End sgpa-calc-panel -->

                    <!-- Goal Calculator Panel -->
                    <div style="${calcTabMode === 'whatif' ? '' : 'display:none;'} padding:2rem;">
                         <div style="display:flex; flex-direction:column; gap:1.5rem; margin-bottom:2rem;">
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#475569; font-size:0.95rem;">My target CGPA</label>
                                <input type="number" id="whatif-target" class="calc-field" placeholder="e.g. 8.5" step="0.01" min="0" max="10" />
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#475569; font-size:0.95rem;">Semesters completed so far</label>
                                <input type="number" id="whatif-completed" class="calc-field" placeholder="e.g. 2" min="0" max="8" />
                            </div>
                            <div>
                                <label style="display:block; margin-bottom:0.5rem; font-weight:600; color:#475569; font-size:0.95rem;">Credits per semester</label>
                                <input type="number" id="whatif-credits" class="calc-field" value="20" min="1" />
                            </div>
                        </div>

                        <button id="whatif-calc-btn" class="btn" style="width:100%;">Calculate</button>

                        <div id="whatif-result-container" style="margin-top:2rem; display:none; text-align:center; padding:20px; border-radius:12px; border:1px solid #e5e7eb; background:#f8fafc; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                             <div id="whatif-result-text" style="font-size:1.1rem; font-weight:700; margin-bottom:0.5rem;"></div>
                             <div id="whatif-result-meta" style="font-size:0.85rem; color:#64748b;"></div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${activeMode === 'me' ? (() => {
            if (isLoading) {
                return `
                    <div style="margin-top:32px; border-top:1px solid #e5e7eb; padding-top:2rem;">
                         <h2 style="font-size:1.5rem; color:#1e293b; margin-bottom:1.5rem;">📈 SGPA Trend</h2>
                         <div style="max-width:100%;">
                             <div class="skeleton" style="height:36px; margin-bottom:1rem; border-radius:6px;"></div>
                             <div class="skeleton" style="height:36px; margin-bottom:1rem; border-radius:6px;"></div>
                             <div class="skeleton" style="height:36px; margin-bottom:1rem; border-radius:6px;"></div>
                         </div>
                    </div>
                `;
            }
            const history = store.getAllSgpaHistory();
            if (history.length === 0) {
                return `
                        <div style="background:#f8fafc; border:1px dashed #cbd5e1; border-radius:12px; padding:20px; text-align:center; color:#64748b; margin-top: 2rem;">
                            No SGPA history yet. Calculate and save your first semester to see your trend here.
                        </div>
                    `;
            }

            let totalPoints = 0;
            let totalCreditsSum = 0;

            const barsHtml = history.map(h => {
                totalPoints += h.sgpa * h.totalCredits;
                totalCreditsSum += h.totalCredits;

                const p = Math.min((h.sgpa / 10) * 100, 100);
                let color = '#dc2626'; // red
                if (h.sgpa >= 8) color = '#16a34a'; // green
                else if (h.sgpa >= 6) color = '#ca8a04'; // orange

                const dateStr = new Date(h.savedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                return `
                        <div style="display:flex; align-items:center; gap:15px; margin-bottom:1rem;">
                            <div style="width:150px; font-weight:600; color:#475569; flex-shrink:0;">${h.semesterName}</div>
                            <div style="flex-grow:1;">
                                <div style="height:12px; background:#e2e8f0; border-radius:6px; overflow:hidden;">
                                    <div style="height:100%; width:${p}%; background:${color}; border-radius:6px;"></div>
                                </div>
                                <div style="font-size:0.75rem; color:#94a3b8; margin-top:4px;">Saved on ${dateStr}</div>
                            </div>
                            <div style="width:60px; text-align:right; font-weight:700; font-size:1.1rem; color:#1e293b;">${h.sgpa.toFixed(2)}</div>
                        </div>
                    `;
            }).join('');

            const cgpa = totalCreditsSum ? (totalPoints / totalCreditsSum).toFixed(2) : '0.00';
            const cgpaNum = parseFloat(cgpa);
            let cgpaColor = '#dc2626';
            if (cgpaNum >= 8) cgpaColor = '#16a34a';
            else if (cgpaNum >= 6) cgpaColor = '#ca8a04';

            return `
                    <div style="margin-top:32px; border-top:1px solid #e5e7eb; padding-top:2rem;">
                         <h2 style="font-size:1.5rem; color:#1e293b; margin-bottom:1.5rem;">📈 SGPA Trend</h2>
                         <div style="max-width:100%;">
                             ${barsHtml}
                         </div>
                         <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid #e2e8f0; text-align:center;">
                              <div style="font-size:1.5rem; font-weight:800; color:${cgpaColor};">Cumulative CGPA: ${cgpa}</div>
                              <div style="font-size:0.85rem; color:#64748b; margin-top:4px;">Calculated across ${history.length} semester${history.length !== 1 ? 's' : ''}</div>
                         </div>
                    </div>
                `;
        })() : ''}

        </div>

        <style>
            .cgpa-split-layout { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; align-items: stretch; }
            @media(max-width:900px) { .cgpa-split-layout { grid-template-columns: 1fr; } }
            
            .calc-input-row { display: grid; grid-template-columns: 3fr 1fr 1fr 40px; gap: 10px; align-items: center; }
            .calc-field { background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:8px; width:100%; transition:all 0.2s; box-sizing: border-box;}
            .calc-field:focus { border-color:var(--color-primary); outline:none; }
            
            .pill-toggle { padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; background: white; border: 1px solid #e5e7eb; color: #64748b; }
            .pill-toggle:hover { background: #f8fafc; }
            .pill-toggle.active { background: #2563eb; color: white; border-color: #2563eb; }
            
            .tab-btn { flex:1; padding:1rem; background:white; border:none; cursor:pointer; font-weight:600; color:#64748b; border-bottom:2px solid transparent; }
            .tab-btn:hover { background:#f8fafc; color:#1e293b; }
            .tab-btn.active { color:var(--color-primary); border-bottom-color:var(--color-primary); background:#eff6ff; }
        </style>
    `;

    setupTabs(container);
    renderRows();
}

function setupTabs(container: HTMLElement) {
    // Helper to safely attach a one-time listener (prevents stacking)
    const safeOn = (id: string, event: string, handler: EventListenerOrEventListenerObject) => {
        const el = document.getElementById(id);
        if (!el) return;
        const fresh = el.cloneNode(true) as HTMLElement;
        el.replaceWith(fresh);
        fresh.addEventListener(event, handler);
    };

    safeOn('toggle-sgpa-calc', 'click', () => { calcTabMode = 'sgpa'; renderCGPA(container); });
    safeOn('toggle-whatif-calc', 'click', () => { calcTabMode = 'whatif'; renderCGPA(container); });

    const whatifCalcBtn = document.getElementById('whatif-calc-btn');
    if (whatifCalcBtn) {
        const freshBtn = whatifCalcBtn.cloneNode(true) as HTMLElement;
        whatifCalcBtn.replaceWith(freshBtn);
        freshBtn.addEventListener('click', () => {
            const targetCgpa = parseFloat((document.getElementById('whatif-target') as HTMLInputElement)?.value || '0');
            const completedSems = parseInt((document.getElementById('whatif-completed') as HTMLInputElement)?.value || '0', 10);
            const creditsPerSem = parseInt((document.getElementById('whatif-credits') as HTMLInputElement)?.value || '20', 10);

            if (!targetCgpa || !creditsPerSem) return;

            const history = store.getAllSgpaHistory();
            let sumOfPastSGPA = 0;
            history.forEach(h => sumOfPastSGPA += h.sgpa);

            const totalSemesters = completedSems + 1;
            const requiredSGPA = ((targetCgpa * totalSemesters * creditsPerSem) - (sumOfPastSGPA * creditsPerSem)) / creditsPerSem;

            const resContainer = document.getElementById('whatif-result-container');
            const resText = document.getElementById('whatif-result-text');
            const resMeta = document.getElementById('whatif-result-meta');

            if (resContainer && resText && resMeta) {
                resContainer.style.display = 'block';
                if (requiredSGPA <= 0) {
                    resText.textContent = "You have already achieved your target CGPA! 🎉";
                    resText.style.color = "#16a34a";
                } else if (requiredSGPA > 10) {
                    resText.textContent = "Your target is not achievable this semester. Consider revising your goal.";
                    resText.style.color = "#dc2626";
                } else {
                    resText.textContent = `You need ${requiredSGPA.toFixed(2)} SGPA this semester to reach your target`;
                    resText.style.color = requiredSGPA <= 8 ? "#16a34a" : (requiredSGPA <= 9 ? "#ca8a04" : "#dc2626");
                }
                resMeta.textContent = `Based on ${history.length} saved semester(s) from your history`;
            }
        });
    }

    // Tab switching with state reset
    safeOn('tab-me', 'click', () => {
        activeMode = 'me';
        renderCGPA(container);
    });
    safeOn('tab-other', 'click', () => {
        activeMode = 'other';
        // Reset to 2 fresh empty rows on tab switch
        otherSubjects = [
            { id: Date.now(), name: '', credits: 4, grade: 'O' },
            { id: Date.now() + 1, name: '', credits: 4, grade: 'O' },
        ];
        renderCGPA(container);
    });

    // Add Subject button (only in "other" mode)
    if (activeMode === 'other') {
        safeOn('add-other-row', 'click', () => {
            otherSubjects.push({ id: Date.now(), name: '', credits: 4, grade: 'O' });
            renderRows();
            // Focus the new row's name input
            setTimeout(() => {
                const rows = document.querySelectorAll('#cgpa-rows .calc-input-row');
                const lastRow = rows[rows.length - 1];
                if (lastRow) (lastRow.querySelector('input') as HTMLInputElement)?.focus();
            }, 50);
        });
    }

    // Mode toggle (grade/marks)
    safeOn('mode-toggle', 'click', () => {
        entryMode = (entryMode === 'grade') ? 'marks' : 'grade';
        renderCGPA(container);
    });

    // Export PDF
    safeOn('export-pdf-report', 'click', () => generatePDF('full'));

    // Save SGPA
    const saveSgpaEl = document.getElementById('save-sgpa-btn');
    if (saveSgpaEl) {
        const freshSave = saveSgpaEl.cloneNode(true) as HTMLButtonElement;
        saveSgpaEl.replaceWith(freshSave);
        freshSave.addEventListener('click', () => {
            const user = store.getCurrentUser();
            if (!user) return;
            const currentSgpaText = $('#current-sgpa')?.textContent || '0';
            const sgpaValue = parseFloat(currentSgpaText);

            let totalCredits = 0;
            const subs = store.getData()?.subjects || [];
            const grades = store.getData()?.grades || [];
            subs.forEach(s => {
                if (s.credits <= 0) return;
                const g = grades.find(x => x.subjectId === s.id);
                if (g) totalCredits += s.credits;
            });

            store.saveSgpa(user.currentSemesterId.toString(), sgpaValue, totalCredits);
            console.log("SGPA saved: " + sgpaValue);

            freshSave.innerHTML = '✅ Saved!';
            freshSave.disabled = true;
            freshSave.style.opacity = '0.7';
            freshSave.style.cursor = 'not-allowed';

            setTimeout(() => {
                freshSave.innerHTML = '✅ Already Saved';
                freshSave.title = 'Recalculate to save again';
                freshSave.style.background = 'transparent';
            }, 2000);
        });
    }
}

function renderRows() {
    const container = document.getElementById('cgpa-rows');
    if (!container) return;
    container.innerHTML = '';

    if (activeMode === 'me') {
        renderMeRows(container);
    } else {
        renderOtherRows(container);
    }

    calcTotals();
}

function generatePDF(exportType: 'full' | 'grade' = 'grade') {
    const doc = new jsPDF();
    const user = store.getCurrentUser();
    const currentSem = user?.currentSemesterId || 1;
    const finalGPA = $('#current-sgpa').innerText;
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Helper for Footer
    const addFooter = (doc: jsPDF, pageNumber: number, totalPages?: number) => {
        const str = totalPages ? `Page ${pageNumber} of ${totalPages} ` : `Page ${pageNumber} `;
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text('Generated by CampusCare | Data is indicative only', 14, pageHeight - 10);
        doc.text(str, pageWidth - 14, pageHeight - 10, { align: 'right' });
    };

    let currentUserData = store.getData();

    if (exportType === 'full' && activeMode === 'me') {
        // --- Full Report Cover Page ---
        doc.setFillColor(37, 99, 235); // rgb(37, 99, 235) - Primary Blue
        doc.rect(0, 0, pageWidth, 50, 'F');

        doc.setFontSize(28);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text('CampusCare', 14, 25);

        doc.setFontSize(14);
        doc.setTextColor(226, 232, 240); // slate-200
        doc.setFont('helvetica', 'normal');
        doc.text('Comprehensive Academic Report', 14, 38);

        // Details block
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFontSize(12);

        doc.setFont('helvetica', 'normal');
        doc.text('Student Name:', 14, 80);
        doc.text('Program:', 14, 90);
        doc.text('Semester:', 14, 100);
        doc.text('Generated Date:', 14, 110);

        doc.setFont('helvetica', 'bold');
        doc.text(user?.name || 'N/A', 60, 80);
        doc.text(user?.programName || 'N/A', 60, 90);
        doc.text(`Semester ${currentSem} `, 60, 100);
        doc.text(new Date().toLocaleDateString(), 60, 110);

        // Overall Performance Overview Box
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.5);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 130, pageWidth - 28, 40, 3, 3, 'FD');

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text('Semester Performance Overview', 20, 145);

        doc.setFontSize(24);
        doc.text(`SGPA: ${finalGPA} `, 20, 160);

        addFooter(doc, 1);
        doc.addPage();
        addFooter(doc, 2);

        // --- Attendance Summary Section ---
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text('1. Attendance Summary', 14, 20);

        let attTableData: any[][] = [];
        if (currentUserData) {
            const subs = currentUserData.subjects.filter(s => s.credits > 0);
            subs.forEach(s => {
                const stats = calculateSubjectAttendance(s.id, currentUserData);
                const conducted = stats.conducted;
                const attended = stats.attended;
                const absent = conducted - attended;

                const pct = stats.percentage;
                const formattedPct = conducted === 0 ? '-' : pct.toFixed(1) + '%';

                attTableData.push([s.name, conducted.toString(), attended.toString(), absent.toString(), formattedPct, pct]);
            });
        }

        autoTable(doc, {
            startY: 30,
            head: [['Subject', 'Total Classes', 'Present', 'Absent', 'Percentage']],
            body: attTableData.map(row => row.slice(0, 5)), // Don't print the raw pct number
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235], textColor: 255 },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 4) {
                    const pct = attTableData[data.row.index][5]; // Get raw pct
                    if (pct >= 75) {
                        data.cell.styles.textColor = [21, 128, 61]; // green-700
                        data.cell.styles.fontStyle = 'bold';
                    } else if (pct >= 60) {
                        data.cell.styles.textColor = [194, 65, 12]; // orange-700
                        data.cell.styles.fontStyle = 'bold';
                    } else if (pct > 0 || attTableData[data.row.index][1] !== '0') {
                        data.cell.styles.textColor = [185, 28, 28]; // red-700
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            }
        });

        // --- Grade Performance Section Header ---
        let finalY = (doc as any).lastAutoTable.finalY || 30;

        if (finalY > pageHeight - 60) {
            doc.addPage();
            addFooter(doc, 3);
            finalY = 20;
        } else {
            finalY += 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(30, 41, 59);
        doc.text('2. Academic Performance', 14, finalY);

        // Let the autoTable logic below render from finalY + 10
        (doc as any).overrideStartY = finalY + 10;
        (doc as any).currentPageForGrade = doc.internal.pages.length - 1; // get current page index
    } else {
        // --- Standalone Grade Sheet Header ---
        doc.setFillColor(37, 99, 235);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(24);
        doc.setTextColor(255, 255, 255);
        doc.text('CampusCare', 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(226, 232, 240);
        doc.text('Academic Performance Report', 14, 30);

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.text('Student Name:', 14, 55);
        doc.text('Semester:', 14, 62);
        doc.text('Program:', 14, 69);
        doc.text('Generated On:', 14, 76);

        doc.setFont('helvetica', 'bold');
        doc.text(user?.name || 'N/A', 50, 55);
        doc.text(`Semester ${currentSem} `, 50, 62);
        doc.text(user?.programName || 'N/A', 50, 69);
        doc.text(new Date().toLocaleDateString(), 50, 76);
        doc.setFont('helvetica', 'normal');

        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.5);
        doc.roundedRect(140, 50, 55, 30, 3, 3, 'S');

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text((activeMode === 'me' && !isSimulator) ? 'PROJECTED SGPA' : 'CALCULATED SGPA', 167.5, 60, { align: 'center' });

        doc.setFontSize(22);
        doc.setTextColor(37, 99, 235);
        doc.setFont('helvetica', 'bold');
        doc.text(finalGPA, 167.5, 73, { align: 'center' });
        doc.setFont('helvetica', 'normal');

        (doc as any).overrideStartY = 90;
        addFooter(doc, 1);
    }

    // --- Common Grade Sheet Data Preparation ---
    let tableData: any[][] = [];
    if (activeMode === 'me') {
        const subs = currentUserData?.subjects || [];
        const grades = isSimulator ? simGrades : (currentUserData?.grades || []);

        tableData = subs.filter(s => s.credits > 0).map(s => {
            const g = grades.find(x => x.subjectId === s.id);
            const grade = g?.grade || '-';
            const points = GRADE_POINTS[grade] || 0;
            return [s.name, s.credits, grade, points];
        });
    } else {
        tableData = otherSubjects.map(s => {
            const points = GRADE_POINTS[s.grade] || 0;
            return [s.name, s.credits, s.grade, points];
        });
    }

    // --- Common Grade Table Rendering ---
    autoTable(doc, {
        startY: (doc as any).overrideStartY,
        head: [['Subject Name', 'Credits', 'Grade', 'Points']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [248, 250, 252],
            textColor: [15, 23, 42],
            fontStyle: 'bold',
            lineColor: [226, 232, 240],
            lineWidth: 0.1
        },
        styles: {
            fontSize: 10,
            cellPadding: 6,
            textColor: [51, 65, 85],
            lineColor: [226, 232, 240],
            lineWidth: 0.1
        },
        alternateRowStyles: {
            fillColor: [255, 255, 255]
        },
        columnStyles: {
            0: { cellWidth: 80, fontStyle: 'bold' },
            1: { halign: 'center' },
            2: { halign: 'center', fontStyle: 'bold', textColor: [37, 99, 235] },
            3: { halign: 'center' }
        },
        foot: [['', 'Semester Performance', 'Final SGPA', finalGPA]],
        footStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        },
        willDrawCell: function (data) {
            if (data.section === 'foot' && data.column.index === 1) {
                data.cell.styles.halign = 'right';
                data.cell.styles.fillColor = [255, 255, 255];
                data.cell.styles.textColor = [30, 41, 59];
            }
        }
    });

    if (exportType === 'grade' || (exportType === 'full' && activeMode !== 'me')) {
        // Append bottom disclaimer for simple grade sheets
        let disclaimerY = ((doc as any).lastAutoTable.finalY || 200) + 20;
        if (disclaimerY > pageHeight - 30) {
            doc.addPage();
            addFooter(doc, doc.internal.pages.length - 1); // Adjust for jsPDF pages array
            disclaimerY = 20;
        }

        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('This document is for personal use and informational purposes only.', 105, disclaimerY, { align: 'center' });
        doc.text('Values are calculated based on user input and do not represent official university records.', 105, disclaimerY + 5, { align: 'center' });
    }

    doc.save(`${user?.name.replace(/\s+/g, '_')}_Sem${currentSem}_${exportType === 'full' ? 'Full_Report' : 'Grade_Sheet'}.pdf`);
}

const GRADE_THRESHOLDS = [
    { min: 90, grade: 'O' },
    { min: 80, grade: 'A+' },
    { min: 70, grade: 'A' },
    { min: 60, grade: 'B+' },
    { min: 50, grade: 'B' },
    { min: 40, grade: 'C' },
    { min: 0, grade: 'F' }
];

function renderMeRows(container: HTMLElement) {
    const allSubs = store.getData()?.subjects || [];
    // If Sim, use simGrades, else use store grades
    const grades = isSimulator ? simGrades : (store.getData()?.grades || []);
    const subs = allSubs.filter(s => s.credits > 0);

    if (subs.length === 0) {
        container.innerHTML = `< div style = "text-align:center; padding:2rem; color:gray;" > No subjects found.Add subjects first.</div>`;
        return;
    }

    subs.forEach(sub => {
        let g = grades.find(x => x.subjectId === sub.id);
        if (!g) {
            g = { subjectId: sub.id, mode: 'grade', grade: 'O' };
            grades.push(g);
        }

        const div = document.createElement('div');
        div.className = 'calc-input-row';

        let inputHtml = '';
        let boundaryHtml = '';

        if (entryMode === 'grade') {
            inputHtml = `
                <select class="calc-field" style="cursor:pointer;">
                    ${Object.keys(GRADE_POINTS).map(k => `<option value="${k}" ${g!.grade === k ? 'selected' : ''}>${k}</option>`).join('')}
                </select>`;
        } else {
            const iMax = sub.marks.internalMax || 0;
            const eMax = sub.marks.endTermMax || 0;
            const iOb = g?.internalObtained || 0;
            const eOb = g?.endObtained || 0;
            inputHtml = `
                <div style="display:flex; gap:5px;">
                    <input type="number" class="calc-field marks-i" placeholder="Int (${iMax})" value="${iOb}" min="0" max="${iMax}" title="Internal Marks">
                    ${eMax > 0 ? `<input type="number" class="calc-field marks-e" placeholder="End (${eMax})" value="${eOb}" min="0" max="${eMax}" title="End Term Marks">` : ''}
                </div>
             `;

            // Boundary Logic
            const totalMax = iMax + eMax;
            const totalObt = iOb + eOb;
            const pct = totalMax ? (totalObt / totalMax) * 100 : 0;
            const currentIdx = GRADE_THRESHOLDS.findIndex(t => pct >= t.min);
            if (currentIdx > 0) { // Not already O
                const next = GRADE_THRESHOLDS[currentIdx - 1];
                const neededMarks = Math.ceil((next.min / 100 * totalMax) - totalObt);
                boundaryHtml = `<div style="font-size:0.7rem; color:#64748b; margin-top:2px; text-align:right;">
                    To ${next.grade}: <strong style="color:var(--color-primary);">+${neededMarks}</strong>
                 </div>`;
            } else if (currentIdx === 0 && pct < 100) {
                boundaryHtml = `<div style="font-size:0.7rem; color:#10b981; margin-top:2px; text-align:right;">Max Grade Achieved</div>`;
            }
        }

        div.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <input class="calc-field" value="${sub.name}" readonly style="background:#f1f5f9; color:#64748b;">
                ${(g!.mode === 'marks') ? `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <small style="color:${isSimulator ? '#d97706' : 'var(--color-primary)'}; margin-right:5px;">${g.grade} (${(g.internalObtained || 0) + (g.endObtained || 0)}/${sub.marks.internalMax + sub.marks.endTermMax})</small>
                    </div>
                    ${boundaryHtml}
                ` : ''}
            </div>
            <div class="calc-field" style="text-align:center; background:#f1f5f9;">${sub.credits}</div>
            ${inputHtml}
            <div></div> 
        `;

        if (entryMode === 'grade') {
            div.querySelector('select')!.addEventListener('change', (e) => {
                g!.grade = (e.target as HTMLSelectElement).value;
                g!.mode = 'grade';
                if (!isSimulator) store.updateUserData({ grades });

                // Recalculate totals immediately
                calcTotals();
            });
        } else {
            const iInp = div.querySelector('.marks-i') as HTMLInputElement;
            const eInp = div.querySelector('.marks-e') as HTMLInputElement;
            const gradeDisplay = div.querySelector('small'); // The grade text
            const boundaryContainer = div.firstElementChild!; // Parent of boundary text

            const updateMarks = () => {
                const iVal = iInp ? parseInt(iInp.value) || 0 : 0;
                const eVal = eInp ? parseInt(eInp.value) || 0 : 0;

                // Calc %
                const totalMax = sub.marks.internalMax + sub.marks.endTermMax;
                const totalObt = iVal + eVal;
                const pct = totalMax ? (totalObt / totalMax) * 100 : 0;
                const finalG = MARKS_TO_GRADE(pct);

                g!.grade = finalG;
                g!.mode = 'marks';
                g!.internalObtained = iVal;
                g!.endObtained = eVal;

                // Update UI directly without re-render
                if (gradeDisplay) {
                    gradeDisplay.textContent = `${finalG} (${totalObt}/${totalMax})`;
                }

                // Update Boundary Text
                const currentIdx = GRADE_THRESHOLDS.findIndex(t => pct >= t.min);
                let boundaryHtml = '';
                if (currentIdx > 0) {
                    const next = GRADE_THRESHOLDS[currentIdx - 1];
                    const neededMarks = Math.ceil((next.min / 100 * totalMax) - totalObt);
                    boundaryHtml = `<div style="font-size:0.7rem; color:#64748b; margin-top:2px; text-align:right;">
                        To ${next.grade}: <strong style="color:var(--color-primary);">+${neededMarks}</strong>
                     </div>`;
                } else if (currentIdx === 0 && pct < 100) {
                    boundaryHtml = `<div style="font-size:0.7rem; color:#10b981; margin-top:2px; text-align:right;">Max Grade Achieved</div>`;
                }

                // Remove old boundary if exists (last child of first column div)
                const lastChild = boundaryContainer.lastElementChild;
                if (lastChild && lastChild.tagName === 'DIV' && lastChild !== gradeDisplay?.parentElement) {
                    lastChild.remove();
                }
                if (boundaryHtml) {
                    boundaryContainer.insertAdjacentHTML('beforeend', boundaryHtml);
                }

                if (!isSimulator) store.updateUserData({ grades });

                calcTotals();
            };

            if (iInp) iInp.addEventListener('input', updateMarks);
            if (eInp) eInp.addEventListener('input', updateMarks);
        }

        container.appendChild(div);
    });

    if (!isSimulator && entryMode === 'grade') {
        // Just recalc once attached
        calcTotals();
    }
}

function renderOtherRows(container: HTMLElement) {
    if (otherSubjects.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:gray;">Add subjects to calculate.</div>`;
        return;
    }

    otherSubjects.forEach((sub) => {
        const div = document.createElement('div');
        div.className = 'calc-input-row';

        // Only show delete button if more than 2 rows
        const showDelete = otherSubjects.length > 2;

        div.innerHTML = `
            <input class="calc-field" value="${sub.name}" placeholder="Subject name" type="text" style="flex:1;">
            <input type="number" class="calc-field" value="${sub.credits}" placeholder="Credits" min="1" max="6" style="text-align:center; width:80px;">
            <select class="calc-field" style="cursor:pointer; width:100px;">
                ${Object.keys(GRADE_POINTS).map(k => `<option value="${k}" ${sub.grade === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
            ${showDelete ? `
                <button class="del-btn" style="color:#dc2626; background:none; border:none; cursor:pointer; font-size:1rem; padding:4px 8px;" title="Remove">
                    ×
                </button>
            ` : '<div></div>'}
        `;

        // Bind events
        const nameInput = div.querySelector('input[type="text"]') as HTMLInputElement;
        nameInput.addEventListener('input', () => {
            sub.name = nameInput.value;
        });

        const credInput = div.querySelector('input[type="number"]') as HTMLInputElement;
        credInput.addEventListener('input', () => {
            sub.credits = parseInt(credInput.value) || 0;
            calcTotals();
        });

        const gradeSelect = div.querySelector('select') as HTMLSelectElement;
        gradeSelect.addEventListener('change', () => {
            sub.grade = gradeSelect.value;
            calcTotals();
        });

        if (showDelete) {
            div.querySelector('.del-btn')!.addEventListener('click', () => {
                otherSubjects = otherSubjects.filter(s => s.id !== sub.id);
                renderRows();
            });
        }

        container.appendChild(div);
    });
}

function calcTotals() {
    let totalPoints = 0;
    let totalCredits = 0;

    if (activeMode === 'me') {
        const subs = store.getData()?.subjects || [];
        const grades = isSimulator ? simGrades : (store.getData()?.grades || []);
        subs.forEach(s => {
            if (s.credits <= 0) return;
            const g = grades.find(x => x.subjectId === s.id);
            if (g) {
                totalPoints += s.credits * GRADE_POINTS[g.grade];
                totalCredits += s.credits;
            }
        });
    } else {
        otherSubjects.forEach(s => {
            totalPoints += s.credits * GRADE_POINTS[s.grade];
            totalCredits += s.credits;
        });
    }

    const sgpa = totalCredits ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    const currentSgpaEl = document.getElementById('current-sgpa');
    if (currentSgpaEl) currentSgpaEl.textContent = sgpa;

    if (activeMode === 'me') {
        if (currentSgpaEl) currentSgpaEl.textContent = sgpa;
        const saveSgpaBtn = document.getElementById('save-sgpa-btn') as HTMLButtonElement | null;
        const cumulativeEl = document.getElementById('cumulative-val');

        if (!isSimulator) {
            if (cumulativeEl) cumulativeEl.textContent = sgpa;
            store.updateUserData({ projectedSGPA: sgpa });

            // Check history validity against newly calculated values
            if (saveSgpaBtn) {
                const data = store.getData();
                if (data && data.sgpaHistory && Math.abs(data.sgpaHistory.sgpa - parseFloat(sgpa)) < 0.01 && data.sgpaHistory.totalCredits === totalCredits) {
                    // matches existing record perfectly
                    saveSgpaBtn.innerHTML = '✅ Already Saved';
                    saveSgpaBtn.disabled = true;
                    saveSgpaBtn.title = 'Recalculate to save again';
                    saveSgpaBtn.style.opacity = '0.7';
                    saveSgpaBtn.style.cursor = 'not-allowed';
                } else {
                    // new SGPA value was calculated, re-enable
                    saveSgpaBtn.innerHTML = '💾 Save SGPA to History';
                    saveSgpaBtn.disabled = false;
                    saveSgpaBtn.title = '';
                    saveSgpaBtn.style.opacity = '1';
                    saveSgpaBtn.style.cursor = 'pointer';
                }
            }

        } else {
            if (cumulativeEl) cumulativeEl.textContent = sgpa + ' (Sim)';
            if (saveSgpaBtn) saveSgpaBtn.style.display = 'none'; // Ensure simulation disables saving entirely
        }
    }
}
