

export function renderAbout(container: HTMLElement) {
    container.innerHTML = `
        <header class="section-header" style="text-align:center; margin-bottom:3rem;">
            <h1 style="color:var(--color-primary); font-size:2.5rem; margin-bottom:1rem;">About CampusCare</h1>
            <p style="color:var(--color-text-muted); font-size:1.1rem; max-width:600px; margin:0 auto; line-height:1.6;">
                CampusCare is a student-focused academic management platform designed to simplify everyday college life. 
                It brings together essential academic tools—attendance tracking, timetable management, and CGPA calculation—into one unified, easy-to-use system.
            </p>
        </header>

        <div style="max-width:900px; margin:0 auto; display:grid; gap:4rem;">
            
            <!-- Vision / Why -->
            <section style="display:grid; grid-template-columns:1fr 1fr; gap:3rem; align-items:center;">
                <div>
                     <h2 style="color:#1e293b; font-size:1.8rem; margin-bottom:1rem;">Why CampusCare Exists</h2>
                     <p style="color:#475569; line-height:1.7; margin-bottom:1.5rem;">
                        The platform is built around real student needs. Instead of fragmented apps, manual tracking, or guesswork, 
                        CampusCare helps students understand where they stand academically and plan ahead with confidence.
                     </p>
                     <p style="color:#475569; line-height:1.7;">
                        College students often struggle with:
                     </p>
                     <ul style="list-style:none; padding:0; margin-top:1rem; display:grid; gap:0.5rem;">
                        <li style="display:flex; gap:10px; align-items:center; color:#334155;">
                            <span style="color:#ef4444;">&times;</span> Keeping track of subject-wise attendance
                        </li>
                        <li style="display:flex; gap:10px; align-items:center; color:#334155;">
                             <span style="color:#ef4444;">&times;</span> Understanding how absences affect eligibility
                        </li>
                         <li style="display:flex; gap:10px; align-items:center; color:#334155;">
                             <span style="color:#ef4444;">&times;</span> Managing complex weekly timetables
                        </li>
                     </ul>
                </div>
                 <div style="background:#f8fafc; padding:2rem; border-radius:24px; border:1px solid #e2e8f0;">
                    <h3 style="color:#1e293b; margin-bottom:1rem;">Our Vision</h3>
                    <p style="color:#64748b; line-height:1.6; font-style:italic;">
                        "CampusCare aims to become a reliable academic companion—helping students stay informed, organized, and confident throughout their academic journey."
                    </p>
                     <div style="margin-top:2rem; display:flex; gap:1rem;">
                        <div style="flex:1; height:4px; background:#e2e8f0; border-radius:2px;"><div style="width:60%; height:100%; background:var(--color-primary); border-radius:2px;"></div></div>
                        <div style="flex:1; height:4px; background:#e2e8f0; border-radius:2px;"></div>
                     </div>
                </div>
            </section>

             <!-- What It Does -->
             <section>
                <h2 style="color:#1e293b; font-size:1.8rem; margin-bottom:2rem; text-align:center;">What CampusCare Does</h2>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1.5rem;">
                    ${featureCard('Timetable Management', 'Create and manage semester-wise timetables with ease.')}
                    ${featureCard('Attendance Tracking', 'Track class-by-class with real logic (theory, lab, tutorial).')}
                    ${featureCard('Live Monitoring', 'Monitor subject-wise attendance percentage in real time.')}
                    ${featureCard('What-If Scenarios', 'Plan ahead using attendance simulations and safe-play logic.')}
                    ${featureCard('CGPA Calculator', 'Calculate CGPA based on grades or marks accurately.')}
                    ${featureCard('Multi-Semester', 'Maintain separate records for each semester automatically.')}
                </div>
             </section>

             <!-- Design Philosophy -->
             <section style="background:#eff6ff; padding:3rem; border-radius:24px; text-align:center;">
                 <h2 style="color:#1e3a8a; font-size:1.8rem; margin-bottom:1rem;">Designed with Students in Mind</h2>
                 <p style="color:#3b82f6; margin-bottom:2rem; max-width:600px; margin-left:auto; margin-right:auto;">
                    Clean, modern UI. Simple workflows. Safe actions with undo options. Clear visual feedback. No hidden or confusing logic.
                 </p>
                 <div style="display:inline-flex; gap:1rem; flex-wrap:wrap; justify-content:center;">
                    <span class="badge" style="background:white; color:#2563eb; padding:8px 16px; border-radius:50px; font-weight:600; box-shadow:0 2px 4px rgba(37,99,235,0.1);">Reliable</span>
                    <span class="badge" style="background:white; color:#2563eb; padding:8px 16px; border-radius:50px; font-weight:600; box-shadow:0 2px 4px rgba(37,99,235,0.1);">Accurate</span>
                    <span class="badge" style="background:white; color:#2563eb; padding:8px 16px; border-radius:50px; font-weight:600; box-shadow:0 2px 4px rgba(37,99,235,0.1);">Secure</span>
                 </div>
             </section>

             <!-- Who Is It For -->
             <section>
                <h3 style="color:#1e293b; font-size:1.5rem; margin-bottom:1.5rem;">Built for Accuracy & Control</h3>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
                    <ul style="list-style:none; padding:0; display:grid; gap:1rem;">
                        <li style="display:flex; gap:12px; align-items:start;">
                            <span style="color:#10b981; font-weight:bold;">✓</span>
                            <span style="color:#475569;">Labs are treated differently from theory classes (weighted properly).</span>
                        </li>
                        <li style="display:flex; gap:12px; align-items:start;">
                            <span style="color:#10b981; font-weight:bold;">✓</span>
                            <span style="color:#475569;">Attendance can be marked, undone, or simulated safely.</span>
                        </li>
                    </ul>
                    <ul style="list-style:none; padding:0; display:grid; gap:1rem;">
                         <li style="display:flex; gap:12px; align-items:start;">
                            <span style="color:#10b981; font-weight:bold;">✓</span>
                            <span style="color:#475569;">Holidays and extra classes are handled properly in calculations.</span>
                        </li>
                         <li style="display:flex; gap:12px; align-items:start;">
                            <span style="color:#10b981; font-weight:bold;">✓</span>
                            <span style="color:#475569;">Semester boundaries are strictly enforced to prevent data leaks.</span>
                        </li>
                    </ul>
                </div>
             </section>
        </div>
    `;
}

function featureCard(title: string, desc: string) {
    return `
        <div style="background:white; padding:1.5rem; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 2px 4px rgba(0,0,0,0.02); transition:transform 0.2s;">
            <h3 style="color:#334155; font-size:1.1rem; margin-bottom:0.5rem;">${title}</h3>
            <p style="color:#64748b; font-size:0.9rem; line-height:1.5;">${desc}</p>
        </div>
    `;
}
