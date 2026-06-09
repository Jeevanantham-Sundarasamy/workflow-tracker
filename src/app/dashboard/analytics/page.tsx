"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Project, ProjectTask, MachineType } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import LoginRequired from "@/components/LoginRequired";
import { ChevronDown } from "lucide-react";

const TASK_COLORS = {
  Pending: "#f59e0b",
  "In Progress": "#3b82f6",
  Done: "#10b981",
};

type ProjectWithTasks = Project & {
  machine_type_name: string;
  tasks: ProjectTask[];
};

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { login } = useAuth();
  const [projects, setProjects] = useState<ProjectWithTasks[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [pr, mtr, ptr] = await Promise.all([
      supabase.from("projects").select("*").order("serial_number"),
      supabase.from("machine_types").select("*"),
      supabase.from("project_tasks").select("*"),
    ]);
    const mtMap = Object.fromEntries((mtr.data || []).map((m: MachineType) => [m.id, m.name]));
    const rows: ProjectWithTasks[] = (pr.data || []).map((p: Project) => ({
      ...p,
      machine_type_name: mtMap[p.machine_type_id] || "Unknown",
      tasks: (ptr.data || []).filter((t: ProjectTask) => t.project_id === p.id),
    }));
    setProjects(rows);
    if (rows.length > 0) setSelectedId(String(rows[0].id));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const project = projects.find((p) => String(p.id) === selectedId) || null;

  const tasks = project?.tasks || [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const inProgress = tasks.filter((t) => t.status === "In Progress").length;
  const pending = tasks.filter((t) => t.status === "Pending").length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = project?.status === "Active" && project?.due_date < today;

  // Department breakdown
  const deptMap: Record<string, { Pending: number; "In Progress": number; Done: number; total: number }> = {};
  tasks.forEach((t) => {
    const d = t.department_name || "General";
    if (!deptMap[d]) deptMap[d] = { Pending: 0, "In Progress": 0, Done: 0, total: 0 };
    if (t.status in deptMap[d]) deptMap[d][t.status as "Pending" | "In Progress" | "Done"]++;
    deptMap[d].total++;
  });
  const deptData = Object.entries(deptMap)
    .map(([dept, counts]) => ({
      dept: dept.length > 14 ? dept.slice(0, 14) + "…" : dept,
      fullDept: dept,
      ...counts,
      progress: counts.total ? Math.round((counts.Done / counts.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const pieData = [
    { name: "Pending", value: pending, color: TASK_COLORS.Pending },
    { name: "In Progress", value: inProgress, color: TASK_COLORS["In Progress"] },
    { name: "Done", value: done, color: TASK_COLORS.Done },
  ].filter((d) => d.value > 0);

  return (
    <LoginRequired>
      <div className="flex flex-col min-h-screen">
        <Topbar onLoginClick={() => setPinModalOpen(true)} />

        <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">

          {/* Machine Selector */}
          <div className="bg-white rounded-2xl border border-border p-4 sm:p-5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Select Machine</label>
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full appearance-none px-4 py-3 pr-10 rounded-xl border border-border bg-white text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.serial_number} — {p.customer_name} ({p.machine_type_name})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !project ? (
            <div className="bg-white rounded-2xl border border-border p-16 text-center">
              <p className="text-sm text-gray-400">No projects found</p>
            </div>
          ) : (<>

            {/* Project Info Card */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-gray-900">{project.serial_number}</h2>
                  <p className="text-sm text-gray-500">{project.customer_name}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                    project.status === "Completed" ? "bg-emerald-50 text-emerald-600" :
                    project.status === "Active" ? "bg-blue-50 text-blue-600" :
                    "bg-orange-50 text-orange-500"
                  }`}>{project.status}</span>
                  {isOverdue && (
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-500">Overdue</span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                {[
                  { label: "Machine Type", value: project.machine_type_name },
                  { label: "Color Type", value: project.color_type || "—" },
                  { label: "Customer Machine No.", value: project.customer_machine_number || "—" },
                  { label: "Due Date", value: project.due_date || "—" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">{item.label}</p>
                    <p className="font-bold text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Tasks", value: total, color: "text-gray-900", bg: "bg-gray-50" },
                { label: "Pending", value: pending, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "In Progress", value: inProgress, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Done", value: done, color: "text-emerald-600", bg: "bg-emerald-50" },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-2xl border border-border p-4 text-center`}>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[11px] font-semibold text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Overall progress bar */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-900">Overall Progress</span>
                <span className={`text-lg font-black ${progress === 100 ? "text-emerald-600" : "text-gray-800"}`}>{progress}%</span>
              </div>
              <div className="flex h-4 rounded-full overflow-hidden bg-gray-100">
                {pending > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(pending / total) * 100}%` }} />}
                {inProgress > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(inProgress / total) * 100}%` }} />}
                {done > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />}
              </div>
              <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Pending</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done</span>
              </div>
            </div>

            {/* Task Status Pie + Department Bar */}
            {total > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Task Status Distribution</h3>
                  <div className="h-56 flex items-center justify-center gap-8">
                    <div className="relative flex-shrink-0">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie data={pieData} innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value" strokeWidth={0}>
                            {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-gray-900">{progress}%</span>
                        <span className="text-[10px] text-gray-400 font-medium">Done</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-xs text-gray-600 font-medium">{d.name}</span>
                          <span className="text-sm font-black text-gray-900 ml-auto pl-4">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-border p-6">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Tasks by Department</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptData} layout="vertical" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} width={85} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                          labelFormatter={(_: unknown, payload: Array<{ payload?: { fullDept?: string } }>) => payload?.[0]?.payload?.fullDept || ""}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Pending" stackId="a" fill={TASK_COLORS.Pending} />
                        <Bar dataKey="In Progress" stackId="a" fill={TASK_COLORS["In Progress"]} />
                        <Bar dataKey="Done" stackId="a" fill={TASK_COLORS.Done} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Department Progress Bars */}
            {deptData.length > 0 && (
              <div className="bg-white rounded-2xl border border-border p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-5">Department Progress</h3>
                <div className="space-y-4">
                  {deptData.map((d) => (
                    <div key={d.fullDept}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-gray-700">{d.fullDept}</span>
                        <div className="flex items-center gap-3 text-[11px] text-gray-400">
                          <span>{d.Done}/{d.total} done</span>
                          <span className={`font-black ${d.progress === 100 ? "text-emerald-600" : "text-gray-700"}`}>{d.progress}%</span>
                        </div>
                      </div>
                      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100">
                        {d.Pending > 0 && <div className="bg-amber-400" style={{ width: `${(d.Pending / d.total) * 100}%` }} />}
                        {d["In Progress"] > 0 && <div className="bg-blue-500" style={{ width: `${(d["In Progress"] / d.total) * 100}%` }} />}
                        {d.Done > 0 && <div className="bg-emerald-500" style={{ width: `${(d.Done / d.total) * 100}%` }} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>)}
        </div>

        <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
          onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
      </div>
    </LoginRequired>
  );
}
