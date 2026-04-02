-- ============================================
-- WorkFlow Tracker - Complete Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 0a. Tasks table (base table)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task text NOT NULL,
  supervisor text NOT NULL,
  priority text NOT NULL DEFAULT 'Medium',
  due_date date NOT NULL,
  status text DEFAULT 'Pending',
  follow_up text,
  location text,
  location_gps text,
  created_by text DEFAULT 'admin',
  role text DEFAULT 'admin',
  assigned_to text,
  assigned_to_type text DEFAULT 'supervisor',
  assigned_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for tasks" ON tasks;
CREATE POLICY "Allow all for tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);

-- 0b. Supervisors table
CREATE TABLE IF NOT EXISTS supervisors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  pin text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS pin text;
ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for supervisors" ON supervisors;
CREATE POLICY "Allow all for supervisors" ON supervisors FOR ALL USING (true) WITH CHECK (true);

-- 0c. Settings table (for PIN management etc.)
CREATE TABLE IF NOT EXISTS settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO settings (key, value) VALUES ('admin_pin', '1234')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for settings" ON settings;
CREATE POLICY "Allow all for settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- 0d. Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  pin text,
  supervisor_name text,
  phone text,
  designation text,
  department text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE employees ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for employees" ON employees;
CREATE POLICY "Allow all for employees" ON employees FOR ALL USING (true) WITH CHECK (true);

-- Add new columns to tasks table (safe for existing tables)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location_gps text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by text DEFAULT 'admin';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS role text DEFAULT 'admin';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_type text DEFAULT 'supervisor';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by text;

-- 10. Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name text NOT NULL,
  leave_type text NOT NULL DEFAULT 'Casual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  status text DEFAULT 'Pending',
  approved_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for leave_requests" ON leave_requests;
CREATE POLICY "Allow all for leave_requests" ON leave_requests FOR ALL USING (true) WITH CHECK (true);

-- 2. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text DEFAULT 'info',
  related_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 3. Comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author text NOT NULL DEFAULT 'Admin',
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 4. Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  actor text DEFAULT 'Admin',
  created_at timestamptz DEFAULT now()
);

-- 5. File attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by text DEFAULT 'Admin',
  created_at timestamptz DEFAULT now()
);

-- 6. Roles table (for RBAC)
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  pin text NOT NULL,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

INSERT INTO user_roles (name, pin, permissions)
VALUES
  ('admin', '1234', '["all"]'::jsonb),
  ('manager', '5678', '["create_task","edit_task","view_all","manage_supervisors","export","import"]'::jsonb),
  ('supervisor', '0000', '["view_own","update_status","comment"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 7. Enable Realtime for key tables
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE activity_log; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE supervisors; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE employees; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for notifications" ON notifications;
CREATE POLICY "Allow all for notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for comments" ON comments;
CREATE POLICY "Allow all for comments" ON comments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for activity_log" ON activity_log;
CREATE POLICY "Allow all for activity_log" ON activity_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for attachments" ON attachments;
CREATE POLICY "Allow all for attachments" ON attachments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for user_roles" ON user_roles;
CREATE POLICY "Allow all for user_roles" ON user_roles FOR ALL USING (true) WITH CHECK (true);
