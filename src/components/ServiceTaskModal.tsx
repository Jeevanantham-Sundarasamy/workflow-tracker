"use client";

import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { Task } from "@/lib/types";
import { STATUSES, PRIORITIES } from "@/lib/types";

interface ProjectOption { id: string; serial_number: string; customer_name: string; machine_type_name: string; }

interface ServiceTaskModalProps {
  open: boolean;
  task: Task | null;
  employees?: { name: string; supervisor_names: string[] | null }[];
  supervisors?: string[];
  projects?: ProjectOption[];
  customers?: { id: string; name: string }[];
  roleName?: string;
  onClose: () => void;
  onSave: (data: Omit<Task, "id" | "created_at">) => void;
}

export default function ServiceTaskModal({
  open,
  task,
  employees = [],
  supervisors = [],
  projects = [],
  customers = [],
  roleName = "Admin",
  onClose,
  onSave,
}: ServiceTaskModalProps) {
  const [form, setForm] = useState({
    task: "",
    priority: "Medium" as Task["priority"],
    assigned_to: "",
    assigned_to_type: "employee" as "supervisor" | "employee",
    extra_assignees: [] as string[],
    project_id: "",
    customer_id: "",
    due_date: "",
    status: "Pending" as Task["status"],
    location: "",
    notes: "",
  });

  useEffect(() => {
    if (task) {
      setForm({
        task: task.task,
        priority: task.priority,
        assigned_to: task.assigned_to || "",
        assigned_to_type: task.assigned_to_type || "employee",
        extra_assignees: task.extra_assignees || [],
        project_id: task.project_id || "",
        customer_id: task.customer_id || "",
        due_date: task.due_date,
        status: task.status,
        location: task.location || "",
        notes: task.follow_up || "",
      });
    } else {
      setForm({
        task: "",
        priority: "Medium",
        assigned_to: "",
        assigned_to_type: "employee",
        extra_assignees: [],
        project_id: "",
        customer_id: "",
        due_date: "",
        status: "Pending",
        location: "",
        notes: "",
      });
    }
  }, [task, open]);

  if (!open) return null;

  const allPeople = [
    ...supervisors.map((s) => ({ name: s, type: "supervisor" as const })),
    ...employees.map((e) => ({ name: e.name, type: "employee" as const })),
  ];

  const handleSubmit = () => {
    if (!form.task.trim()) { alert("Task name is required."); return; }
    if (!form.due_date) { alert("Due date is required."); return; }
    if (!form.location.trim()) { alert("Location is required."); return; }

    const assignedPerson = allPeople.find((p) => p.name === form.assigned_to);
    onSave({
      task: form.task.trim(),
      supervisor: "",
      priority: form.priority,
      due_date: form.due_date,
      status: form.status,
      follow_up: form.notes.trim() || null,
      location: form.location.trim(),
      location_gps: null,
      created_by: roleName,
      assigned_to: form.assigned_to || null,
      assigned_to_type: assignedPerson?.type || null,
      assigned_by: roleName,
      extra_assignees: form.extra_assignees.filter(Boolean).length > 0 ? form.extra_assignees.filter(Boolean) : null,
      project_id: form.project_id || null,
      customer_id: form.customer_id || null,
      task_type: "service",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{task ? "Edit Service Task" : "New Service Task"}</h2>
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wide">Service</span>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Task Name <span className="text-red-400">*</span></label>
            <input type="text" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Priority <span className="text-red-400">*</span></label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Assign To</label>
            <select value={form.assigned_to}
              onChange={(e) => {
                const person = allPeople.find((p) => p.name === e.target.value);
                setForm({ ...form, assigned_to: e.target.value, assigned_to_type: person?.type || "employee" });
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition">
              <option value="">Unassigned</option>
              {supervisors.length > 0 && (
                <optgroup label="Supervisors">
                  {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
                </optgroup>
              )}
              {employees.length > 0 && (
                <optgroup label="Employees">
                  {employees.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Extra People <span className="normal-case text-gray-300">(optional)</span></label>
            {form.extra_assignees.map((person, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={person}
                  onChange={(e) => {
                    const updated = [...form.extra_assignees];
                    updated[idx] = e.target.value;
                    setForm({ ...form, extra_assignees: updated });
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition">
                  <option value="">Select person...</option>
                  {allPeople
                    .filter((p) => p.name !== form.assigned_to && (!form.extra_assignees.includes(p.name) || p.name === person))
                    .map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <button type="button"
                  onClick={() => setForm({ ...form, extra_assignees: form.extra_assignees.filter((_, i) => i !== idx) })}
                  className="w-10 h-10 rounded-xl border border-border hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button"
              onClick={() => setForm({ ...form, extra_assignees: [...form.extra_assignees, ""] })}
              className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
              + Add person
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Project <span className="normal-case text-gray-300">(optional)</span></label>
            {projects.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">No active projects available.</p>
            ) : (
              <select value={form.project_id}
                onChange={(e) => {
                  const proj = projects.find((p) => p.id === e.target.value);
                  const matchedCustomer = proj ? customers.find((c) => c.name === proj.customer_name) : null;
                  setForm({ ...form, project_id: e.target.value, customer_id: matchedCustomer?.id || form.customer_id });
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition">
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.serial_number} — {p.customer_name}</option>)}
              </select>
            )}
          </div>

          {customers.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Customer</label>
              <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition">
                <option value="">No customer</option>
                {customers.filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Due Date <span className="text-red-400">*</span></label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Location <span className="text-red-400">*</span></label>
            <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Customer site, Warehouse..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition resize-none" />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-2 border-t border-border">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition shadow-sm">
            {task ? "Update" : "Create Service Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
