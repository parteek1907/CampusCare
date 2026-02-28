import './style.css';
import { store } from './store';
import { renderLandingPage } from './landing';
import { renderTimetable } from './features/tt';
import { renderAttendance } from './features/attendance';
import { renderCGPA } from './features/cgpa';
import { renderSubjects } from './features/subjects';
import { renderOnboarding } from './features/onboarding';
import { $ } from './utils';
import { initAuth0, login, logout, getUser } from './auth';
import { Modal } from './ui/modal';

import { calculateSemesterStats, calculateSubjectAttendance } from './features/stats';
import { renderAbout } from './features/about';

const app = $<HTMLDivElement>('#app');

// --- Initialization ---

async function init() {
    // Show Loading
    app.innerHTML = '<div style="height:100vh; display:grid; place-items:center;">Loading CampusCare...</div>';

    try {
        const isAuth = await initAuth0();
        if (isAuth) {
            const authUser = getUser();
            if (authUser) {
                store.handleAuth0Login(authUser);
            }
        }
    } catch (e) {
        console.error(e);
    }

    render();
}

// --- Views & Rendering ---

function render() {
    const user = store.getCurrentUser();
    if (user) {
        const currentData = user.semesters[user.currentSemesterId];
        if (!currentData.setupComplete) {
            renderOnboarding(app, () => render());
        } else {
            renderAppLayout(user);
        }
    } else {
        // Landing Page with Auth0 triggers
        renderLandingPage(
            () => login(),  // onLogin
            () => login()   // onSignup (Redirects to same Auth0 login/signup page)
        );
    }
}

