"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Task, LeaveRequest } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { ChevronLeft, ChevronRight, Clock, User, Flag, Calendar } from "lucide-react";
import LoginRequired from "@/components/LoginRequired";
const statusDot: Record<string, string> = { Pending: "bg-amber-400", "In Progress": "bg-blue-400", Done: "bg-emerald-400", Delayed: "bg-red-400", "On Hold": "bg-orange-400", Cancelled: "bg-gray-400" };
const leaveDot: Record<string, string> = { Pending: "bg-amber-400", Approved: "bg-emerald-400", Rejected: "bg-red-400" };
const leaveStyle: Record<string, { bg: string; text: string }> = { Pending: { bg: "bg-amber-50", text: "text-amber-700" }, Approved: { bg: "bg-emerald-50", text: "text-emerald-700" }, Rejected: { bg: "bg-red-50", text: "text-red-700" } };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, login } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<string[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [connection, setConnection] = useState<"live" | "offline" | "connecting">("connecting");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, leavesRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("leave_requests").select("*").order("created_at", { ascending: false }),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      setTasks(tasksRes.data || []);
      setLeaves(leavesRes.data || []);
      setConnection("live");

      // Load team employees for supervisor
      if (isSupervisor && userName) {
        const { data } = await supabase.from("employees").select("name").eq("supervisor_name", userName);
        setTeamEmployees((data || []).map((e: { name: string }) => e.name));
      }
    } catch { setConnection("offline"); }
  }, [isSupervisor, userName]);

  useEffect(() => { loadData(); }, [loadData]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  // Role-based filtering
  const roleFiltered = tasks.filter((t) => {
    if (hasFullAccess) return true;
    if (isSupervisor) return t.supervisor === userName;
    if (isEmployee) return t.assigned_to === userName;
    return true;
  });
  const getTasksForDate = (d: string) => roleFiltered.filter((t) => t.due_date === d);

  // Leave filtering by role
  const roleFilteredLeaves = leaves.filter((l) => {
    if (hasFullAccess) return true;
    if (isSupervisor) return l.employee_name === userName || teamEmployees.includes(l.employee_name);
    if (isEmployee) return l.employee_name === userName;
    return true;
  });

  // Get leaves that overlap a given date (from_date to to_date range)
  const getLeavesForDate = (d: string) => roleFilteredLeaves.filter((l) => l.from_date <= d && l.to_date >= d);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];
  const selectedLeaves = selectedDate ? getLeavesForDate(selectedDate) : [];

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-400">View tasks by due date</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
              <div className="text-center">
                <h2 className="text-sm font-bold text-gray-900">{monthLabel}</h2>
                <button onClick={() => setCurrentDate(new Date())} className="text-[10px] text-primary-600 font-semibold hover:underline">Today</button>
              </div>
              <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e-${i}`} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayTasks = getTasksForDate(dateStr);
                const dayLeaves = getLeavesForDate(dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const totalDots = dayTasks.length + dayLeaves.length;
                return (
                  <button key={dateStr} onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                    className={`relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-medium transition ${
                      isSelected ? "bg-primary-600 text-white" : isToday ? "bg-primary-50 text-primary-700 font-bold" : "hover:bg-gray-50 text-gray-700"}`}>
                    <span>{day}</span>
                    {totalDots > 0 && (
                      <div className="flex gap-0.5">
                        {dayTasks.slice(0, 2).map((t) => <span key={t.id} className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : statusDot[t.status]}`} />)}
                        {dayLeaves.slice(0, 2).map((l) => <span key={l.id} className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : leaveDot[l.status]}`} style={{ outline: "1px solid white" }} />)}
                        {totalDots > 4 && <span className={`text-[8px] font-bold ${isSelected ? "text-white/70" : "text-gray-400"}`}>+{totalDots - 4}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-border p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              {selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) : "Select a date"}
            </h3>
            {selectedDate ? (
              <div className="space-y-4">
                {/* Tasks */}
                {selectedTasks.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Tasks ({selectedTasks.length})</p>
                    <div className="space-y-2">
                      {selectedTasks.map((t) => (
                        <div key={t.id} className="p-3 rounded-xl border border-border hover:bg-gray-50 transition">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-2 h-2 rounded-full ${statusDot[t.status]}`} />
                            <span className="text-xs font-bold text-gray-900 truncate">{t.task}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                            <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> {t.supervisor}</span>
                            <span className="flex items-center gap-0.5"><Flag className="w-2.5 h-2.5" /> {t.priority}</span>
                            <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {t.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Leaves */}
                {selectedLeaves.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Leaves ({selectedLeaves.length})</p>
                    <div className="space-y-2">
                      {selectedLeaves.map((l) => {
                        const st = leaveStyle[l.status] || leaveStyle.Pending;
                        return (
                          <div key={l.id} className={`p-3 rounded-xl border border-border hover:shadow-sm transition ${st.bg}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              <span className="text-xs font-bold text-gray-900 truncate">{l.employee_name}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${st.bg} ${st.text}`}>{l.status}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
                              <span>{l.leave_type}</span>
                              <span>{l.from_date} → {l.to_date}</span>
                            </div>
                            {l.reason && <p className="text-[10px] text-gray-400 italic mt-1">{l.reason}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedTasks.length === 0 && selectedLeaves.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">No tasks or leaves</p>
                )}
              </div>
            ) : <p className="text-xs text-gray-400 text-center py-8">Click a date to view details</p>}
          </div>
        </div>
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
