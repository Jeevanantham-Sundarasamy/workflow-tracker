"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/lib/types";
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
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [connection, setConnection] = useState<"live" | "offline" | "connecting">("connecting");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [tr, sr] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("supervisors").select("*").order("name"),
      ]);
      if (tr.error) throw tr.error; if (sr.error) throw sr.error;
      setTasks(tr.data || []); setSupervisors((sr.data || []).map((s: { name: string }) => s.name)); setConnection("live");
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
    return true;
  });

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
          <div className="flex items-center gap-2 bg-white rounded-xl border border-border p-2">
            <CalendarDays className="w-4 h-4 text-gray-400 ml-1" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs font-medium border-none bg-transparent outline-none text-gray-700" />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs font-medium border-none bg-transparent outline-none text-gray-700" />
            {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">Clear</button>}
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
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
