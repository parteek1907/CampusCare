import { UserData, TimetableEntry } from '../types';

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

                const attStatus = data.attendance[dStr]?.[cls.subjectId];
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

export function calculateSubjectAttendance(subjectId: number, data: UserData): SubjectAttendanceStats {
    let attended = 0;
    let conducted = 0;

    // 1. Regular Attendance (Based on Timetable)
    Object.entries(data.attendance || {}).forEach(([dateStr, dayRecord]) => {
        // Skip Holidays
        if (data.holidays && data.holidays.includes(dateStr)) return;

        const status = dayRecord[subjectId];
        if (!status) return;

        // Skip "Not Held" (Cancelled) and "Excused"
        if (status === 'class_cancelled' || status === 'excused') return;

        // Determine Weight via Timetable
        const dateObj = new Date(dateStr);
        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        const dayTT = data.timetable[dayName] || [];
        const classInfo = dayTT.find(c => c.subjectId === subjectId);

        if (classInfo) {
            const weight = classInfo.type === 'Lab' ? 2 : 1;

            if (status === 'present') {
                attended += weight;
                conducted += weight;
            } else if (status === 'present_half') {
                attended += 1;
                conducted += weight;
            } else if (status === 'absent') {
                conducted += weight;
            }
        }
    });

    // 2. Extra Classes
    Object.values(data.extraClasses || {}).forEach((dayExtras) => {
        dayExtras.forEach((ex) => {
            if (ex.subjectId === subjectId) {
                // Skip Cancelled/Excused
                if (ex.status === 'class_cancelled' || ex.status === 'excused') return;

                // Determine Weight from Extra Class Record
                const isLab = ex.type.toLowerCase() === 'lab';
                const weight = isLab ? 2 : 1;

                if (ex.status === 'present') {
                    attended += weight;
                    conducted += weight;
                } else if (ex.status === 'present_half') {
                    attended += 1;
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
        percentage: conducted > 0 ? Math.round((attended / conducted) * 100) : 0
    };
}
