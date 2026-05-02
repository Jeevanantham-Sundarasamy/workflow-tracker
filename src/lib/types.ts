export interface Task {
  id: string;
  task: string;
  supervisor: string;
  priority: "High" | "Medium" | "Low";
  due_date: string;
  status: "Pending" | "In Progress" | "Done" | "Delayed" | "On Hold" | "Cancelled";
  follow_up: string | null;
  location: string | null;
  location_gps: string | null;
  created_by: string;
  assigned_to: string | null;
  assigned_to_type: "supervisor" | "employee" | null;
  assigned_by: string | null;
  extra_assignees: string[] | null;
  created_at: string;
  completed_at?: string | null;
  customer_id?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  machine_number: string | null;
  machine_type: string | null;
  created_at: string;
}

export interface Supervisor {
  id: string;
  name: string;
  pin: string | null;
  department: string | null;
  manager_names: string[] | null;
  phone: string | null;
}

export interface Manager {
  id: string;
  name: string;
  pin: string | null;
  department: string | null;
  phone: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  pin: string | null;
  supervisor_names: string[] | null;
  phone: string | null;
  designation: string | null;
  department: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  related_task_id: string | null;
  read: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  author: string;
  message: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  task_id: string | null;
  action: string;
  details: string | null;
  actor: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface UserRole {
  id: string;
  name: string;
  pin: string;
  permissions: string[];
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_name: string;
  leave_type: "Casual" | "Sick" | "Earned" | "Compensatory" | "Other";
  from_date: string;
  to_date: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  approved_by: string | null;
  approval_comment: string | null;
  created_at: string;
}

export type Role = "guest" | "admin" | "manager" | "supervisor" | "employee";

export const LEAVE_TYPES = ["Casual", "Sick", "Earned", "Compensatory", "Other"] as const;
export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export const STATUSES = ["Pending", "In Progress", "Done", "Delayed", "On Hold", "Cancelled"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;

export const ROLE_LABELS: Record<Role, string> = {
  guest: "Guest",
  admin: "Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  employee: "Employee",
};

export function hasPermission(permissions: string[], action: string): boolean {
  return permissions.includes("all") || permissions.includes(action);
}

// Production types
export interface MachineType {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface MachineTypeDepartment {
  id: string;
  machine_type_id: string;
  name: string;
  sort_order: number;
  priority: "High" | "Medium" | "Low" | null;
}

export interface MachineTypeTask {
  id: string;
  department_id: string;
  name: string;
  priority: "High" | "Medium" | "Low";
  sort_order: number;
}

export interface Project {
  id: string;
  machine_type_id: string;
  serial_number: string;
  customer_name: string;
  start_date: string;
  due_date: string;
  status: "Active" | "Completed" | "On Hold";
  created_by: string;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  project_id: string;
  department_name: string;
  task_name: string;
  priority: "High" | "Medium" | "Low";
  sort_order: number;
  assigned_to: string | null;
  status: "Pending" | "In Progress" | "Done";
  qc_status: "Approved" | "Rejected" | null;
  qc_by: string | null;
  qc_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProjectTaskComment {
  id: string;
  project_task_id: string;
  author: string;
  message: string;
  created_at: string;
}

export interface ProjectTaskActivity {
  id: string;
  project_task_id: string;
  action: string;
  details: string | null;
  actor: string;
  created_at: string;
}

export const PROJECT_STATUSES = ["Active", "Completed", "On Hold"] as const;
export const PROJECT_TASK_STATUSES = ["Pending", "In Progress", "Done"] as const;
export const QC_STATUSES = ["Approved", "Rejected"] as const;

export interface PorterBooking {
  id: string;
  porter_id: string | null;
  supplier_name: string | null;
  receiver_name: string | null;
  materials: string[];
  approx_weight: string | null;
  pickup_location: string;
  drop_location: string;
  vehicle_type: "Bike" | "Scooter" | "3 Wheeler" | "4 Wheel Auto" | "Truck" | "Pickup" | null;
  contact: string | null;
  booking_date: string;
  booking_time: string | null;
  status: "Draft" | "Pending" | "Confirmed" | "In Transit" | "Completed" | "Cancelled";
  booked_by: string;
  booked_by_role: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export const PORTER_STATUSES = ["Draft", "Pending", "Confirmed", "In Transit", "Completed", "Cancelled"] as const;
export const VEHICLE_TYPES = ["Bike", "Scooter", "3 Wheeler", "4 Wheel Auto", "Truck"] as const;

export interface PorterSupplier {
  id: string;
  name: string;
  contact: string;
  address: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
