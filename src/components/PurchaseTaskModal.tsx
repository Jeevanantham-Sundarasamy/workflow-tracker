"use client";

import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { Task } from "@/lib/types";
import { STATUSES, PRIORITIES } from "@/lib/types";

interface PurchaseTaskModalProps {
  open: boolean;
  task: Task | null;
  employees?: { name: string; supervisor_names: string[] | null }[];
  supervisors?: string[];
  roleName?: string;
  onClose: () => void;
  onSave: (data: Omit<Task, "id" | "created_at">) => void;
}

export default function PurchaseTaskModal({
  open,
  task,
  employees = [],
  supervisors = [],
  roleName = "Admin",
  onClose,
  onSave,
}: PurchaseTaskModalProps) {
  const [form, setForm] = useState({
    task: "",
    priority: "Medium" as Task["priority"],
    assigned_to: "",
    assigned_to_type: "employee" as "supervisor" | "employee",
    extra_assignees: [] as string[],
    due_date: "",
    status: "Pending" as Task["status"],
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
        due_date: task.due_date,
        status: task.status,
        notes: task.follow_up || "",
      });
    } else {
      setForm({
        task: "",
        priority: "Medium",
        assigned_to: "",
        assigned_to_type: "employee",
        extra_assignees: [],
        due_date: "",
        status: "Pending",
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

    const assignedPerson = allPeople.find((p) => p.name === form.assigned_to);
    onSave({
      task: form.task.trim(),
      supervisor: "",
      priority: form.priority,
      due_date: form.due_date,
      status: form.status,
      follow_up: form.notes.trim() || null,
      location: null,
      location_gps: null,
      created_by: roleName,
      assigned_to: form.assigned_to || null,
      assigned_to_type: assignedPerson?.type || null,
      assigned_by: roleName,
      extra_assignees: form.extra_assignees.filter(Boolean).length > 0 ? form.extra_assignees.filter(Boolean) : null,
      project_id: null,
      customer_id: null,
      task_type: "purchase",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{task ? "Edit Purchase Task" : "New Purchase Task"}</h2>
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wide">Purchase</span>
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
              placeholder="What needs to be purchased?"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Priority <span className="text-red-400">*</span></label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition">
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
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition">
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition">
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
              className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition">
              + Add person
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Due Date <span className="text-red-400">*</span></label>
            <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any additional notes..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition resize-none" />
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-2 border-t border-border">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition shadow-sm">
            {task ? "Update" : "Create Purchase Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
