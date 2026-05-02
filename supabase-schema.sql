-- ============================================
-- WorkFlow Tracker - Complete Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop all existing tables
DROP TABLE IF EXISTS porter_bookings CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS leave_requests CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
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
  is_porter_supervisor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Migration for existing installs:
-- ALTER TABLE supervisors ADD COLUMN IF NOT EXISTS is_porter_supervisor BOOLEAN DEFAULT FALSE;

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

-- 4. Customers table
CREATE TABLE customers (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  machine_number TEXT,
  machine_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Tasks table
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
  extra_assignees TEXT[],
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Leave requests table
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

-- 7. Notifications table
CREATE TABLE notifications (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  related_task_id BIGINT REFERENCES tasks(id) ON DELETE SET NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 8. Comments table
CREATE TABLE comments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'Admin',
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Activity log table
CREATE TABLE activity_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  task_id BIGINT REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  actor TEXT DEFAULT 'Admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 10. Attachments table
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

-- 11. Settings table
CREATE TABLE settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin PIN
INSERT INTO settings (key, value) VALUES ('admin_pin', '1234');

-- 12. User roles table
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

-- 13. Porter Suppliers table
CREATE TABLE porter_suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact TEXT NOT NULL,
  address TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE porter_suppliers DISABLE ROW LEVEL SECURITY;

-- Insert default suppliers
INSERT INTO porter_suppliers (name, contact, address, created_by) VALUES
  ('Evergreen Traders', '9894870798, 9342125622', '11 Ground floor, Kaleeswara Main Road, Opp. Dass Lodge Canteen, Coimbatore - 641009', 'admin'),
  ('Pioneer Fasteners', '8754282450, 8870550475', '104 Rr Samy Lane, Kaleewara Mill Road, Near Dass Lodge Canteen, Coimbatore - 641009', 'admin'),
  ('Balaji Bearing', '9363125732, 9600412268, 7598936205', 'BR Complex, 97, Ranga Konar St, Beside AITUC Office, Kattoor, Ram Nagar, Coimbatore - 641009', 'admin'),
  ('Auto tools center', '8098766143, 9442637241', '19, Kaleeswara Mill Road, Coimbatore - 641009', 'admin'),
  ('Khams Traders', '9994280690', '184, Ranga Konar Street, Kattoor, Coimbatore - 641009', 'admin'),
  ('Seth Electical', '7708733964', 'No.49, Somasundaram Mill Road, Coimbatore - 641009', 'admin'),
  ('KB Enterprises', '0422-2236708', '85, Somasundram Mill Road, Coimbatore - 641009', 'admin'),
  ('Sri Dharshini Enterprices', '9843023516', '123/10E Kasthuri Building, Dr. Nanjappa Road, Coimbatore - 641018', 'admin'),
  ('J vision', '9894607077', '8/2, Dhandumariamman Koil Street, Avanashi Road, Coimbatore - 641018', 'admin'),
  ('The Coimbatore Pneumatics', '9566776306, 9944243601', '166-168 Rangakonar Street, Kattoor, Coimbatore - 641009', 'admin'),
  ('SSB Industrial solution', '8870015036, 9994210135', '353-A, 404-408 Marvel Complex, Sanganoor Main Road, Ganapathy - 641006', 'admin'),
  ('Velthan Steels', '9994609695, 9025960451', '393/3B Nalla Thanneer Thottam, Sanganoor Road, Ganapathy - 641006', 'admin'),
  ('SPB steels', '9364501112, 9363102930', '66-B, Sanganoor Road, Ganapathy - 641006', 'admin'),
  ('Renuka Metals', '9443652795, 9443523204', '274/1-A S R Complex, Sanganoor Main Road, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Pearl metal house', '9952644756', '285/1, Nalla Thanneer Thottam, Raja Street, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Thirumal tools and hardwares', '9786837089, 9750965846', '1424, Bharathy Nagar Stop, Sathy Main Road, Ganapathy - 641006', 'admin'),
  ('Lion tools and hardwares', '9342968187', '303, Pionner Tower, Dr. Nanjappa Road, Coimbatore - 641018', 'admin'),
  ('Velan stores', '9787575793', 'NO 11/5, Avinashi Road, Thottipalayam Pirivu, Civil Aerodrome Post, Coimbatore - 641014', 'admin'),
  ('Suriya Hardwares', '9443345427', '1/152, Avinashi Road, Chinniyampalayam, Coimbatore - 641048', 'admin'),
  ('Surya Agency', '9787924186, 9843024186', '1072, Sathy Road, Opp. Textool, Ganapathy - 641006', 'admin'),
  ('MM and Oil Seal', '7397721812', '295, V.R. Arcade, 1st Floor, Opp. Corporation Complex, Coimbatore - 641018', 'admin'),
  ('Meghalai Steels', '6379788411', 'S.F.No. 10/3A Krishnarayapuram, Ganapathy - 641110', 'admin'),
  ('Burhani engineering mart', '9894248208', '81 Chellappan Gounder Street, Katoor, Coimbatore - 641009', 'admin'),
  ('Premier Precision Engineering', '9842259052, 9843021296', 'Site No. 11, Indra Nagar (A.K.G), Near Lion Bus, Uppilipalayam, Coimbatore - 641015', 'admin'),
  ('Sekar keyway', '9500345127', 'No-8-A, Kasthuribai 3rd Street, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Mech Pro Engineering', '9842026002', 'HIG-1, Avarampalayam, Shoba Nagar, Krishnarayapuram, Illango Nagar, Coimbatore - 641006', 'admin'),
  ('S P TIG Welding', '9942453330', 'No:94 Sanganoor Road, Raja Street, Sridevi Nagar, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Sim tech CNC', '8124618161', 'No.9, Jaganathan Industrial Estate, Athipalayam Road, Chinnavedampatti, Coimbatore - 641049', 'admin'),
  ('Fusion engineering', '9080956145', '124-A, Bharathy Street, Arunachalagounder Thottam, Chinnavedampatti, Coimbatore - 641049', 'admin'),
  ('Jaya spring', '9443332074', 'NO. 28, Padel Road, Ram Nagar, Coimbatore - 641009', 'admin'),
  ('ACM engineering', '9965590091', 'S.F.No.49/2B1, State Bank Colony Main Road, Subramaniya Nagar, Chinnavedampatti - 641049', 'admin'),
  ('Lucky Plastics', '8870683863', '462-D, Maraikayar Complex, N.H. Road, Townhall, Coimbatore - 641001', 'admin'),
  ('Veera Steels', '9789167683', 'SF.NO. 14, Athipalayam Main Road, Chinnavedampatti - 641049', 'admin'),
  ('Sri Balamurugan Surface Coating', '9842249099, 9842239099', '7/10D, Sri Ayyappa Industrial Estate, Keeranatham Village, Kondayampalayam Road, Saravanampatti - 641035', 'admin'),
  ('SBV enggineering works', '9952260628', '2/494-1, Bettathapuram Pudur, Karamadi PO, Coimbatore - 641104', 'admin'),
  ('SVS Industry', '6381603667', 'No. 2/285-A Mylampatti, Karayamapalayam, Coimbatore - 641062', 'admin'),
  ('OM SAI PLATERS', '9443551196, 8124440527', '2/240, Gemini Compound, Avinashi Road, Chinniyampalayam, Coimbatore - 641062', 'admin'),
  ('Sree metal cutting eng industries', '9751044455', '573/1B2, Athipalayam Road, Chinnavedampatti, Coimbatore - 641049', 'admin'),
  ('Aluminium finisher', '9600674796, 9043956626', '13/1-3 Athipalayam Road, Chinnavedampatti - 641049', 'admin'),
  ('Sakthi Agencies', '9842548211', '59, 2nd Street, Ganapathy - 641006', 'admin'),
  ('M.R.Fabricators', '7010787640, 9095716194', '145/70 Moolai Thottam, Sakthi Main Road, Ganapathy, Coimbatore - 641006', 'admin'),
  ('SM Steel & Tubes', '9751549001, 9655649001', 'SF No.112, 3rd Street, Kandhasamy Nagar, Udhayamapalayam, Coimbatore - 641033', 'admin'),
  ('Covai edm tools private limited', '9788885555', '428/05-A1, Eran Thottam, Opp. BSNL Tower, Ganapathy, Coimbatore - 641006', 'admin'),
  ('king coats', '8754772968', 'Near Global Infra Projects Company, Manickampalayam, Kunnathurpudhur, Sarcarsamakulam, Tamil Nadu - 641107', 'admin'),
  ('Pavithra Air products', '8489910661', '513-A/3, Chinnavedampatti, Ganapathy, Coimbatore - 641049', 'admin'),
  ('OM Sakthi hydralics', '7904631684', 'NA Thottam, SF No 274/1 55, Sanganoor Main Road, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Cpl laser tech', '9943743623', '439/3B2C Senthampalayam Road, Masagoundenchettipalayam, Annur Village, Coimbatore', 'admin'),
  ('DURGA BEARING', '9363208810', 'Chennai', 'admin'),
  ('ANUSYA GAS AGENCIES', '9994684297', 'Vinayakar Kovil, 2/14 B-1, Opp. Karayamapalayam Road, Thanam Nagar, GEM Nagar, Mylampatti, Coimbatore - 641048', 'admin'),
  ('DYNAMIC TRADING', '9989411716', '5.124, Ranga Konar St, Kattoor, Anupperpalayam, Ram Nagar, Coimbatore - 641009', 'admin'),
  ('VS ENGINEERING', '8883645134', '7, S Street Number 5, Avarampalayam, Illango Nagar, Coimbatore - 641006', 'admin'),
  ('SRI MAHAVISHNU HEAT TREATMENT', '9994179899', '1435, Sathy Road, Ganapathy Housing Unit, Gopalakrishnapuram, Bharathi Nagar, Coimbatore - 641006', 'admin'),
  ('sk tools grinding', '9952650507', 'Shop No.95,96, Sanganoor Road, Raja Street, Sridevi Nagar, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Premier plastic arts', '9677795977', '128, Lakshmi Complex, Sathya Road, Ganapathy, Coimbatore - 641006', 'admin'),
  ('Raman Transport', '9080833969', 'Anna Nagar, Neelambur, Coimbatore - 641062', 'admin'),
  ('Sree Fastners', '7867979936', '240, Chellappan Street, Kattoor, Coimbatore - 641009', 'admin'),
  ('Pinacle Caster', '9035508666', 'Ground Floor, No. 179, Rangasamy Street, Kattoor, Coimbatore - 641603', 'admin'),
  ('Sendka Belt And Pully', '8310638451', '146/3, 146/3-1 Bharathi Street, Anjugam Nagar, Chinnavedampatti PO, Coimbatore - 641049', 'admin'),
  ('Pully Center', '7397794481', '239, Dr Nanjappa Road, Anupperpalayam, Ram Nagar, Coimbatore - 641009', 'admin'),
  ('Misumi', '8800986472', 'Plot No-31, Electronic City, Sec-18, Udyog Vihar Phase-IV, Gurgaon', 'admin'),
  ('SMC', '9849544290', 'P-41/3, 8th Avenue, Domestic Tariff Zone, Mahindra World City, Chengalpattu, Tamil Nadu - 603004', 'admin'),
  ('Sun Electical', '9790418811', 'Shop No.50-1A, Sathy Road, Athipalayam Pirivu, Prashakthi Nagar, Ganapathy, Coimbatore - 641006', 'admin');

-- 14. Porter Bookings table
CREATE TABLE porter_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_name TEXT,
  receiver_name TEXT,
  materials TEXT[] NOT NULL DEFAULT '{}',
  approx_weight TEXT,
  pickup_location TEXT NOT NULL,
  drop_location TEXT NOT NULL,
  vehicle_type TEXT,
  contact TEXT,
  booking_date DATE NOT NULL,
  booking_time TIME,
  status TEXT NOT NULL DEFAULT 'Pending',
  booked_by TEXT NOT NULL,
  booked_by_role TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
-- Migration for existing installs:
-- ALTER TABLE porter_bookings ADD COLUMN IF NOT EXISTS receiver_name TEXT;
-- ALTER TABLE porter_bookings ALTER COLUMN supplier_name DROP NOT NULL;
-- ALTER TABLE porter_bookings ADD COLUMN IF NOT EXISTS porter_id TEXT UNIQUE;
-- Set porter supervisor flag for the supervisor with pin '0000':
-- UPDATE supervisors SET is_porter_supervisor = TRUE WHERE pin = '0000';

-- Porter ID auto-generation (MAX-based, reuses deleted numbers)
CREATE OR REPLACE FUNCTION generate_porter_id()
RETURNS TRIGGER AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.porter_id IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(porter_id FROM 5) AS INTEGER)), 0) + 1
    INTO next_num
    FROM porter_bookings
    WHERE porter_id IS NOT NULL AND porter_id ~ '^POR-[0-9]+$';
    NEW.porter_id := 'POR-' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_porter_id ON porter_bookings;
CREATE TRIGGER set_porter_id
  BEFORE INSERT ON porter_bookings
  FOR EACH ROW EXECUTE FUNCTION generate_porter_id();

-- ==================== PRODUCTION TABLES ====================

-- 14. Machine Types (templates)
CREATE TABLE machine_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. Departments within a machine type
CREATE TABLE machine_type_departments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  machine_type_id BIGINT NOT NULL REFERENCES machine_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(machine_type_id, name)
);

-- 16. Predefined tasks within each department
CREATE TABLE machine_type_tasks (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  department_id BIGINT NOT NULL REFERENCES machine_type_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 17. Projects (instances of a machine being built)
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

-- 18. Project tasks (created from template when project starts)
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

-- 19. Production task comments
CREATE TABLE project_task_comments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  project_task_id BIGINT NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 20. Production task activity log
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
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE porter_bookings DISABLE ROW LEVEL SECURITY;
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
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE porter_bookings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE customers; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE projects; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_tasks; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
