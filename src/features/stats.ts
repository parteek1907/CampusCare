import { UserData, TimetableEntry } from '../types';

// Render guard: prevents re-entrant metric calculations
let isCalculating = false;
let cachedMetrics: Map<string, SubjectMetrics> | null = null;

export function resetStatsCache(): void {
    cachedMetrics = null;
}

export interface SemesterStats {
    totalDays: number;
    daysElapsed: number;
    daysLeft: number;
    progressPercentage: number;

    classesPlannedTotal: number;
    classesConducted: number;
    classesRemaining: number;
}

export function calculateSemesterStats(data: UserData): SemesterStats {
    const config = data.semesterConfig;
    if (!config || !config.startDate || !config.endDate) {
        return {
            totalDays: 0, daysElapsed: 0, daysLeft: 0, progressPercentage: 0,
            classesPlannedTotal: 0, classesConducted: 0, classesRemaining: 0
        };
    }

    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const now = new Date();

    // Normalize times to midnight for date comparison
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const msPerDay = 1000 * 60 * 60 * 24;

    // 1. Time Stats
    const totalDays = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

    let daysElapsed = 0;
    if (today >= start) {
        daysElapsed = Math.round((today.getTime() - start.getTime()) / msPerDay) + 1;
    }
    if (today > end) daysElapsed = totalDays;
    if (daysElapsed < 0) daysElapsed = 0;

    let daysLeft = totalDays - daysElapsed;
    // Edge case correction: If before start, days left = total
    if (today < start) daysLeft = totalDays;
    // If after end, days left = 0
    if (today > end) daysLeft = 0;

    const progressPercentage = totalDays > 0 ? Math.round((daysElapsed / totalDays) * 100) : 0;

    // 2. Class Counting
    let planned = 0;
    let conducted = 0;

    // Helper to get formatted date string YYYY-MM-DD
    const toDateStr = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    // Iterate every day of the semester
    const current = new Date(start);
    // Safety break loop
    let loops = 0;

    while (current <= end && loops < 366) {
        loops++;
        const dStr = toDateStr(current);
        const dayName = current.toLocaleDateString('en-US', { weekday: 'long' });

        // Check Holiday (holidays is string[])
        const isHoliday = data.holidays.includes(dStr);

        if (!isHoliday) {
            // Timetable classes
            const classes = data.timetable[dayName] || [];
            classes.forEach((cls: TimetableEntry) => {
                const weight = cls.type === 'Lab' ? 2 : 1;

                const slotId = cls.id || `slot_${cls.subjectId}_${cls.startTime.replace(':', '')}`;
                const attStatus = data.attendance[dStr]?.[slotId] ?? data.attendance[dStr]?.[cls.subjectId];
                const isCancelled = attStatus === 'class_cancelled'; // "Not Held"

                if (isCancelled) {
                    // Exclude from everything
                } else {
                    planned += weight;
                    if (current <= today) {
                        conducted += weight;
                    }
                }
            });
        }

        // Extra classes
        if (data.extraClasses && data.extraClasses[dStr]) {
            data.extraClasses[dStr].forEach((extra: any) => {
                const weight = (extra.type === 'Lab' || extra.type === 'lab') ? 2 : 1;
                const isCancelled = extra.status === 'class_cancelled';

                if (!isCancelled) {
                    planned += weight;
                    if (current <= today) {
                        conducted += weight;
                    }
                }
            });
        }

        // Next Day
        current.setDate(current.getDate() + 1);
    }

    const remaining = Math.max(0, planned - conducted);

    return {
        totalDays,
        daysElapsed,
        daysLeft,
        progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
        classesPlannedTotal: planned,
        classesConducted: conducted,
        classesRemaining: remaining
    };
}

export interface SubjectAttendanceStats {
    attended: number;
    conducted: number;
    percentage: number;
}

export const getHours = (classType: string): number => {
    return classType?.toLowerCase() === 'lab' ? 2 : 1;
};

