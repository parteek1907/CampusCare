// Domain Interfaces

export interface SemesterConfig {
    semesterNum?: number;
    startDate: string;
    endDate: string;
    minAttendance: number;
}

export interface SubjectMarks {
    internalMax: number;
    endTermMax: number;
}

export interface Subject {
    id: number;
    name: string;
    credits: number;
    // Breakdown
    breakdown: {
        theory: number;   // Classes/week
        tutorial: number;
        lab: number;
    };
    totalClasses: number; // Expected semester total
    // Evaluation
    evalType: 'internal' | 'internal_end';
    marks: SubjectMarks;
    // Priority
    priority: 'high' | 'medium' | 'low';
}

export interface TimetableEntry {
    subjectId: number;
    subjectName: string;
    type: 'Theory' | 'Lab' | 'Tutorial';
    startTime: string; // HH:MM
    endTime: string;   // HH:MM
    location?: string;
}

export interface Timetable {
    [day: string]: TimetableEntry[];
}

export interface GradeEntry {
    subjectId: number;
    mode: 'marks' | 'grade';
    internalObtained?: number;
    endObtained?: number;
    grade: string;
}

export type AttendanceStatus = 'present' | 'present_half' | 'absent' | 'excused' | 'class_cancelled';

export interface AttendanceRecord {
    [date: string]: {
        [subjectId: number]: AttendanceStatus;
    };
}

export interface ExtraClassRecord {
    id: string;
    subjectId: number;
    type: 'Theory' | 'Lab' | 'Tutorial';
    status: AttendanceStatus;
    absenceReason?: string;
    note?: string;
}

export interface UserData {
    setupComplete: boolean;
    semesterConfig: SemesterConfig;
    subjects: Subject[];
    timetable: Timetable;
    attendance: AttendanceRecord;
    attendanceReasons: { [date: string]: { [subjectId: number]: string } };
    attendanceNotes: { [date: string]: { [subjectId: number]: string } };
    extraClasses: { [date: string]: ExtraClassRecord[] };
    holidays: string[];
    grades: GradeEntry[];
    projectedSGPA?: string;
    preferences: {
        cgpaMode: 'marks' | 'grade';
    };
}

export interface UserProfile {
    name: string;
    username: string;
    password: string; // Plaintext for this demo constraint
    collegeName?: string;
    programName?: string;
    email?: string;
    // Multi-Semester Support
    semesters: { [id: number]: UserData };
    currentSemesterId: number;
}

export interface AppState {
    users: UserProfile[];
    currentUser?: UserProfile;
}
