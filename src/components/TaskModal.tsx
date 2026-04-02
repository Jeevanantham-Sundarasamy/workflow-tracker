"use client";

import { X, MapPin, Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import type { Task } from "@/lib/types";
import { STATUSES, PRIORITIES } from "@/lib/types";

interface TaskModalProps {
  open: boolean;
  task: Task | null;
  supervisors: string[];
  employees?: { name: string; supervisor_name: string | null }[];
  roleName?: string;
  onClose: () => void;
  onSave: (data: Omit<Task, "id" | "created_at">) => void;
}

export default function TaskModal({
  open,
  task,
  supervisors,
  employees = [],
  roleName = "Admin",
  onClose,
  onSave,
}: TaskModalProps) {
  const [form, setForm] = useState({
    task: "",
    supervisor: "",
    priority: "Medium" as Task["priority"],
    due_date: "",
    status: "Pending" as Task["status"],
    follow_up: "",
    location: "",
    location_gps: "",
    assigned_to: "" as string,
    assigned_to_type: "supervisor" as "supervisor" | "employee",
  });

  useEffect(() => {
    if (task) {
      setForm({
        task: task.task,
        supervisor: task.supervisor,
        priority: task.priority,
        due_date: task.due_date,
        status: task.status,
        follow_up: task.follow_up || "",
        location: task.location || "",
        location_gps: task.location_gps || "",
        assigned_to: task.assigned_to || "",
        assigned_to_type: task.assigned_to_type || "supervisor",
      });
    } else {
      setForm({
        task: "",
        supervisor: supervisors[0] || "",
        priority: "Medium",
        due_date: "",
        status: "Pending",
        follow_up: "",
        location: "",
        location_gps: "",
        assigned_to: "",
        assigned_to_type: "supervisor",
      });
    }
  }, [task, open, supervisors]);

  if (!open) return null;

  // Get employees for selected supervisor
  const filteredEmployees = employees.filter(
    (e) => e.supervisor_name === form.supervisor
  );

  const handleSubmit = () => {
    if (!form.task.trim() || !form.due_date) {
      alert("Task name and due date are required.");
      return;
    }
    if (!form.supervisor) {
      alert("Please select a supervisor to assign the task.");
      return;
    }
    onSave({
      ...form,
      follow_up: form.follow_up || null,
      location: form.location || null,
      location_gps: form.location_gps || null,
      created_by: roleName,
      assigned_to: form.assigned_to || null,
      assigned_to_type: form.assigned_to ? form.assigned_to_type : null,
      assigned_by: roleName,
    });
  };

  const getGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({
          ...form,
          location_gps: `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`,
        });
      },
      () => alert("Could not get location")
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-lg font-bold text-gray-900">
            {task ? "Edit Task" : "New Task"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Task Name */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Task Name
            </label>
            <input
              type="text"
              value={form.task}
              onChange={(e) => setForm({ ...form, task: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
            />
          </div>

          {/* Row: Supervisor + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Supervisor
              </label>
              <select
                value={form.supervisor}
                onChange={(e) => setForm({ ...form, supervisor: e.target.value, assigned_to: "" })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              >
                {supervisors.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Assign to Employee (optional) */}
          {filteredEmployees.length > 0 && (
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Assign to Employee <span className="normal-case text-gray-300">(optional)</span>
              </label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value, assigned_to_type: e.target.value ? "employee" : "supervisor" })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              >
                <option value="">Supervisor only</option>
                {filteredEmployees.map((e) => (
                  <option key={e.name} value={e.name}>{e.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Row: Due Date + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              <MapPin className="w-3 h-3 inline mr-1" />Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Building A, Floor 2"
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              />
              <button
                type="button"
                onClick={getGPS}
                title="Get GPS"
                className="w-10 h-10 rounded-xl border border-border hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary-600 transition"
              >
                <Navigation className="w-4 h-4" />
              </button>
            </div>
            {form.location_gps && (
              <p className="text-[10px] text-gray-400 mt-1">GPS: {form.location_gps}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Notes
            </label>
            <input
              type="text"
              value={form.follow_up}
              onChange={(e) => setForm({ ...form, follow_up: e.target.value })}
              placeholder="Optional notes..."
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition shadow-sm"
          >
            {task ? "Update Task" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
}