export function calculateSubjectAttendance(subjectId: number, data: UserData): SubjectAttendanceStats {
    let attended = 0;
    let conducted = 0;
    const matchingSubject = data.subjects?.find((s: any) => s.id === subjectId);

    // 1. Regular Attendance (Based on Timetable)
    Object.entries(data.attendance || {}).forEach(([dateStr, dayRecord]) => {
        // Skip Holidays
        if (data.holidays && data.holidays.includes(dateStr)) return;

        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dayTT = data.timetable[dayName] || [];

        dayTT.forEach(c => {
            if (!(c.subjectName === matchingSubject?.name || String(c.subjectId) === String(subjectId))) return;

            const slotId = c.id || `slot_${c.subjectId}_${c.startTime.replace(':', '')}`;
            // If the status is recorded against a numeric ID (legacy) or this slot ID
            const status = dayRecord[slotId] ?? dayRecord[subjectId] ?? dayRecord[String(subjectId)];
            if (!status) return;

            // Skip "Not Held" (Cancelled) and "Excused"
            if (status === 'class_cancelled' || status === 'excused') return;

            const weight = getHours(c.type);

            if (status === 'present') {
                attended += weight;
                conducted += weight;
            } else if (status === 'present_half') {
                attended += 0.5 * weight;
                conducted += weight;
            } else if (status === 'absent') {
                conducted += weight;
            }
        });
    });

    // 2. Extra Classes
    Object.values(data.extraClasses || {}).forEach((dayExtras) => {
        dayExtras.forEach((ex) => {
            if ((ex as any).subjectName === matchingSubject?.name || String(ex.subjectId) === String(subjectId)) {
                // Skip Cancelled/Excused
                if (ex.status === 'class_cancelled' || ex.status === 'excused') return;

                // Determine Weight from Extra Class Record
                const weight = getHours(ex.type);

                if (ex.status === 'present') {
                    attended += weight;
                    conducted += weight;
                } else if (ex.status === 'present_half') {
                    attended += 0.5 * weight;
                    conducted += weight;
                } else if (ex.status === 'absent') {
                    conducted += weight;
                }
            }
        });
    });

    return {
        attended,
        conducted,
        percentage: conducted > 0 ? (attended / conducted) * 100 : 0
    };
}

// ============================================================
// NEW: Subject Metrics — Single Source of Truth
// ============================================================

export type RiskLevel = 'Safe' | 'At Risk' | 'Danger';

export interface SubjectMetrics {
    totalHours: number;
    hoursHeldSoFar: number;
    presentHours: number;
    targetPercentage: number;
    targetHours: number;
    currentPercent: number;
    semesterPercent: number;
    bufferHours: number;
    remainingHours: number;
    riskLevel: RiskLevel;
}

/**
 * Calculate hours that have been held (conducted) for a subject.
 * A class is "held" when it has ANY marked status (present, absent,
 * present_half). No date filtering — all marked records count.
 */
function calculateHoursHeld(subject: any, data: UserData): number {
    let hoursHeld = 0;

    // Regular attendance records
    Object.entries(data.attendance || {}).forEach(([dateStr, dayRecord]) => {
        if (data.holidays && data.holidays.includes(dateStr)) return;

        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dayTT = data.timetable?.[dayName] || [];

        dayTT.forEach((classInfo: any) => {
            if (!(classInfo.subjectName === subject.name || String(classInfo.subjectId) === String(subject.id))) return;
            const slotId = classInfo.id || `slot_${classInfo.subjectId}_${classInfo.startTime.replace(':', '')}`;

            const status = dayRecord[slotId] ?? dayRecord[subject.id] ?? dayRecord[String(subject.id)];
            if (!status) return;

            // class_cancelled and excused don't count as "held"
            if (status === 'class_cancelled' || status === 'excused') return;

            hoursHeld += getHours(classInfo.type);
        });
    });

    // Extra classes
    Object.values(data.extraClasses || {}).forEach((dayExtras) => {
        dayExtras.forEach((ex: any) => {
            if (ex.subjectName === subject.name || String(ex.subjectId) === String(subject.id)) {
                if (ex.status === 'class_cancelled' || ex.status === 'excused') return;
                hoursHeld += getHours(ex.type);
            }
        });
    });

    return hoursHeld;
}

/**
 * Calculate total present hours for a subject across all attendance records
 * and extra classes. present_half counts as 0.5 × classHours.
 */
function calculatePresentHours(subject: any, data: UserData): number {
    let present = 0;

    // Regular attendance
    Object.entries(data.attendance || {}).forEach(([dateStr, dayRecord]) => {
        if (data.holidays && data.holidays.includes(dateStr)) return;

        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dayTT = data.timetable[dayName] || [];

        dayTT.forEach((classInfo: any) => {
            if (!(classInfo.subjectName === subject.name || String(classInfo.subjectId) === String(subject.id))) return;
            const slotId = classInfo.id || `slot_${classInfo.subjectId}_${classInfo.startTime.replace(':', '')}`;

            const status = dayRecord[slotId] ?? dayRecord[subject.id] ?? dayRecord[String(subject.id)];
            if (!status) return;
            if (status === 'class_cancelled' || status === 'excused') return;

            const hrs = getHours(classInfo.type);
            if (status === 'present') present += hrs;
            else if (status === 'present_half') present += 0.5 * hrs;
        });
    });

    // Extra classes
    Object.values(data.extraClasses || {}).forEach((dayExtras) => {
        dayExtras.forEach((ex: any) => {
            if (ex.subjectName === subject.name || String(ex.subjectId) === String(subject.id)) {
                if (ex.status === 'class_cancelled' || ex.status === 'excused') return;
                const hrs = getHours(ex.type);
                if (ex.status === 'present') present += hrs;
                else if (ex.status === 'present_half') present += 0.5 * hrs;
            }
        });
    });

    return present;
}