// 2. Main App Layout
function renderAppLayout(user: any) {
    app.innerHTML = `
        <div class="app-layout fade-in">
            <nav class="sidebar">
                <div style="margin-bottom:3rem; display:flex; align-items:center; gap:10px;">
                    <img src="/logo.jpg" alt="Logo" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                    <div>
                        <h1 style="color:var(--color-primary); font-size:1.5rem; letter-spacing:-0.03em;">CampusCare</h1>
                        <p style="color:var(--color-text-muted); font-size:0.95rem; font-weight:500;">Academic Tracking Made Simple</p>
                    </div>
                </div>
                <ul class="nav-links">
                    <li data-target="dashboard" class="active">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                        Dashboard
                    </li>
                    <li data-target="subjects">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                         Subjects
                    </li>
                    <li data-target="timetable">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Timetable
                    </li>
                    <li data-target="attendance">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                        Attendance
                    </li>
                     <li data-target="cgpa">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
                        CGPA Calc
                    </li>
                </ul>

                <div style="margin-top:auto;">
                    <div id="user-profile-btn" style="display:flex; align-items:center; gap:12px; padding:12px; margin-bottom:1rem; background:#f1f5f9; border-radius:50px; cursor:pointer;">
                        <div style="width:36px; height:36px; background:#eff6ff; color:var(--color-primary); border-radius:50%; display:grid; place-items:center; font-weight:700;">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-weight:600; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${user.name}</div>
                            <div style="font-size:0.75rem; color:var(--color-text-muted);">View Profile</div>
                        </div>
                    </div>

                    <ul class="nav-links" style="margin-bottom:1rem;">
                         <li data-target="about">
<svg width="20" height="20" viewBox="-2 -2 28 28" fill="none" stroke="currentColor" stroke-width="2" style="overflow:visible;"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                              About
                         </li>
                    </ul>
                    
                    <button id="logout-btn" class="btn btn-secondary" style="width:100%; border-color:#e2e8f0; color:#ef4444; justify-content:flex-start;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        Sign Out
                    </button>
                </div>
            </nav>
            <main class="content-area" id="main-content">
                <!-- Dynamic Content -->
            </main>
        </div>

        <!-- Profile Modal -->
        <div id="profile-modal" class="modal-overlay hidden" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); z-index:200; display:none; place-items:center;">
             <div class="card" style="width:100%; max-width:500px; padding:2rem; animation:fadeUp 0.3s ease-out;">
                 <div class="flex-between" style="margin-bottom:1.5rem;">
                     <h3>Edit Profile</h3>
                     <button id="close-profile-modal" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                 </div>
                 <form id="profile-form">
                     <div class="input-group">
                         <label>Full Name</label>
                         <input type="text" id="p-name" value="${user.name}" required>
                     </div>
                     <div class="input-group">
                         <label>Target Attendance %</label>
                         <input type="number" id="p-target" value="${user.semesters[user.currentSemesterId].semesterConfig.minAttendance}" min="1" max="100" required>
                     </div>
                     <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-top:1rem;">
                         <div class="input-group">
                             <label>Sem Start Date</label>
                             <input type="date" id="p-start" value="${user.semesters[user.currentSemesterId].semesterConfig.startDate}" required>
                         </div>
                         <div class="input-group">
                             <label>Sem End Date</label>
                             <input type="date" id="p-end" value="${user.semesters[user.currentSemesterId].semesterConfig.endDate}" required>
                         </div>
                     </div>
                     <button class="btn" style="width:100%; margin-top:1.5rem;">Save Changes</button>
                 </form>
                 
                 <div style="margin-top:2rem; padding-top:1.5rem; border-top:1px solid #e2e8f0;">
                     <button id="delete-account-btn" type="button" class="btn btn-secondary" style="width:100%; border-color:#fca5a5; color:#dc2626; background:#fef2f2;">
                        Delete Account
                     </button>
                 </div>
             </div>
        </div>
    `;

    renderSection('dashboard');
    setupNav();
    $('#logout-btn').addEventListener('click', () => {
        store.logout();
        logout(); // Auth0 Logout
    });

    // Profile Logic
    const pModal = $<HTMLDivElement>('#profile-modal');

    // Initialize DatePickers
    import('./datepicker').then(({ DatePicker }) => {
        new DatePicker('#p-start');
        new DatePicker('#p-end');
    });

    $('#user-profile-btn').addEventListener('click', () => {
        pModal.classList.remove('hidden');
        pModal.style.display = 'grid';
    });

    $('#close-profile-modal').addEventListener('click', () => {
        pModal.classList.add('hidden');
        pModal.style.display = 'none';
    });
    $('#profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        try {
            const updatedName = $<HTMLInputElement>('#p-name').value;
            const updatedSem = user.currentSemesterId;
            const updatedTarget = parseInt($<HTMLInputElement>('#p-target').value);
            const updatedStart = $<HTMLInputElement>('#p-start').value;
            const updatedEnd = $<HTMLInputElement>('#p-end').value;

            // --- Validation ---
            if (!updatedName.trim()) {
                await Modal.alert("Full Name is required.");
                return;
            }
            if (isNaN(updatedTarget) || updatedTarget < 1 || updatedTarget > 100) {
                await Modal.alert("Target Attendance must be between 1% and 100%.");
                return;
            }
            if (!updatedStart || !updatedEnd) {
                await Modal.alert("Please select both Start and End dates.");
                return;
            }
            if (updatedEnd <= updatedStart) {
                await Modal.alert("Semester End Date must be after Start Date.");
                return;
            }

            // --- Update Data ---
            store.updateUserProfile({
                name: updatedName,
                currentSemesterId: updatedSem
            });

            store.updateUserData({
                semesterConfig: {
                    startDate: updatedStart,
                    endDate: updatedEnd,
                    minAttendance: updatedTarget
                }
            });

            // --- Success & Refresh ---
            await Modal.alert("Profile updated successfully!");
            pModal.classList.add('hidden');
            pModal.style.display = 'none'; // Close modal

            render(); // Global Re-render to sync all widgets (Dashboard, Stats, Risk Colors)

        } catch (err) {
            console.error(err);
            await Modal.alert("Failed to save profile changes.");
        }
    });



    $('#delete-account-btn')?.addEventListener('click', () => {
        showDeleteAccountModal();
    });
}

