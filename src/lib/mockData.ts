// Local mock data for testing without Supabase
// All data persists in localStorage

const STORAGE_PREFIX = "wf_mock_";

function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function now(): string {
  return new Date().toISOString();
}

// Default seed data
const defaultData: Record<string, unknown[]> = {
  settings: [
    { id: generateId(), key: "admin_pin", value: "1234", created_at: now() },
  ],
  supervisors: [
    { id: generateId(), name: "Ravi Kumar", pin: "1111", department: "Maintenance", created_at: now() },
    { id: generateId(), name: "Priya Sharma", pin: "2222", department: "Production", created_at: now() },
    { id: generateId(), name: "Anand Raj", pin: "3333", department: "Logistics", created_at: now() },
  ],
  employees: [
    { id: generateId(), name: "Deepak M", pin: "5555", supervisor_name: "Ravi Kumar", phone: "9876543210", designation: "Field Worker", department: "Maintenance", created_at: now() },
    { id: generateId(), name: "Suresh P", pin: "5556", supervisor_name: "Ravi Kumar", phone: "9876543211", designation: "Technician", department: "Maintenance", created_at: now() },
    { id: generateId(), name: "Meena R", pin: "5557", supervisor_name: "Priya Sharma", phone: "9876543212", designation: "Operator", department: "Production", created_at: now() },
    { id: generateId(), name: "Karthik S", pin: "5558", supervisor_name: "Priya Sharma", phone: "9876543213", designation: "Helper", department: "Production", created_at: now() },
    { id: generateId(), name: "Gokul V", pin: "5559", supervisor_name: "Anand Raj", phone: "9876543214", designation: "Driver", department: "Logistics", created_at: now() },
  ],
  tasks: [
    { id: generateId(), task: "Install new pipeline at Block A", supervisor: "Ravi Kumar", priority: "High", due_date: "2026-04-05", status: "Pending", follow_up: "Check pressure after install", location: "Block A", location_gps: null, created_by: "Manager", assigned_to: "Deepak M", assigned_to_type: "employee", assigned_by: "Manager", created_at: now() },
    { id: generateId(), task: "Repair electrical panel", supervisor: "Ravi Kumar", priority: "Medium", due_date: "2026-04-03", status: "Done", follow_up: null, location: "Main Building", location_gps: null, created_by: "Manager", assigned_to: "Suresh P", assigned_to_type: "employee", assigned_by: "Manager", created_at: now() },
    { id: generateId(), task: "Quality check on production line", supervisor: "Priya Sharma", priority: "High", due_date: "2026-04-04", status: "Pending", follow_up: "Report by EOD", location: "Factory Floor", location_gps: null, created_by: "Manager", assigned_to: "Meena R", assigned_to_type: "employee", assigned_by: "Priya Sharma", created_at: now() },
    { id: generateId(), task: "Inventory audit", supervisor: "Priya Sharma", priority: "Low", due_date: "2026-04-01", status: "Delayed", follow_up: null, location: "Warehouse", location_gps: null, created_by: "Manager", assigned_to: null, assigned_to_type: "supervisor", assigned_by: "Manager", created_at: now() },
    { id: generateId(), task: "Vehicle maintenance - Truck 3", supervisor: "Anand Raj", priority: "Medium", due_date: "2026-04-06", status: "Pending", follow_up: "Oil change + brake check", location: "Garage", location_gps: null, created_by: "Manager", assigned_to: "Gokul V", assigned_to_type: "employee", assigned_by: "Anand Raj", created_at: now() },
    { id: generateId(), task: "Safety inspection", supervisor: "Anand Raj", priority: "High", due_date: "2026-04-02", status: "Done", follow_up: null, location: "All Blocks", location_gps: null, created_by: "Manager", assigned_to: null, assigned_to_type: "supervisor", assigned_by: "Manager", created_at: now() },
    { id: generateId(), task: "Paint work at office", supervisor: "Ravi Kumar", priority: "Low", due_date: "2026-04-08", status: "Pending", follow_up: null, location: "Admin Office", location_gps: null, created_by: "Manager", assigned_to: null, assigned_to_type: "supervisor", assigned_by: "Manager", created_at: now() },
    { id: generateId(), task: "Update attendance register", supervisor: "Priya Sharma", priority: "Medium", due_date: "2026-04-03", status: "Pending", follow_up: null, location: null, location_gps: null, created_by: "Manager", assigned_to: "Karthik S", assigned_to_type: "employee", assigned_by: "Priya Sharma", created_at: now() },
  ],
  leave_requests: [
    { id: generateId(), employee_name: "Deepak M", leave_type: "Casual", from_date: "2026-04-03", to_date: "2026-04-04", reason: "Family function", status: "Pending", approved_by: null, created_at: now() },
    { id: generateId(), employee_name: "Meena R", leave_type: "Sick", from_date: "2026-04-01", to_date: "2026-04-01", reason: "Fever", status: "Approved", approved_by: "Priya Sharma", created_at: now() },
    { id: generateId(), employee_name: "Gokul V", leave_type: "Earned", from_date: "2026-04-07", to_date: "2026-04-09", reason: "Hometown visit", status: "Pending", approved_by: null, created_at: now() },
    { id: generateId(), employee_name: "Ravi Kumar", leave_type: "Casual", from_date: "2026-04-05", to_date: "2026-04-05", reason: "Personal work", status: "Pending", approved_by: null, created_at: now() },
  ],
  notifications: [
    { id: generateId(), message: "New task assigned: Install new pipeline", type: "success", related_task_id: null, read: false, created_at: now() },
    { id: generateId(), message: "Leave request from Deepak M", type: "info", related_task_id: null, read: false, created_at: now() },
  ],
  comments: [],
  activity_log: [],
  attachments: [],
};

