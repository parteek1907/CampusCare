-- 1. user_profiles
CREATE TABLE user_profiles (
  id text PRIMARY KEY,
  email text,
  name text,
  created_at timestamptz DEFAULT now()
);

-- 2. semesters
CREATE TABLE semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES user_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  program text,
  start_date date,
  end_date date,
  is_active boolean DEFAULT true,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- 3. subjects
CREATE TABLE subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid REFERENCES semesters(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  credits integer,
  class_type text,
  internal_max integer,
  external_max integer,
  created_at timestamptz DEFAULT now()
);

-- 4. attendance_records
CREATE TABLE attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'present_half', 'class_cancelled')),
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, date)
);

-- 5. timetable_slots
CREATE TABLE timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid REFERENCES semesters(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots ENABLE ROW LEVEL SECURITY;

-- Create Policies based on custom Auth0 claims (current_setting)

-- user_profiles policies
CREATE POLICY "Users can manage their own profile"
  ON user_profiles
  FOR ALL
  USING (id = current_setting('app.current_user_id', true));

-- semesters policies
CREATE POLICY "Users can manage their own semesters"
  ON semesters
  FOR ALL
  USING (user_id = current_setting('app.current_user_id', true));

-- subjects policies (join through semesters)
CREATE POLICY "Users can manage subjects for their semesters"
  ON subjects
  FOR ALL
  USING (
    semester_id IN (
      SELECT id FROM semesters 
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );

-- attendance_records policies (join through subjects -> semesters)
CREATE POLICY "Users can manage attendance for their subjects"
  ON attendance_records
  FOR ALL
  USING (
    subject_id IN (
      SELECT s.id FROM subjects s
      JOIN semesters sem ON s.semester_id = sem.id
      WHERE sem.user_id = current_setting('app.current_user_id', true)
    )
  );

-- timetable_slots policies (join through semesters)
CREATE POLICY "Users can manage timetable slots for their semesters"
  ON timetable_slots
  FOR ALL
  USING (
    semester_id IN (
      SELECT id FROM semesters 
      WHERE user_id = current_setting('app.current_user_id', true)
    )
  );
