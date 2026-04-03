"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Project, ProjectTask, MachineType, Employee } from "@/lib/types";
import { PROJECT_STATUSES, PROJECT_TASK_STATUSES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  ArrowLeft, Calendar, User, Package, CheckCircle2, XCircle,
  Clock, ChevronDown, ChevronRight, UserPlus, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";

const taskStatusColors: Record<string, { bg: string; text: string }> = {
  Pending: { bg: "bg-gray-100", text: "text-gray-600" },
  "In Progress": { bg: "bg-blue-50", text: "text-blue-700" },
  Done: { bg: "bg-emerald-50", text: "text-emerald-700" },
};

const qcColors: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  Approved: { bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle2 },
  Rejected: { bg: "bg-red-50", text: "text-red-700", icon: XCircle },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, login } = useAuth();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [machineType, setMachineType] = useState<MachineType | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [employees, setEmployees] = useState<{ name: string }[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [pRes, ptRes, eRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("project_tasks").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("employees").select("name").order("name"),
      ]);
      if (pRes.data) {
        setProject(pRes.data);
        const { data: mt } = await supabase.from("machine_types").select("*").eq("id", pRes.data.machine_type_id).single();
        setMachineType(mt);
      }
      setTasks(ptRes.data || []);
      setEmployees(eRes.data || []);
      // Auto-expand all departments
      const deptNames = new Set<string>((ptRes.data || []).map((t: ProjectTask) => t.department_name));
      setExpandedDepts(deptNames);
    } catch { /* offline */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group tasks by department
  const departments = Array.from(new Set(tasks.map((t) => t.department_name)));
  const getDeptTasks = (dept: string) => tasks.filter((t) => t.department_name === dept);
  const getDeptProgress = (dept: string) => {
    const dt = getDeptTasks(dept);
    if (!dt.length) return 0;
    return Math.round((dt.filter((t) => t.status === "Done").length / dt.length) * 100);
  };

  const totalDone = tasks.filter((t) => t.status === "Done").length;
  const totalProgress = tasks.length ? Math.round((totalDone / tasks.length) * 100) : 0;

  const canManageTask = hasFullAccess || isSupervisor;
  const canChangeTaskStatus = (task: ProjectTask) => {
    if (hasFullAccess) return true;
    if (isSupervisor) return true;
    if (isEmployee && task.assigned_to === userName) return true;
    return false;
  };
  const canQC = hasFullAccess || isSupervisor;

  const updateTaskStatus = async (taskId: string, status: string) => {
    const updates: Record<string, string | null> = { status };
    if (status === "Done") updates.completed_at = new Date().toISOString();
    else { updates.completed_at = null; updates.qc_status = null; updates.qc_by = null; updates.qc_at = null; }
    const { error } = await supabase.from("project_tasks").update(updates).eq("id", taskId);
    if (!error) {
      setTasks((p) => p.map((t) => t.id === taskId ? { ...t, ...updates } as ProjectTask : t));
      toast("Status updated", "success");
    }
  };

  const assignEmployee = async (taskId: string, empName: string) => {
    const { error } = await supabase.from("project_tasks").update({ assigned_to: empName || null }).eq("id", taskId);
    if (!error) {
      setTasks((p) => p.map((t) => t.id === taskId ? { ...t, assigned_to: empName || null } : t));
      toast("Assigned", "success");
    }
  };

  const handleQC = async (taskId: string, qcStatus: "Approved" | "Rejected") => {
    const { error } = await supabase.from("project_tasks").update({
      qc_status: qcStatus,
      qc_by: userName || "Admin",
      qc_at: new Date().toISOString(),
    }).eq("id", taskId);
    if (!error) {
      setTasks((p) => p.map((t) => t.id === taskId ? { ...t, qc_status: qcStatus, qc_by: userName || "Admin", qc_at: new Date().toISOString() } : t));
      toast(`QC ${qcStatus}`, qcStatus === "Approved" ? "success" : "warning");
    }
  };

  const updateProjectStatus = async (status: string) => {
    if (!project) return;
    const { error } = await supabase.from("projects").update({ status }).eq("id", project.id);
    if (!error) {
      setProject({ ...project, status: status as Project["status"] });
      toast("Project status updated", "success");
    }
  };

  const toggleDept = (dept: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept); else next.add(dept);
      return next;
    });
  };

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />
      <div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>
    </div>
  );

  if (!project) return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />
      <div className="flex-1 flex items-center justify-center"><p className="text-sm text-gray-400">Project not found</p></div>
    </div>
  );

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = project.status === "Active" && project.due_date < today;

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href="/dashboard/production" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 mt-1 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{project.serial_number}</h1>
              {machineType && <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-0.5 rounded-full">{machineType.name}</span>}
              {isOverdue && <span className="text-xs font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Overdue</span>}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> {project.customer_name}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {project.start_date} → {project.due_date}</span>
              <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {totalDone}/{tasks.length} tasks</span>
            </div>
          </div>
          {hasFullAccess && (
            <select value={project.status} onChange={(e) => updateProjectStatus(e.target.value)}
              className="text-xs font-bold px-3 py-1.5 rounded-xl border border-border bg-white cursor-pointer focus:outline-none">
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {/* Overall Progress */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">Overall Progress</h2>
            <span className={`text-lg font-black ${totalProgress === 100 ? "text-emerald-600" : "text-gray-900"}`}>{totalProgress}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${totalProgress === 100 ? "bg-emerald-500" : totalProgress > 50 ? "bg-blue-500" : "bg-amber-400"}`}
              style={{ width: `${totalProgress}%` }} />
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="space-y-3">
          {departments.map((dept) => {
            const deptTasks = getDeptTasks(dept);
            const deptProgress = getDeptProgress(dept);
            const isOpen = expandedDepts.has(dept);
            const deptDone = deptTasks.filter((t) => t.status === "Done").length;

            return (
              <div key={dept} className="bg-white rounded-2xl border border-border overflow-hidden">
                <button onClick={() => toggleDept(dept)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">{dept}</h3>
                      <p className="text-xs text-gray-400">{deptDone}/{deptTasks.length} tasks done</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${deptProgress === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                        style={{ width: `${deptProgress}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700 w-8 text-right">{deptProgress}%</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border">
                    {deptTasks.map((task) => {
                      const st = taskStatusColors[task.status];
                      const canChange = canChangeTaskStatus(task);
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-5 py-3 border-b border-border-light last:border-b-0 hover:bg-gray-50 transition flex-wrap sm:flex-nowrap">
                          {/* Task name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{task.task_name}</p>
                            {task.assigned_to && <p className="text-[10px] text-gray-400 flex items-center gap-1"><User className="w-2.5 h-2.5" /> {task.assigned_to}</p>}
                          </div>

                          {/* Assign employee */}
                          {canManageTask && (
                            <select value={task.assigned_to || ""} onChange={(e) => assignEmployee(task.id, e.target.value)}
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg border border-border bg-white cursor-pointer focus:outline-none w-28 truncate">
                              <option value="">Assign</option>
                              {employees.map((emp) => <option key={emp.name} value={emp.name}>{emp.name}</option>)}
                            </select>
                          )}

                          {/* Status */}
                          {canChange ? (
                            <select value={task.status} onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${st.bg} ${st.text}`}>
                              {PROJECT_TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${st.bg} ${st.text}`}>{task.status}</span>
                          )}

                          {/* QC */}
                          {task.status === "Done" && (
                            task.qc_status ? (
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${qcColors[task.qc_status].bg} ${qcColors[task.qc_status].text}`}>
                                {task.qc_status === "Approved" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {task.qc_status}
                              </span>
                            ) : canQC ? (
                              <div className="flex gap-1">
                                <button onClick={() => handleQC(task.id, "Approved")}
                                  className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition flex items-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3" /> QC Pass
                                </button>
                                <button onClick={() => handleQC(task.id, "Rejected")}
                                  className="text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition flex items-center gap-0.5">
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Awaiting QC</span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
