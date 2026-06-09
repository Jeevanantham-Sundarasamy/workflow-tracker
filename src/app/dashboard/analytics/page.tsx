"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Task, Supervisor, Employee, Customer, Project, ProjectTask, MachineType } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CalendarDays } from "lucide-react";
import LoginRequired from "@/components/LoginRequired";
const COLORS: Record<string, string> = { Pending: "#f59e0b", "In Progress": "#3b82f6", Done: "#10b981", Delayed: "#ef4444", "On Hold": "#f97316", Cancelled: "#94a3b8" };

export default function AnalyticsPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, userName, login } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [supervisorRecords, setSupervisorRecords] = useState<Supervisor[]>([]);
  const [employeeRecords, setEmployeeRecords] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<(Project & { machine_type_name: string; progress: number; total: number; done: number; pending: number; inProgress: number })[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [connection, setConnection] = useState<"live" | "offline" | "connecting">("connecting");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("All");

  const loadData = useCallback(async () => {
    try {
      const [tr, sr, er, cr, pr, mtr, ptr] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("supervisors").select("*").order("name"),
        supabase.from("employees").select("*").order("name"),
        supabase.from("customers").select("*").order("name"),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("machine_types").select("*"),
        supabase.from("project_tasks").select("id, project_id, status"),
      ]);
      if (tr.error) throw tr.error; if (sr.error) throw sr.error;
      setTasks(tr.data || []);
      setSupervisorRecords(sr.data || []);
      setEmployeeRecords(er.data || []);
      setCustomers(cr.data || []);
      setSupervisors((sr.data || []).map((s: { name: string }) => s.name));
      const mtMap = Object.fromEntries((mtr.data || []).map((m: MachineType) => [m.id, m.name]));
      setProjects((pr.data || []).map((p: Project) => {
        const pts = (ptr.data || []).filter((t: ProjectTask) => t.project_id === p.id);
        const done = pts.filter((t: ProjectTask) => t.status === "Done").length;
        const inProgress = pts.filter((t: ProjectTask) => t.status === "In Progress").length;
        const pending = pts.filter((t: ProjectTask) => t.status === "Pending").length;
        return { ...p, machine_type_name: mtMap[p.machine_type_id] || "Unknown", total: pts.length, done, inProgress, pending, progress: pts.length ? Math.round((done / pts.length) * 100) : 0 };
      }));
      setConnection("live");
    } catch { setConnection("offline"); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Role-based filtering
  const roleFiltered = tasks.filter((t) => {
    if (hasFullAccess) return true;
    if (isSupervisor) return t.supervisor === userName;
    return true;
  });

  const filtered = roleFiltered.filter((t) => {
    if (dateFrom && t.due_date < dateFrom) return false;
    if (dateTo && t.due_date > dateTo) return false;
    if (filterCustomer !== "All" && t.customer_id !== filterCustomer) return false;
    return true;
  });

  // Per-machine / per-customer progress
  const machineProgress = customers
    .map((c) => {
      const ct = roleFiltered.filter((t) => t.customer_id === c.id);
      if (ct.length === 0) return null;
      return {
        id: c.id,
        name: c.name,
        machine: c.machine_number || "—",
        total: ct.length,
        pending: ct.filter((t) => t.status === "Pending").length,
        inProgress: ct.filter((t) => t.status === "In Progress").length,
        done: ct.filter((t) => t.status === "Done").length,
        delayed: ct.filter((t) => t.status === "Delayed").length,
        onHold: ct.filter((t) => t.status === "On Hold").length,
        cancelled: ct.filter((t) => t.status === "Cancelled").length,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .filter((m) => filterCustomer === "All" || m.id === filterCustomer);

  const today = new Date().toISOString().split("T")[0];
  const total = filtered.length;
  const completionPct = total ? Math.round((filtered.filter((t) => t.status === "Done").length / total) * 100) : 0;
  const overdueCount = filtered.filter((t) => t.status !== "Done" && t.status !== "Cancelled" && t.due_date < today).length;

  const supChartData = supervisors.map((sup) => {
    const st = filtered.filter((t) => t.supervisor === sup);
    return { name: sup.length > 10 ? sup.slice(0, 10) + "..." : sup,
      Pending: st.filter((t) => t.status === "Pending").length,
      "In Progress": st.filter((t) => t.status === "In Progress").length,
      Done: st.filter((t) => t.status === "Done").length,
      Delayed: st.filter((t) => t.status === "Delayed").length };
  });

  const completionData = [
    { name: "Completed", value: filtered.filter((t) => t.status === "Done").length },
    { name: "Remaining", value: filtered.filter((t) => t.status !== "Done").length },
  ].filter((d) => d.value > 0);

  const overdueTrend: { date: string; overdue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    overdueTrend.push({ date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      overdue: roleFiltered.filter((t) => t.status !== "Done" && t.due_date <= dateStr).length });
  }

  const priorityData = [
    { name: "High", value: filtered.filter((t) => t.priority === "High").length, color: "#ef4444" },
    { name: "Medium", value: filtered.filter((t) => t.priority === "Medium").length, color: "#f59e0b" },
    { name: "Low", value: filtered.filter((t) => t.priority === "Low").length, color: "#94a3b8" },
  ].filter((d) => d.value > 0);

  // Project analytics data
  const projectStatusData = [
    { name: "Active", value: projects.filter((p) => p.status === "Active").length, color: "#3b82f6" },
    { name: "Completed", value: projects.filter((p) => p.status === "Completed").length, color: "#10b981" },
    { name: "On Hold", value: projects.filter((p) => p.status === "On Hold").length, color: "#f97316" },
  ].filter((d) => d.value > 0);

  const projectProgressData = projects
    .filter((p) => p.total > 0)
    .slice(0, 10)
    .map((p) => ({
      name: p.serial_number.length > 12 ? p.serial_number.slice(0, 12) + "…" : p.serial_number,
      customer: p.customer_name,
      Pending: p.pending,
      "In Progress": p.inProgress,
      Done: p.done,
      total: p.total,
    }));

  const machineTypeData = Object.entries(
    projects.reduce((acc, p) => { acc[p.machine_type_name] = (acc[p.machine_type_name] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Department-wise task data
  const personDeptMap = new Map<string, string>();
  for (const s of supervisorRecords) { if (s.department) personDeptMap.set(s.name, s.department); }
  for (const e of employeeRecords) { if (e.department) personDeptMap.set(e.name, e.department); }
  const getTaskDept = (t: Task): string | null =>
    personDeptMap.get(t.supervisor) || (t.assigned_to ? personDeptMap.get(t.assigned_to) : null) || null;
  const allDepartments = Array.from(new Set(
    [...supervisorRecords.map((s) => s.department), ...employeeRecords.map((e) => e.department)]
      .filter(Boolean) as string[]
  )).sort();
  const deptChartData = allDepartments.map((dept) => {
    const dt = filtered.filter((t) => getTaskDept(t) === dept);
    return {
      name: dept,
      Pending: dt.filter((t) => t.status === "Pending").length,
      "In Progress": dt.filter((t) => t.status === "In Progress").length,
      Done: dt.filter((t) => t.status === "Done").length,
      Delayed: dt.filter((t) => t.status === "Delayed").length,
    };
  });

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-400">{filtered.length} tasks &middot; {completionPct}% completed &middot; {overdueCount} overdue</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {customers.length > 0 && (
              <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
                className="text-xs font-semibold px-3 py-2 rounded-xl border border-border bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                <option value="All">All Customers / Machines</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.machine_number ? ` — ${c.machine_number}` : ""}
                  </option>
                ))}
              </select>
            )}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-border p-2">
              <CalendarDays className="w-4 h-4 text-gray-400 ml-1" />
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs font-medium border-none bg-transparent outline-none text-gray-700" />
              <span className="text-xs text-gray-400">to</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs font-medium border-none bg-transparent outline-none text-gray-700" />
              {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">Clear</button>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Tasks per Supervisor</h3>
            {supChartData.length ? (
              <div className="h-64"><ResponsiveContainer width="100%" height="100%">
                <BarChart data={supChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Pending" fill={COLORS.Pending} radius={[4, 4, 0, 0]} /><Bar dataKey="In Progress" fill={COLORS["In Progress"]} radius={[4, 4, 0, 0]} /><Bar dataKey="Done" fill={COLORS.Done} radius={[4, 4, 0, 0]} /><Bar dataKey="Delayed" fill={COLORS.Delayed} radius={[4, 4, 0, 0]} />
                </BarChart></ResponsiveContainer></div>
            ) : <p className="text-xs text-gray-400 text-center py-12">No data</p>}
          </div>

          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Completion Rate</h3>
            {completionData.length ? (
              <div className="h-64 flex items-center justify-center"><div className="relative">
                <ResponsiveContainer width={200} height={200}><PieChart><Pie data={completionData} innerRadius={65} outerRadius={90} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  <Cell fill="#10b981" /><Cell fill="#e2e8f0" /></Pie></PieChart></ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-3xl font-black text-gray-900">{completionPct}%</span><span className="text-[10px] text-gray-400 font-medium">Complete</span></div>
              </div></div>
            ) : <p className="text-xs text-gray-400 text-center py-12">No data</p>}
          </div>

          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Overdue Trend (7 days)</h3>
            <div className="h-64"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={overdueTrend}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} /><Line type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart></ResponsiveContainer></div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Priority Breakdown</h3>
            {priorityData.length ? (
              <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {priorityData.map((e) => <Cell key={e.name} fill={e.color} />)}</Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} /></PieChart></ResponsiveContainer>
                <div className="flex justify-center gap-5 -mt-2">
                  {priorityData.map((d) => <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} /><span className="font-medium">{d.name}</span><span className="font-bold text-gray-700">{d.value}</span></div>)}
                </div></div>
            ) : <p className="text-xs text-gray-400 text-center py-12">No data</p>}
          </div>
        </div>

        {/* Machine / Customer Progress */}
        {machineProgress.length > 0 && (
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-5">Machine Progress</h3>
            <div className="space-y-4">
              {machineProgress.map((m) => {
                const pct = m.total ? Math.round((m.done / m.total) * 100) : 0;
                return (
                  <div key={m.id} className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-bold text-gray-800">{m.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium ml-2">Machine: {m.machine}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-medium">{m.total} tasks</span>
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{pct}% done</span>
                      </div>
                    </div>
                    <div className="flex h-5 rounded-full overflow-hidden bg-gray-100">
                      {m.pending > 0 && <div className="bg-amber-400" style={{ width: `${(m.pending / m.total) * 100}%` }} title={`Pending: ${m.pending}`} />}
                      {m.inProgress > 0 && <div className="bg-blue-500" style={{ width: `${(m.inProgress / m.total) * 100}%` }} title={`In Progress: ${m.inProgress}`} />}
                      {m.done > 0 && <div className="bg-emerald-500" style={{ width: `${(m.done / m.total) * 100}%` }} title={`Done: ${m.done}`} />}
                      {m.delayed > 0 && <div className="bg-red-400" style={{ width: `${(m.delayed / m.total) * 100}%` }} title={`Delayed: ${m.delayed}`} />}
                      {m.onHold > 0 && <div className="bg-orange-400" style={{ width: `${(m.onHold / m.total) * 100}%` }} title={`On Hold: ${m.onHold}`} />}
                      {m.cancelled > 0 && <div className="bg-gray-400" style={{ width: `${(m.cancelled / m.total) * 100}%` }} title={`Cancelled: ${m.cancelled}`} />}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {m.pending > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400" />Pending <b className="text-gray-700">{m.pending}</b></span>}
                      {m.inProgress > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress <b className="text-gray-700">{m.inProgress}</b></span>}
                      {m.done > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done <b className="text-gray-700">{m.done}</b></span>}
                      {m.delayed > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400" />Delayed <b className="text-gray-700">{m.delayed}</b></span>}
                      {m.onHold > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-orange-400" />On Hold <b className="text-gray-700">{m.onHold}</b></span>}
                      {m.cancelled > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-gray-400" />Cancelled <b className="text-gray-700">{m.cancelled}</b></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Project Analytics */}
        {projects.length > 0 && (<>
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-4">Production Projects</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* Project Status Distribution */}
              <div className="bg-white rounded-2xl border border-border p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Project Status Distribution</h3>
                {projectStatusData.length ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="relative">
                      <ResponsiveContainer width={200} height={200}>
                        <PieChart>
                          <Pie data={projectStatusData} innerRadius={60} outerRadius={88} paddingAngle={4} dataKey="value" strokeWidth={0}>
                            {projectStatusData.map((d) => <Cell key={d.name} fill={d.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-black text-gray-900">{projects.length}</span>
                        <span className="text-[10px] text-gray-400 font-medium">Projects</span>
                      </div>
                    </div>
                    <div className="ml-6 space-y-3">
                      {projectStatusData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-xs text-gray-600 font-medium">{d.name}</span>
                          <span className="text-sm font-black text-gray-900 ml-auto pl-4">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="text-xs text-gray-400 text-center py-12">No data</p>}
              </div>

              {/* Projects by Machine Type */}
              <div className="bg-white rounded-2xl border border-border p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Projects by Machine Type</h3>
                {machineTypeData.length ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={machineTypeData} layout="vertical" barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                        <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Projects" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="text-xs text-gray-400 text-center py-12">No data</p>}
              </div>
            </div>
          </div>

          {/* Project Progress */}
          {projectProgressData.length > 0 && (
            <div className="bg-white rounded-2xl border border-border p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-5">Project Task Progress</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectProgressData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                      formatter={(value, name) => [value, name]}
                      labelFormatter={(label, payload) => {
                        const item = payload?.[0]?.payload;
                        return item ? `${label} — ${item.customer}` : label;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Pending" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="In Progress" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Done" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Project progress bars */}
              <div className="mt-6 space-y-3">
                {projects.filter((p) => p.total > 0).slice(0, 8).map((p) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-gray-800 truncate">{p.serial_number}</span>
                        <span className="text-[10px] text-gray-400 truncate hidden sm:block">— {p.customer_name}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${p.status === "Completed" ? "bg-emerald-50 text-emerald-600" : p.status === "Active" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>{p.status}</span>
                      </div>
                      <span className="text-[11px] font-bold text-gray-600 flex-shrink-0 ml-3">{p.progress}%</span>
                    </div>
                    <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
                      {p.pending > 0 && <div className="bg-amber-400" style={{ width: `${(p.pending / p.total) * 100}%` }} />}
                      {p.inProgress > 0 && <div className="bg-blue-500" style={{ width: `${(p.inProgress / p.total) * 100}%` }} />}
                      {p.done > 0 && <div className="bg-emerald-500" style={{ width: `${(p.done / p.total) * 100}%` }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>)}

        {/* Department-wise Work Progress */}
        {deptChartData.length > 0 && (
          <div className="bg-white rounded-2xl border border-border p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-5">Department Work Progress</h3>
            <div className="space-y-4">
              {deptChartData.map((dept) => {
                const total = dept.Pending + dept["In Progress"] + dept.Done + dept.Delayed;
                if (total === 0) return null;
                return (
                  <div key={dept.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700">{dept.name}</span>
                      <span className="text-[10px] text-gray-400 font-medium">{total} tasks</span>
                    </div>
                    {/* Stacked horizontal bar */}
                    <div className="flex h-5 rounded-full overflow-hidden bg-gray-100">
                      {dept.Pending > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${(dept.Pending / total) * 100}%` }} title={`Pending: ${dept.Pending}`} />}
                      {dept["In Progress"] > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(dept["In Progress"] / total) * 100}%` }} title={`In Progress: ${dept["In Progress"]}`} />}
                      {dept.Done > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(dept.Done / total) * 100}%` }} title={`Done: ${dept.Done}`} />}
                      {dept.Delayed > 0 && <div className="bg-red-400 transition-all" style={{ width: `${(dept.Delayed / total) * 100}%` }} title={`Delayed: ${dept.Delayed}`} />}
                    </div>
                    {/* Status counts inline */}
                    <div className="flex gap-3 flex-wrap">
                      {dept.Pending > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400" />Pending <b className="text-gray-700">{dept.Pending}</b></span>}
                      {dept["In Progress"] > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress <b className="text-gray-700">{dept["In Progress"]}</b></span>}
                      {dept.Done > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done <b className="text-gray-700">{dept.Done}</b></span>}
                      {dept.Delayed > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400" />Delayed <b className="text-gray-700">{dept.Delayed}</b></span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