/**
 * Central function: calculates all per-subject metrics using subject.totalClasses
 * (a.k.a. totalHours) as the single source of truth for total semester hours.
 */
export function getSubjectMetrics(subject: any, data: UserData): SubjectMetrics {
    // Return cached result if available during same render cycle
    const cacheKey = String(subject.id) + '_' + subject.name;
    if (cachedMetrics?.has(cacheKey)) {
        return cachedMetrics.get(cacheKey)!;
    }

    if (isCalculating) {
        // Re-entrant call — return safe defaults
        return {
            totalHours: 0, hoursHeldSoFar: 0, presentHours: 0,
            targetPercentage: data.semesterConfig?.minAttendance || 75,
            targetHours: 0, currentPercent: 0, semesterPercent: 0,
            bufferHours: 0, remainingHours: 0, riskLevel: 'Safe'
        };
    }

    isCalculating = true;
    try {
    const totalHours = subject.totalClasses || 0;
    const targetPercentage = data.semesterConfig?.minAttendance || 75;

    if (totalHours === 0) {
        return {
            totalHours: 0,
            hoursHeldSoFar: 0,
            presentHours: 0,
            targetPercentage,
            targetHours: 0,
            currentPercent: 0,
            semesterPercent: 0,
            bufferHours: 0,
            remainingHours: 0,
            riskLevel: 'Safe'
        };
    }

    const hoursHeldSoFar = calculateHoursHeld(subject, data);
    // No date filtering — counts all marked present/half records
    const presentHours = calculatePresentHours(subject, data);

    const targetHours = totalHours * (targetPercentage / 100);
    const rawPercent = hoursHeldSoFar > 0
        ? (presentHours / hoursHeldSoFar) * 100
        : 0;
    // Cap display at 100% (future marks can push raw above 100)
    const currentPercent = Math.min(rawPercent, 100);
    const semesterPercent = (presentHours / totalHours) * 100;
    const bufferHours = targetHours - presentHours;
    const remainingHours = totalHours - hoursHeldSoFar;

    // Risk level based on currentPercent
    let riskLevel: RiskLevel;
    if (currentPercent >= targetPercentage) {
        riskLevel = 'Safe';
    } else if (currentPercent >= targetPercentage - 10) {
        riskLevel = 'At Risk';
    } else {
        riskLevel = 'Danger';
    }

    const result: SubjectMetrics = {
        totalHours,
        hoursHeldSoFar,
        presentHours,
        targetPercentage,
        targetHours,
        currentPercent,
        semesterPercent,
        bufferHours,
        remainingHours,
        riskLevel
    };

    // Cache result for this render cycle
    if (!cachedMetrics) cachedMetrics = new Map();
    cachedMetrics.set(cacheKey, result);

    return result;
    } finally {
        isCalculating = false;
    }
}

// ============================================================
// Legacy exports kept for backward compatibility
// ============================================================

export interface SubjectSemesterTargetInfo {
    totalSemesterHours: number;
    completedHours: number;
    presentHours: number;
    targetPercentage: number;
}

export function calculateSemesterSubjectTarget(subject: any, data: UserData): SubjectSemesterTargetInfo {
    const m = getSubjectMetrics(subject, data);
    return {
        totalSemesterHours: m.totalHours,
        completedHours: m.hoursHeldSoFar,
        presentHours: m.presentHours,
        targetPercentage: m.targetPercentage
    };
}


export function renderAbsenceDropdown(subject: any): string {
    const toggleBtnHtml = `
        <button id="absence-btn-${subject.id}" style="
            display: flex; align-items: center; justify-content: center; gap: 6px;
            width: 100%; padding: 8px; background: none; border: none;
            border-top: 1px solid #f3f4f6; color: #6b7280; font-size: 0.78rem;
            cursor: pointer; margin-top: 8px; transition: color 0.15s ease;
        " onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">
            ▼ View Absence History
        </button>
    `;

    const dropdownHtml = `
        <div id="absence-drop-${subject.id}"
            style="max-height:0; overflow:hidden;
            transition:max-height 0.25s ease;
            background:#f8fafc; border-radius:0 0 10px 10px;
            padding:0 12px;">
        </div>
    `;

    return `
        <div style="margin-top: 4px; width: 100%;">
            ${toggleBtnHtml}
            ${dropdownHtml}
        </div>
    `;
}