function getTable(table: string): unknown[] {
  if (typeof window === "undefined") return defaultData[table] || [];
  const key = STORAGE_PREFIX + table;
  const stored = localStorage.getItem(key);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* fallthrough */ }
  }
  // Seed with default data
  const seed = defaultData[table] || [];
  localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}

function saveTable(table: string, data: unknown[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(data));
}

// Chainable query builder that mimics Supabase API
interface QueryResult {
  data: unknown[] | unknown | null;
  error: null | { code: string; message: string };
}

class MockQueryBuilder {
  private table: string;
  private rows: Record<string, unknown>[];
  private filters: Array<{ col: string; op: string; val: unknown }> = [];
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private isSingle: boolean = false;
  private isInsert: boolean = false;
  private isUpdate: boolean = false;
  private isDelete: boolean = false;
  private isUpsert: boolean = false;
  private upsertConflict: string | null = null;
  private insertData: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private updateData: Record<string, unknown> | null = null;
  private selectCols: string | null = null;
  private doSelect: boolean = false;

  constructor(table: string) {
    this.table = table;
    this.rows = getTable(table) as Record<string, unknown>[];
  }

  select(cols?: string) {
    this.selectCols = cols || "*";
    return this;
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]) {
    this.isInsert = true;
    this.insertData = data;
    return this;
  }

  update(data: Record<string, unknown>) {
    this.isUpdate = true;
    this.updateData = data;
    return this;
  }

  upsert(data: Record<string, unknown>, opts?: { onConflict?: string }) {
    this.isUpsert = true;
    this.insertData = data;
    this.upsertConflict = opts?.onConflict || null;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = opts?.ascending !== false;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  private applyFilters(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.filter((row) =>
      this.filters.every((f) => {
        if (f.op === "eq") return row[f.col] === f.val;
        return true;
      })
    );
  }

  private applySelect(row: Record<string, unknown>): Record<string, unknown> {
    if (!this.selectCols || this.selectCols === "*") return { ...row };
    const cols = this.selectCols.split(",").map((c) => c.trim());
    const result: Record<string, unknown> = {};
    for (const col of cols) {
      if (col in row) result[col] = row[col];
    }
    return result;
  }

  private applyOrder(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    if (!this.orderCol) return rows;
    const col = this.orderCol;
    const asc = this.orderAsc;
    return [...rows].sort((a, b) => {
      const va = (a[col] as string) || "";
      const vb = (b[col] as string) || "";
      return asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  then(resolve: (result: QueryResult) => void, reject?: (err: unknown) => void): void {
    try {
      const result = this.execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
    }
  }

  private execute(): QueryResult {
    // INSERT
    if (this.isInsert && this.insertData) {
      const items = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      const created: Record<string, unknown>[] = [];
      for (const item of items) {
        const newRow = { id: generateId(), created_at: now(), ...item };
        this.rows.push(newRow);
        created.push(newRow);
      }
      saveTable(this.table, this.rows);
      if (this.isSingle) return { data: created[0], error: null };
      return { data: created, error: null };
    }

    // UPSERT
    if (this.isUpsert && this.insertData && !Array.isArray(this.insertData)) {
      const conflictCol = this.upsertConflict;
      if (conflictCol) {
        const existing = this.rows.find((r) => r[conflictCol] === (this.insertData as Record<string, unknown>)[conflictCol]);
        if (existing) {
          Object.assign(existing, this.insertData);
          saveTable(this.table, this.rows);
          return { data: existing, error: null };
        }
      }
      const newRow = { id: generateId(), created_at: now(), ...this.insertData };
      this.rows.push(newRow);
      saveTable(this.table, this.rows);
      return { data: newRow, error: null };
    }

    // UPDATE
    if (this.isUpdate && this.updateData) {
      const matched = this.applyFilters(this.rows);
      for (const row of matched) {
        const idx = this.rows.indexOf(row);
        if (idx >= 0) Object.assign(this.rows[idx], this.updateData);
      }
      saveTable(this.table, this.rows);
      if (this.isSingle) return { data: matched[0] ? { ...matched[0] } : null, error: null };
      return { data: matched, error: null };
    }

    // DELETE
    if (this.isDelete) {
      const before = this.rows.length;
      const filtered = this.applyFilters(this.rows);
      const ids = new Set(filtered.map((r) => r.id));
      this.rows = this.rows.filter((r) => !ids.has(r.id));
      saveTable(this.table, this.rows);
      return { data: filtered, error: null };
    }

    // SELECT
    let result = this.applyFilters(this.rows);
    result = this.applyOrder(result);
    result = result.map((r) => this.applySelect(r));

    if (this.isSingle) {
      return { data: result[0] || null, error: result[0] ? null : { code: "PGRST116", message: "not found" } };
    }
    return { data: result, error: null };
  }
}

// Mock channel for realtime (no-op)
class MockChannel {
  on() { return this; }
  subscribe() { return this; }
}

// Mock Supabase client
export const mockSupabase = {
  from(table: string) {
    return new MockQueryBuilder(table);
  },
  channel() {
    return new MockChannel();
  },
  removeChannel() {},
};

// Reset all mock data (for testing)
export function resetMockData(): void {
  if (typeof window === "undefined") return;
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  });
  // Re-seed
  for (const table of Object.keys(defaultData)) {
    localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(defaultData[table]));
  }
}
