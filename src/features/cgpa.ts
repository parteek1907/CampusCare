import { store } from '../store';
import { $ } from '../utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

let otherSubjects: OtherSubject[] = [
    { id: 1, name: 'Subject 1', credits: 4, grade: 'O' },
    { id: 2, name: 'Subject 2', credits: 4, grade: 'O' }
];

export function renderCGPA(container: HTMLElement) {
    const data = store.getData();
    if (!data) return;

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
                <div class="card" style="padding:0; overflow:hidden; border:1px solid #e2e8f0; height:fit-content;">
                    <button id="toggle-table" style="width:100%; text-align:left; padding:1rem 1.5rem; background:#f8fafc; border:none; border-bottom:1px solid #e2e8f0; font-weight:600; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
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
                <div class="card" style="padding:0; overflow:hidden;">
                    <!-- Tabs -->
                    <div style="display:flex; border-bottom:1px solid #e2e8f0;">
                         <button id="tab-me" class="tab-btn ${activeMode === 'me' ? 'active' : ''}">Calculate for Me</button>
                         <button id="tab-other" class="tab-btn ${activeMode === 'other' ? 'active' : ''}">Calculate for Other</button>
                    </div>

                    <div style="padding:2rem;">
                         <div class="flex-between" style="margin-bottom:2rem;">
                            <h2 style="font-size:1.25rem;">
                                ${activeMode === 'me' ? 'My Subjects' : 'Custom Calculator'}
                                ${isSimulator ? '<span style="font-size:0.8rem; background:#fef3c7; color:#d97706; padding:2px 8px; border-radius:12px; margin-left:8px;">SIMULATOR ACTIVE - Changes not saved</span>' : ''}
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
                            <div style="display:flex; justify-content:flex-end; align-items:flex-end; gap:20px;">
                                <button id="export-pdf" class="btn btn-secondary btn-small" style="height:fit-content; border-color:var(--color-primary); color:var(--color-primary);">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                    Export Report
                                </button>
                                <div>
                                     <div style="font-size:0.9rem; color:gray;">Calculated SGPA</div>
                                     <div id="current-sgpa" style="font-size:2.5rem; font-weight:800; color:var(--color-primary);">0.00</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            ${activeMode === 'me' ? `` : ''}

        </div>

        <style>
            .cgpa-split-layout { display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; }
            @media(max-width:900px) { .cgpa-split-layout { grid-template-columns: 1fr; } }
            
            .calc-input-row { display: grid; grid-template-columns: 3fr 1fr 1fr 40px; gap: 10px; align-items: center; }
            .calc-field { background:#f8fafc; border:1px solid #e2e8f0; padding:8px 12px; border-radius:6px; width:100%; transition:all 0.2s; }
            .calc-field:focus { border-color:var(--color-primary); outline:none; }
            
            .tab-btn { flex:1; padding:1rem; background:white; border:none; cursor:pointer; font-weight:600; color:#64748b; border-bottom:2px solid transparent; }
            .tab-btn:hover { background:#f8fafc; color:#1e293b; }
            .tab-btn.active { color:var(--color-primary); border-bottom-color:var(--color-primary); background:#eff6ff; }
        </style>
    `;

    setupTabs(container);
    renderRows();
}

function setupTabs(container: HTMLElement) {
    $('#tab-me').addEventListener('click', () => { activeMode = 'me'; renderCGPA(container); });
    $('#tab-other').addEventListener('click', () => { activeMode = 'other'; renderCGPA(container); });

    if (activeMode === 'other') {
        const addBtn = $('#add-other-row');
        if (addBtn) addBtn.addEventListener('click', () => {
            otherSubjects.push({ id: Date.now(), name: 'New Subject', credits: 4, grade: 'O' });
            renderRows();
        });
    }

    // New Controls
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
        modeToggle.addEventListener('click', () => {
            entryMode = (entryMode === 'grade') ? 'marks' : 'grade';
            renderCGPA(container);
        });
    }
}

function renderRows() {
    const container = $('#cgpa-rows');
    container.innerHTML = '';

    if (activeMode === 'me') {
        renderMeRows(container);
    } else {
        renderOtherRows(container);
    }

    calcTotals();

    $('#export-pdf')?.addEventListener('click', generatePDF);
}

function generatePDF() {
    const doc = new jsPDF();
    const user = store.getCurrentUser();
    const currentSem = user?.currentSemesterId || 1;
    const finalGPA = $('#current-sgpa').innerText;

    // --- Branding Header ---
    doc.setFillColor(37, 99, 235); // Primary Blue
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text('CampusCare', 14, 20);

    doc.setFontSize(12);
    doc.setTextColor(226, 232, 240); // Slate-200
    doc.text('Academic Performance Report', 14, 30);

    // --- Student Info Section ---
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.setFontSize(10);
    doc.text('Student Name:', 14, 55);
    doc.text('Semester:', 14, 62);
    doc.text('Program:', 14, 69);
    doc.text('Generated On:', 14, 76);

    doc.setFont('helvetica', 'bold');
    doc.text(user?.name || 'N/A', 50, 55);
    doc.text(`Semester ${currentSem}`, 50, 62);
    doc.text(user?.programName || 'N/A', 50, 69);
    doc.text(new Date().toLocaleDateString(), 50, 76);
    doc.setFont('helvetica', 'normal');

    // --- Result Highlight ---
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

    // --- Table Data Preparation ---
    let tableData: any[][] = [];
    if (activeMode === 'me') {
        const subs = store.getData()?.subjects || [];
        const grades = isSimulator ? simGrades : (store.getData()?.grades || []);

        tableData = subs.filter(s => s.credits > 0).map(s => {
            const g = grades.find(x => x.subjectId === s.id);
            const grade = g?.grade || '-';
            const points = GRADE_POINTS[grade] || 0;
            // Removed: Eval Type, Points Earned
            return [s.name, s.credits, grade, points];
        });
    } else {
        tableData = otherSubjects.map(s => {
            const points = GRADE_POINTS[s.grade] || 0;
            return [s.name, s.credits, s.grade, points];
        });
    }

    // --- Table ---
    autoTable(doc, {
        startY: 90,
        head: [['Subject Name', 'Credits', 'Grade', 'Points']], // 4 Cols
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
        foot: [['', '', 'Final SGPA', finalGPA]], // Match 4 Cols
        footStyles: {
            fillColor: [37, 99, 235],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
        }
    });

    // Bottom Disclaimer
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('This document is for personal use and informational purposes only.', 105, 280, { align: 'center' });
    doc.text('Values are calculated based on user input and do not represent official university records.', 105, 285, { align: 'center' });

    // Save
    doc.save(`${user?.name.replace(/\s+/g, '_')}_Sem${currentSem}_Report.pdf`);
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
        container.innerHTML = `<div style="text-align:center; padding:2rem; color:gray;">No subjects found. Add subjects first.</div>`;
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
        div.innerHTML = `
            <input class="calc-field" value="${sub.name}" placeholder="Subject Name">
            <input type="number" class="calc-field" value="${sub.credits}" min="1" max="10" style="text-align:center;">
            <select class="calc-field" style="cursor:pointer;">
                ${Object.keys(GRADE_POINTS).map(k => `<option value="${k}" ${sub.grade === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
            <button class="icon-btn del-btn" style="color:#ef4444; background:none; border:none; cursor:pointer;">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
        `;

        // Bind events
        const nameInput = div.querySelectorAll('input')[0] as HTMLInputElement;
        nameInput.addEventListener('input', () => {
            sub.name = nameInput.value;
        });

        const credInput = div.querySelectorAll('input')[1] as HTMLInputElement;
        credInput.addEventListener('input', () => {
            sub.credits = parseInt(credInput.value) || 0;
            calcTotals();
        });

        const gradeSelect = div.querySelector('select') as HTMLSelectElement;
        gradeSelect.addEventListener('change', () => {
            sub.grade = gradeSelect.value;
            calcTotals();
        });

        div.querySelector('.del-btn')!.addEventListener('click', () => {
            otherSubjects = otherSubjects.filter(s => s.id !== sub.id);
            renderRows();
        });

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
    $('#current-sgpa').textContent = sgpa;

    if (activeMode === 'me') {
        $('#current-sgpa').textContent = sgpa;
        if (!isSimulator) {
            $('#cumulative-val').textContent = sgpa;
            store.updateUserData({ projectedSGPA: sgpa });
        } else {
            $('#cumulative-val').textContent = sgpa + ' (Sim)';
        }
    }
}
