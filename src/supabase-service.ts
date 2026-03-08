import { supabase } from './supabase';

export interface UserProfile {
    id: string;
    email: string | null;
    name: string | null;
    created_at: string;
}

export interface Semester {
    id: string;
    user_id: string;
    name: string;
    program: string | null;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    config: any;
    created_at: string;
}

export interface Subject {
    id: string;
    semester_id: string;
    name: string;
    code: string | null;
    credits: number | null;
    class_type: string | null;
    internal_max: number | null;
    external_max: number | null;
    created_at: string;
}

export interface AttendanceRecord {
    id: string;
    subject_id: string;
    date: string;
    status: 'present' | 'absent' | 'present_half' | 'class_cancelled';
    reason: string | null;
    created_at: string;
}

export interface TimetableSlot {
    id: string;
    semester_id: string;
    subject_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
}

// User Profile

export async function upsertUser(auth0Sub: string, email: string, name: string): Promise<void> {
    try {
        await supabase.rpc('set_config', {
            setting: 'app.current_user_id',
            value: auth0Sub
        });

        const { error } = await supabase
            .from('user_profiles')
            .upsert({ id: auth0Sub, email, name });
        if (error) throw error;
    } catch (err) {
        console.error('Error upserting user profile:', err);
    }
}

// Semesters

export async function getSemesters(userId: string): Promise<Semester[]> {
    try {
        const { data, error } = await supabase
            .from('semesters')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as Semester[];
    } catch (err) {
        console.error('Error fetching semesters:', err);
        return [];
    }
}

export async function createSemester(userId: string, data: Partial<Semester>): Promise<Semester> {
    try {
        await supabase.rpc('set_config', {
            setting: 'app.current_user_id',
            value: userId
        });

        const { data: result, error } = await supabase
            .from('semesters')
            .insert({ ...data, user_id: userId })
            .select()
            .single();
        if (error) throw error;
        return result as Semester;
    } catch (err) {
        console.error('Error creating semester:', err);
        throw err;
    }
}

export async function updateSemester(id: string, data: Partial<Semester>): Promise<void> {
    try {
        const { error } = await supabase
            .from('semesters')
            .update(data)
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Error updating semester:', err);
        throw err;
    }
}

export async function deleteSemester(id: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('semesters')
            .delete()
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Error deleting semester:', err);
        throw err;
    }
}

// Subjects

export async function getSubjects(semesterId: string): Promise<Subject[]> {
    try {
        const { data, error } = await supabase
            .from('subjects')
            .select('*')
            .eq('semester_id', semesterId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data as Subject[];
    } catch (err) {
        console.error('Error fetching subjects:', err);
        return [];
    }
}

export async function createSubject(semesterId: string, data: Partial<Subject>): Promise<Subject> {
    try {
        const { data: result, error } = await supabase
            .from('subjects')
            .insert({ ...data, semester_id: semesterId })
            .select()
            .single();
        if (error) throw error;
        return result as Subject;
    } catch (err) {
        console.error('Error creating subject:', err);
        throw err;
    }
}

export async function updateSubject(id: string, data: Partial<Subject>): Promise<void> {
    try {
        const { error } = await supabase
            .from('subjects')
            .update(data)
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Error updating subject:', err);
        throw err;
    }
}

export async function deleteSubject(id: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('subjects')
            .delete()
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Error deleting subject:', err);
        throw err;
    }
}

// Attendance

export async function getAttendance(subjectId: string): Promise<AttendanceRecord[]> {
    try {
        const { data, error } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('subject_id', subjectId)
            .order('date', { ascending: true });
        if (error) throw error;
        return data as AttendanceRecord[];
    } catch (err) {
        console.error('Error fetching attendance for subject:', err);
        return [];
    }
}

export async function getAttendanceByDate(semesterId: string, date: string): Promise<AttendanceRecord[]> {
    try {
        // This is a slightly complex query; we join subjects and attendance_records 
        // to filter attendance effectively across a semester.
        const { data, error } = await supabase
            .from('attendance_records')
            .select(`
        *,
        subjects!inner ( semester_id )
      `)
            .eq('subjects.semester_id', semesterId)
            .eq('date', date);

        if (error) throw error;
        return data as AttendanceRecord[];
    } catch (err) {
        console.error('Error fetching attendance by date:', err);
        return [];
    }
}

export async function upsertAttendance(
    subjectId: string,
    date: string,
    status: string,
    reason?: string
): Promise<void> {
    try {
        const { error } = await supabase
            .from('attendance_records')
            .upsert(
                { subject_id: subjectId, date, status, reason },
                { onConflict: 'subject_id, date' }
            );
        if (error) throw error;
    } catch (err) {
        console.error('Error upserting attendance:', err);
        throw err;
    }
}

export async function deleteAttendance(id: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('attendance_records')
            .delete()
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Error deleting attendance record:', err);
        throw err;
    }
}

// Timetable

export async function getTimetable(semesterId: string): Promise<TimetableSlot[]> {
    try {
        const { data, error } = await supabase
            .from('timetable_slots')
            .select('*')
            .eq('semester_id', semesterId)
            .order('day_of_week', { ascending: true })
            .order('start_time', { ascending: true });
        if (error) throw error;
        return data as TimetableSlot[];
    } catch (err) {
        console.error('Error fetching timetable:', err);
        return [];
    }
}

export async function upsertTimetableSlot(
    semesterId: string,
    subjectId: string,
    data: Partial<TimetableSlot>
): Promise<void> {
    try {
        // Note: without a unique constraint besides ID, upsert by other means might just be update/create logic.
        // If we rely on generic data merging this uses standard insert with all keys.
        const { error } = await supabase
            .from('timetable_slots')
            .upsert({ ...data, semester_id: semesterId, subject_id: subjectId });
        if (error) throw error;
    } catch (err) {
        console.error('Error upserting timetable slot:', err);
        throw err;
    }
}

export async function deleteTimetableSlot(id: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('timetable_slots')
            .delete()
            .eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Error deleting timetable slot:', err);
        throw err;
    }
}