function showDeleteAccountModal() {
    // Create full-screen modal
    const modal = document.createElement('div');
    modal.id = 'delete-account-modal';
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(4px);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        animation: fadeIn 0.2s ease-out;
    `;

    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 16px;
            max-width: 500px;
            width: 100%;
            padding: 0;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.3s ease-out;
        ">
            <!-- Header -->
            <div style="
                padding: 2rem 2rem 1.5rem;
                border-bottom: 1px solid #e2e8f0;
                text-align: center;
            ">
                <div style="
                    width: 64px;
                    height: 64px;
                    margin: 0 auto 1rem;
                    background: #fef2f2;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                ">⚠️</div>
                <h2 style="margin: 0 0 0.5rem; font-size: 1.5rem; color: #1e293b;">Delete Account</h2>
                <p style="margin: 0; color: #64748b; font-size: 0.95rem;">This action cannot be undone</p>
            </div>

            <!-- Content -->
            <div style="padding: 2rem;">
                <div style="
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    border-radius: 12px;
                    padding: 1.25rem;
                    margin-bottom: 1.5rem;
                ">
                    <h3 style="margin: 0 0 0.75rem; font-size: 0.95rem; color: #991b1b; font-weight: 600;">
                        The following will be permanently deleted:
                    </h3>
                    <ul style="margin: 0; padding-left: 1.25rem; color: #7f1d1d; font-size: 0.9rem; line-height: 1.6;">
                        <li>All semesters and academic data</li>
                        <li>All subjects and timetables</li>
                        <li>Complete attendance history</li>
                        <li>All CGPA and grade records</li>
                        <li>Your account and profile</li>
                    </ul>
                </div>

                <div style="
                    text-align: center;
                    padding: 1.5rem;
                    background: #f8fafc;
                    border-radius: 12px;
                    margin-bottom: 1.5rem;
                ">
                    <div id="timer-display" style="
                        font-size: 3rem;
                        font-weight: 700;
                        color: #ef4444;
                        margin-bottom: 0.5rem;
                        font-variant-numeric: tabular-nums;
                    ">10</div>
                    <p id="timer-text" style="margin: 0; color: #64748b; font-size: 0.9rem;">
                        You can delete your account in <strong>10 seconds</strong>
                    </p>
                </div>
            </div>

            <!-- Actions -->
            <div style="
                padding: 1.5rem 2rem 2rem;
                display: flex;
                gap: 1rem;
                border-top: 1px solid #e2e8f0;
            ">
                <button id="cancel-delete-btn" class="btn btn-secondary" style="flex: 1;">
                    Cancel
                </button>
                <button id="confirm-delete-btn" class="btn" disabled style="
                    flex: 1;
                    background: #ef4444;
                    border-color: #ef4444;
                    opacity: 0.5;
                    cursor: not-allowed;
                ">
                    Delete Account
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Timer logic
    let countdown = 10;
    let timerInterval: number | null = null;

    const timerDisplay = modal.querySelector('#timer-display') as HTMLElement;
    const timerText = modal.querySelector('#timer-text') as HTMLElement;
    const confirmBtn = modal.querySelector('#confirm-delete-btn') as HTMLButtonElement;
    const cancelBtn = modal.querySelector('#cancel-delete-btn') as HTMLButtonElement;

    const closeModal = () => {
        if (timerInterval) clearInterval(timerInterval);
        modal.style.animation = 'fadeOut 0.2s ease-out';
        setTimeout(() => modal.remove(), 200);
    };

    // Start countdown
    timerInterval = window.setInterval(() => {
        countdown--;
        timerDisplay.textContent = countdown.toString();

        if (countdown > 0) {
            timerText.innerHTML = `You can delete your account in <strong>${countdown} second${countdown !== 1 ? 's' : ''}</strong>`;
        } else {
            // Timer complete
            clearInterval(timerInterval!);
            timerText.innerHTML = '<strong style="color: #ef4444;">You may now delete your account</strong>';
            confirmBtn.disabled = false;
            confirmBtn.style.opacity = '1';
            confirmBtn.style.cursor = 'pointer';
        }
    }, 1000);

    // Cancel handler
    cancelBtn.addEventListener('click', closeModal);

    // Confirm delete handler
    confirmBtn.addEventListener('click', async () => {
        if (countdown > 0) return; // Safety check

        const user = store.getCurrentUser();
        if (!user) return;

        // Perform deletion
        store.deleteAccount(user.username);
        logout();

        closeModal();

        // Show brief confirmation before reload
        const successModal = document.createElement('div');
        successModal.style.cssText = modal.style.cssText;
        successModal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 3rem; text-align: center; max-width: 400px;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">✓</div>
                <h3 style="margin: 0 0 0.5rem; color: #1e293b;">Account Deleted</h3>
                <p style="margin: 0; color: #64748b;">Redirecting...</p>
            </div>
        `;
        document.body.appendChild(successModal);

        setTimeout(() => {
            location.reload();
        }, 1500);
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function setupNav() {
    document.querySelectorAll('.nav-links li[data-target]').forEach(li => {
        li.addEventListener('click', () => {
            document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
            li.classList.add('active');
            const target = li.getAttribute('data-target');
            if (target) renderSection(target);
        });
    });
}

function renderSection(section: string) {
    const container = $<HTMLDivElement>('#main-content');
    container.innerHTML = ''; // Clear

    switch (section) {
        case 'dashboard': renderDashboard(container); break;
        case 'subjects': renderSubjects(container); break;
        case 'attendance': renderAttendance(container); break;
        case 'timetable': renderTimetable(container); break;
        case 'cgpa': renderCGPA(container); break;
        case 'about': renderAbout(container); break;
    }
}

// --- Features ---

function renderDashboard(container: HTMLElement) {
    const data = store.getData();
    const user = store.getCurrentUser();
    if (!data || !user) return;

    // --- High Priority Logic ---
    const highPrioritySubs = data.subjects.filter(s => s.priority === 'high');
    const minAtt = data.semesterConfig.minAttendance || 75;

    container.innerHTML = `
        <header class="flex-between" style="margin-bottom:2rem;">
            <div>
                <h1 style="font-size: 2rem; margin-bottom:0.25rem;">Hi, ${user.name}</h1>
                <p>Welcome to your academic dashboard.</p>
            </div>
            <div style="display:flex; gap:1rem; align-items:center;">
                
                <!-- Dashboard Semester Selector -->
                <!-- Dashboard Semester Selector -->
                 <div class="semester-selector-container">
                    <button id="dash-sem-btn" class="btn btn-secondary" style="font-weight:600; padding:0.5rem 1rem; gap:8px; min-width: 160px; justify-content: space-between;">
                        <span>Semester ${user.currentSemesterId}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div id="dash-sem-dropdown" class="semester-dropdown">
                        ${Object.keys(user.semesters)
            .map(Number)
            .map(id => {
                const isActive = id === user.currentSemesterId;
                return `
                <button class="sem-option ${isActive ? 'active' : ''}" data-val="${id}">
                    <span>Semester ${id}</span>
                    ${isActive ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--color-primary);"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
                </button>
                `;
            }).join('')}
                        <button class="sem-option add-new" data-val="new">
                            <span style="display:flex; align-items:center; gap:8px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add New Semester
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Top Widgets Row -->
        <div style="display:grid; grid-template-columns: 1fr; gap:1.5rem; margin-bottom:2rem;">
            <!-- Academic Analytics -->
            <div class="card" style="padding:1.5rem; border:1px solid #e2e8f0;">
                <h3 style="margin-bottom:1rem;">Weekly Workload</h3>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem; text-align:center;">
                    <div>
                        <div style="font-size:1.5rem; font-weight:700; color:var(--color-primary);">
                           ${data.subjects.reduce((acc: any, s: any) => acc + (s.breakdown.theory || 0) * 1 + (s.breakdown.tutorial || 0) * 1 + (s.breakdown.lab || 0) * 2, 0)}
                        </div>
                        <div style="font-size:0.75rem; color:#64748b;">Contact Hours</div>
                    </div>
                     <div>
                        <div style="font-size:1.5rem; font-weight:700; color:var(--color-accent);">
                           ${data.subjects.reduce((acc: any, s: any) => acc + s.credits, 0)}
                        </div>
                        <div style="font-size:0.75rem; color:#64748b;">Total Credits</div>
                    </div>
                     <div>
                        <div style="font-size:1.5rem; font-weight:700; color:#10b981;">
                           ${data.subjects.length}
                        </div>
                        <div style="font-size:0.75rem; color:#64748b;">Subjects</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Priority Focus Area -->
        ${highPrioritySubs.length > 0 ? `
            <div class="card" style="border-left:4px solid #ef4444; padding:1.5rem; margin-bottom:2rem; background:#fff1f2;">
                <h3 style="color:#b91c1c; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    High Priority Focus
                </h3>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap:1rem;">
                   ${highPrioritySubs.map(s => {
                const stats = calculateSubjectAttendance(s.id, data);
                const isRisk = stats.percentage < minAtt;

                return `
                       <div style="background:white; padding:1rem; border-radius:8px; border:1px solid ${isRisk ? '#fecaca' : '#e2e8f0'}; box-shadow:sm;">
                           <div style="font-weight:600; color:#1e293b; margin-bottom:5px;">${s.name}</div>
                           <div style="font-size:0.85rem; color:#64748b; margin-bottom:8px;">Attendance: <span style="font-weight:700; color:${isRisk ? '#dc2626' : '#16a34a'}">${stats.percentage}%</span></div>
                           <div style="font-size:0.75rem; color:#94a3b8;">Target: ${minAtt}%</div>
                       </div>
                   `;
            }).join('')}
                </div>
            </div>
        ` : ''}

        <!-- Timeline Widget -->
        ${(() => {
            const stats = calculateSemesterStats(data);
            if (stats.totalDays === 0) return ''; // No valid config

            return `
            <div class="card" style="margin-bottom:2rem; padding:1.5rem;">
                <div class="flex-between" style="margin-bottom:10px;">
                    <h3 style="font-size:1rem; color:#334155;">Semester Progress</h3>
                    <span style="font-weight:700; color:var(--color-primary);">${stats.progressPercentage}%</span>
                </div>
                <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                    <div style="height:100%; width:${stats.progressPercentage}%; background:var(--color-primary); border-radius:4px;"></div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem; margin-top:1rem; text-align:center;">
                    <div style="background:#f8fafc; padding:8px; border-radius:6px;">
                        <div style="font-size:0.75rem; color:#64748b;">Days Left</div>
                        <div style="font-weight:600; color:#1e293b;">${stats.daysLeft}</div>
                    </div>
                    <div style="background:#f8fafc; padding:8px; border-radius:6px;">
                        <div style="font-size:0.75rem; color:#64748b;">Classes Conducted</div>
                        <div style="font-weight:600; color:#1e293b;">${stats.classesConducted}</div>
                    </div>
                     <div style="background:#f8fafc; padding:8px; border-radius:6px;">
                        <div style="font-size:0.75rem; color:#64748b;">Classes Remaining</div>
                        <div style="font-weight:600; color:#1e293b;">${stats.classesRemaining}</div>
                    </div>
                </div>
            </div>`;
        })()}

        <!-- Bottom Row (Analysis) -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:1.5rem;">
            
            <!-- Absence Insights -->
            ${(() => {
            // Calculation Logic
            let totalAbsences = 0;
            let totalAbsentWeighted = 0;
            const reasonCounts: Record<string, number> = {};

            // 1. Calculate from Attendance Records
            Object.entries(data.attendance).forEach(([dStr, record]) => {
                Object.entries(record).forEach(([subId, status]) => {
                    if (status === 'absent') {
                        totalAbsences++;

                        // Weight Calculation
                        const dayName = new Date(dStr).toLocaleDateString('en-US', { weekday: 'long' });
                        const dayTT = data.timetable[dayName] || [];
                        const cls = dayTT.find(c => c.subjectId === parseInt(subId));
                        const weight = (cls?.type === 'Lab') ? 2 : 1;
                        totalAbsentWeighted += weight;
                    }
                });
            });

            // 2. Extra Classes Absences
            Object.values(data.extraClasses || {}).forEach(list => {
                list.forEach(ex => {
                    if (ex.status === 'absent') {
                        totalAbsences++;
                        const weight = (ex.type === 'Lab') ? 2 : 1;
                        totalAbsentWeighted += weight;
                    }
                });
            });

            // 3. Reasons
            Object.values(data.attendanceReasons || {}).forEach(rec => {
                Object.values(rec).forEach(r => {
                    if (r) reasonCounts[r] = (reasonCounts[r] || 0) + 1;
                });
            });

            // Add Extra Class Reasons
            Object.values(data.extraClasses || {}).forEach(list => {
                list.forEach(ex => {
                    if (ex.absenceReason) {
                        reasonCounts[ex.absenceReason] = (reasonCounts[ex.absenceReason] || 0) + 1;
                    }
                });
            });

            // Handle Undocumented
            const documented = Object.values(reasonCounts).reduce((a, b) => a + b, 0);
            if (totalAbsences > documented) {
                reasonCounts['Unspecified'] = totalAbsences - documented;
            }

            // Rate
            const semStats = calculateSemesterStats(data);
            const totalConducted = semStats.classesConducted; // Weighted
            const absRate = totalConducted > 0 ? ((totalAbsentWeighted / totalConducted) * 100).toFixed(1) : '0.0';

            // Most Common
            let mostCommon = 'None';
            let maxCount = 0;
            Object.entries(reasonCounts).forEach(([r, c]) => {
                if (c > maxCount) {
                    maxCount = c;
                    mostCommon = r;
                }
            });

            return `
                <div class="card" style="padding:1.5rem; border:1px solid #e2e8f0; border-left: 4px solid #6366f1;">
                    <h3 style="margin-bottom:1.5rem; color:#1e293b;">Absence Insights</h3>
                    <div style="display:flex; gap:2rem; align-items:flex-start;">
                        <div style="flex:1;">
                            <div style="margin-bottom:1.5rem;">
                                <div style="font-size:2.5rem; font-weight:700; color:#ef4444; line-height:1;">${totalAbsences}</div>
                                <div style="color:#64748b; font-size:0.85rem; font-weight:500; margin-top:4px;">Total Absences</div>
                            </div>
                            
                             <div style="margin-bottom:1.5rem;">
                                <div style="font-size:1.5rem; font-weight:700; color:#64748b; line-height:1;">${absRate}%</div>
                                <div style="color:#94a3b8; font-size:0.8rem; margin-top:4px;">Absence Rate (Weighted)</div>
                            </div>

                            <div style="padding:10px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                                <div style="font-size:0.75rem; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Frequent Reason</div>
                                <div style="font-weight:700; color:#334155; font-size:1rem; margin-top:2px;">${mostCommon}</div>
                            </div>
                        </div>

                        <div style="flex:1.5; border-left:1px solid #f1f5f9; padding-left:1.5rem; min-height:180px;">
                             ${Object.keys(reasonCounts).length > 0 ?
                    Object.entries(reasonCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5) // Top 5
                        .map(([r, c]) => {
                            const pct = totalAbsences > 0 ? (c / totalAbsences * 100).toFixed(0) : 0;
                            return `
                                        <div style="margin-bottom:12px;">
                                            <div class="flex-between" style="font-size:0.85rem; margin-bottom:4px; color:#475569;">
                                                <span style="font-weight:500;">${r}</span>
                                                <span style="color:#64748b;">${c}</span>
                                            </div>
                                            <div style="height:6px; background:#f1f5f9; border-radius:10px; overflow:hidden;">
                                                <div style="height:100%; width:${pct}%; background:var(--color-primary); border-radius:10px;"></div>
                                            </div>
                                        </div>
                                    `;
                        }).join('')
                    : '<div style="height:100%; display:grid; place-items:center; color:#cbd5e1; font-size:0.9rem;">No absence data recorded</div>'
                }
                        </div>
                    </div>
                </div>`;
        })()}
            
            <!-- Attendance Overview -->
            <div class="card" style="min-height:300px; padding:1.5rem; border:1px solid #e2e8f0;">
                <h3 style="margin-bottom:0.5rem;">Attendance Overview</h3>
                <p style="margin-bottom:1.5rem;">Subject-wise breakdown (Sorted by Priority)</p>
                
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${data.subjects.length > 0 ? data.subjects
            .sort((a, b) => {
                // Determine criticality: High Prio > Low Att vs Target
                const getScore = (s: any) => {
                    let sc = 0;
                    if (s.priority === 'high') sc += 1000;
                    if (s.priority === 'medium') sc += 500;
                    // TODO: Add attendance factor if needed, for new just priority
                    return sc;
                };
                return getScore(b) - getScore(a);
            })
            .map(s => {
                const stats = calculateSubjectAttendance(s.id, data);
                const subPresent = stats.attended;
                const subTotal = stats.conducted;
                const per = stats.percentage;
                const remaining = s.totalClasses - subTotal;
                const safeRemaining = remaining > 0 ? remaining : 0;
                const minAtt = user.semesters[user.currentSemesterId].semesterConfig.minAttendance || 75;
                const isLow = per < minAtt;

                return `
                        <div style="padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                            <div class="flex-between" style="margin-bottom:4px;">
                                <span style="font-weight:600; color:#334155;">
                                    ${s.name}
                                    ${s.priority === 'high' ? '🔥' : ''}
                                </span>
                                <span style="font-weight:700; color:${isLow ? '#ef4444' : '#10b981'};">${per}%</span>
                            </div>
                            <div class="flex-between" style="font-size:0.8rem; color:#64748b;">
                                <span>Attended: ${subPresent}/${subTotal}</span>
                                <span>Left: <strong>${safeRemaining}</strong></span>
                            </div>
                            <div style="height:4px; background:#e2e8f0; border-radius:2px; margin-top:6px; overflow:hidden;">
                                <div style="height:100%; width:${per}%; background:${isLow ? '#ef4444' : '#10b981'}; border-radius:2px;"></div>
                            </div>
                        </div>
                    `;
            }).join('') : '<p style="color:#94a3b8;">No attendance data yet.</p>'
        }
                </div>
                </div>
                </div>
                    `;

    // Attach Dashboard Handlers
    setTimeout(() => {
        const dBtn = document.getElementById('dash-sem-btn');
        const dDrop = document.getElementById('dash-sem-dropdown');

        if (dBtn && dDrop) {
            dBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dDrop.classList.toggle('show');
            });

            document.addEventListener('click', (e) => {
                if (!dBtn.contains(e.target as Node) && !dDrop.contains(e.target as Node)) {
                    dDrop.classList.remove('show');
                }
            });

            dDrop.querySelectorAll('.sem-option').forEach(opt => {
                opt.addEventListener('click', async (e) => {
                    const val = (e.currentTarget as HTMLElement).dataset.val;
                    if (val === 'new') {
                        const nextSem = Math.max(...Object.keys(user.semesters).map(Number)) + 1;
                        const confirmed = await Modal.confirm(`Start Semester ${nextSem} ? `);
                        if (confirmed) {
                            store.addSemester(nextSem);
                            render();
                        }
                    } else if (val) {
                        store.switchSemester(parseInt(val));
                        render();
                    }
                });
            });
        }
    }, 0);
}

// Start
init();

