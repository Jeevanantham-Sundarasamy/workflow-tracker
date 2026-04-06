-- ============================================
-- WorkFlow Tracker - Complete Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop all existing tables
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS supervisors CASCADE;
DROP TABLE IF EXISTS managers CASCADE;

-- 1. Managers table
CREATE TABLE managers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  pin TEXT,
  department TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Supervisors table
CREATE TABLE supervisors (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  pin TEXT,
  department TEXT,
  manager_names TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Employees table
CREATE TABLE employees (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  pin TEXT,
  supervisor_name TEXT,
  phone TEXT,
  designation TEXT,
  department TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Tasks table
CREATE TABLE tasks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task TEXT NOT NULL,
  supervisor TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'Pending',
  follow_up TEXT,
  location TEXT,
  location_gps TEXT,
  created_by TEXT DEFAULT 'admin',
  role TEXT DEFAULT 'admin',
  assigned_to TEXT,
  assigned_to_type TEXT DEFAULT 'supervisor',
  assigned_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Leave requests table
CREATE TABLE leave_requests (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  employee_name TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'Casual',
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'Pending',
  approved_by TEXT,
  approval_comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Notifications table
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  related_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Comments table
CREATE TABLE comments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'Admin',
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Activity log table
CREATE TABLE activity_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  actor TEXT DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Attachments table
CREATE TABLE attachments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by TEXT DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Settings table
CREATE TABLE settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin PIN
INSERT INTO settings (key, value) VALUES ('admin_pin', '1234');

-- 11. User roles table
CREATE TABLE user_roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  pin TEXT NOT NULL,
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (name, pin, permissions) VALUES
  ('admin', '1234', '["all"]'::jsonb),
  ('manager', '5678', '["create_task","edit_task","view_all","manage_supervisors","export","import"]'::jsonb),
  ('supervisor', '0000', '["view_own","update_status","comment"]'::jsonb);

-- ==================== PRODUCTION TABLES ====================

-- 12. Machine Types (templates)
CREATE TABLE machine_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 13. Departments within a machine type
CREATE TABLE machine_type_departments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  machine_type_id BIGINT NOT NULL REFERENCES machine_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(machine_type_id, name)
);

-- 14. Predefined tasks within each department
CREATE TABLE machine_type_tasks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  department_id BIGINT NOT NULL REFERENCES machine_type_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. Projects (instances of a machine being built)
CREATE TABLE projects (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  machine_type_id BIGINT NOT NULL REFERENCES machine_types(id),
  serial_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 16. Project tasks (created from template when project starts)
CREATE TABLE project_tasks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  department_name TEXT NOT NULL,
  task_name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  sort_order INT NOT NULL DEFAULT 0,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  qc_status TEXT,
  qc_by TEXT,
  qc_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. Production task comments
CREATE TABLE project_task_comments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_task_id BIGINT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 18. Production task activity log
CREATE TABLE project_task_activity (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_task_id BIGINT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  actor TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Disable Row Level Security
ALTER TABLE project_task_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_task_activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE managers DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE machine_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE machine_type_departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE machine_type_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_tasks DISABLE ROW LEVEL SECURITY;

-- Enable Realtime for key tables
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE managers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE comments; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE activity_log; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE leave_requests; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE supervisors; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE employees; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE projects; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
