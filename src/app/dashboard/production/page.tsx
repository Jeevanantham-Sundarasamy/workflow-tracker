"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Project, MachineType, ProjectTask } from "@/lib/types";
import { PROJECT_STATUSES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus, Search, Filter, Settings2, ChevronRight, Calendar, User,
  Package, Clock, CheckCircle2, X, AlertTriangle, Pencil, Trash2,
} from "lucide-react";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  Active: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "On Hold": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
};

export default function ProductionPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, userName, login } = useAuth();
  const canEdit = hasFullAccess || isSupervisor;
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [projects, setProjects] = useState<(Project & { machine_type_name: string; progress: number; total: number; done: number })[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ machine_type_id: "", serial_number: "", customer_name: "", start_date: "", due_date: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pRes, mtRes, ptRes] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("machine_types").select("*").order("name"),
        supabase.from("project_tasks").select("id, project_id, status"),
      ]);
      const mts = mtRes.data || [];
      const pts = ptRes.data || [];
      const mtMap = Object.fromEntries(mts.map((m: MachineType) => [m.id, m.name]));

      const projectsWithProgress = (pRes.data || []).map((p: Project) => {
        const tasks = pts.filter((t: ProjectTask) => t.project_id === p.id);
        const done = tasks.filter((t: ProjectTask) => t.status === "Done").length;
        return { ...p, machine_type_name: mtMap[p.machine_type_id] || "Unknown", progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0, total: tasks.length, done };
      });

      setProjects(projectsWithProgress);
      setMachineTypes(mts);
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = projects.filter((p) => {
    if (filterStatus !== "All" && p.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.serial_number.toLowerCase().includes(q) || p.customer_name.toLowerCase().includes(q) || p.machine_type_name.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: projects.length,
    active: projects.filter((p) => p.status === "Active").length,
    completed: projects.filter((p) => p.status === "Completed").length,
    onHold: projects.filter((p) => p.status === "On Hold").length,
  };

  const handleCreate = async () => {
    if (!form.machine_type_id || !form.serial_number.trim() || !form.customer_name.trim() || !form.start_date || !form.due_date) {
      toast("All fields are required", "error"); return;
    }
    setSubmitting(true);

    // Create project
    const { data: project, error } = await supabase.from("projects").insert({
      machine_type_id: Number(form.machine_type_id),
      serial_number: form.serial_number.trim(),
      customer_name: form.customer_name.trim(),
      start_date: form.start_date,
      due_date: form.due_date,
      created_by: userName || "Admin",
    }).select().single();

    if (error || !project) {
      toast("Failed to create project", "error");
      setSubmitting(false);
      return;
    }

    // Fetch template departments + tasks
    const { data: depts } = await supabase.from("machine_type_departments")
      .select("id, name, sort_order")
      .eq("machine_type_id", form.machine_type_id)
      .order("sort_order");

    if (depts && depts.length > 0) {
      const deptIds = depts.map((d: { id: number }) => d.id);
      const { data: tasks } = await supabase.from("machine_type_tasks")
        .select("department_id, name, priority, sort_order")
        .in("department_id", deptIds)
        .order("sort_order");

      const deptMap = Object.fromEntries(depts.map((d: { id: number; name: string }) => [d.id, d.name]));
      const projectTasks = (tasks || []).map((t: { department_id: number; name: string; priority: string; sort_order: number }) => ({
        project_id: project.id,
        department_name: deptMap[t.department_id],
        task_name: t.name,
        priority: t.priority || "Medium",
        sort_order: t.sort_order,
      }));

      if (projectTasks.length > 0) {
        await supabase.from("project_tasks").insert(projectTasks);
      }
    }

    toast("Project created!", "success");
    setModalOpen(false);
    setForm({ machine_type_id: "", serial_number: "", customer_name: "", start_date: "", due_date: "" });
    setSubmitting(false);
    loadData();
  };

  // Edit project
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", serial_number: "", customer_name: "", start_date: "", due_date: "", status: "Active" });

  const openEdit = (p: Project & { machine_type_name: string }) => {
    setEditForm({ id: p.id, serial_number: p.serial_number, customer_name: p.customer_name, start_date: p.start_date, due_date: p.due_date, status: p.status });
    setEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!editForm.serial_number.trim() || !editForm.customer_name.trim()) { toast("Fields required", "error"); return; }
    const { error } = await supabase.from("projects").update({
      serial_number: editForm.serial_number.trim(),
      customer_name: editForm.customer_name.trim(),
      start_date: editForm.start_date,
      due_date: editForm.due_date,
      status: editForm.status,
    }).eq("id", editForm.id);
    if (!error) { setEditModalOpen(false); loadData(); toast("Project updated", "success"); }
    else toast("Update failed", "error");
  };

  const deleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}" and all its tasks?`)) return;
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (!error) { setProjects((p) => p.filter((pr) => pr.id !== id)); toast("Deleted", "success"); }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Production</h1>
            <p className="text-sm text-gray-400">{stats.total} projects · {stats.active} active</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href="/dashboard/production/machine-types"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-white border border-border px-3 py-2 rounded-xl hover:bg-gray-50 transition">
                <Settings2 className="w-3.5 h-3.5" /> Machine Types
              </Link>
            )}
            {canEdit && (
              <button onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
                <Plus className="w-4 h-4" /> New Project
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", count: stats.total, color: "text-gray-900", bg: "bg-gray-50" },
            { label: "Active", count: stats.active, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Completed", count: stats.completed, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "On Hold", count: stats.onHold, color: "text-amber-600", bg: "bg-amber-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-border`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search serial no, customer, machine type..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="text-xs font-semibold px-3 py-2.5 rounded-xl border border-border bg-white cursor-pointer focus:outline-none">
              <option value="All">All Status</option>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Project List */}
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl border border-border p-6 h-32 animate-pulse" />)}</div>
        ) : filtered.length ? (
          <div className="space-y-3">
            {filtered.map((p) => {
              const st = statusColors[p.status] || statusColors.Active;
              const isOverdue = p.status === "Active" && p.due_date < today;
              return (
                <div key={p.id}
                  className={`bg-white rounded-2xl border p-5 hover:shadow-md transition ${isOverdue ? "border-l-4 border-l-red-400 border-t-border border-r-border border-b-border" : "border-border"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link href={`/dashboard/production/projects/${p.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-bold text-gray-900">{p.serial_number}</h3>
                        <span className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{p.machine_type_name}</span>
                        {isOverdue && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Overdue</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {p.customer_name}</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {p.start_date} → {p.due_date}</span>
                        <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {p.done}/{p.total} tasks</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(p)}
                            className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-lg transition">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteProject(p.id, p.serial_number)}
                            className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${st.bg} ${st.text} ${st.border}`}>{p.status}</span>
                      <Link href={`/dashboard/production/projects/${p.id}`}><ChevronRight className="w-4 h-4 text-gray-300" /></Link>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${p.progress === 100 ? "bg-emerald-500" : p.progress > 50 ? "bg-blue-500" : "bg-amber-400"}`}
                        style={{ width: `${p.progress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-10 text-right">{p.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border p-16 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No projects yet</p>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-base font-bold text-gray-900">New Project</h2>
              <button onClick={() => setModalOpen(false)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              {machineTypes.length === 0 ? (
                <div className="text-center py-4">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No machine types yet. <Link href="/dashboard/production/machine-types" className="text-primary-600 font-semibold hover:underline">Create one first</Link></p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Machine Type <span className="text-red-400">*</span></label>
                    <select value={form.machine_type_id} onChange={(e) => setForm({ ...form, machine_type_id: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                      <option value="">Select machine type</option>
                      {machineTypes.map((mt) => <option key={mt.id} value={mt.id}>{mt.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Serial Number <span className="text-red-400">*</span></label>
                    <input type="text" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                      placeholder="e.g. SN-2024-001"
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Customer Name <span className="text-red-400">*</span></label>
                    <input type="text" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                      placeholder="Customer company name"
                      className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Start Date <span className="text-red-400">*</span></label>
                      <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Due Date <span className="text-red-400">*</span></label>
                      <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                    <button onClick={handleCreate} disabled={submitting}
                      className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition disabled:opacity-50">
                      {submitting ? "Creating..." : "Create Project"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setEditModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-base font-bold text-gray-900">Edit Project</h2>
              <button onClick={() => setEditModalOpen(false)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Serial Number <span className="text-red-400">*</span></label>
                <input type="text" value={editForm.serial_number} onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Customer Name <span className="text-red-400">*</span></label>
                <input type="text" value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Start Date</label>
                  <input type="date" value={editForm.start_date} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Due Date</label>
                  <input type="date" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Status</label>
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                  {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleEdit} className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
