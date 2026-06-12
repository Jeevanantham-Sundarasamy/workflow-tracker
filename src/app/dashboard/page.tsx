"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { logActivity, createNotification } from "@/lib/activity";
import { useAuth } from "@/lib/AuthContext";
import type { Task, Supervisor, Employee, Customer } from "@/lib/types";
import Topbar from "@/components/Topbar";
import StatsCards from "@/components/StatsCards";
import TaskCard from "@/components/TaskCard";
import TaskModal from "@/components/TaskModal";
import ServiceTaskModal from "@/components/ServiceTaskModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import SupervisorGrid from "@/components/SupervisorGrid";
import StatusChart from "@/components/StatusChart";
import PinModal from "@/components/PinModal";
import { DashboardSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Plus, Download, Upload, Filter } from "lucide-react";
import LoginRequired from "@/components/LoginRequired";

export default function DashboardPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, login } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [supervisorRecords, setSupervisorRecords] = useState<Supervisor[]>([]);
  const [employeeRecords, setEmployeeRecords] = useState<Employee[]>([]);
  const [employees, setEmployees] = useState<{ name: string; supervisor_names: string[] | null }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<{ id: string; serial_number: string; customer_name: string; machine_type_name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSup, setFilterSup] = useState("All");
  const [filterEmp, setFilterEmp] = useState("All");
  const [managers, setManagers] = useState<string[]>([]);
  const [filterMgr, setFilterMgr] = useState("All");
  const [filterDept, setFilterDept] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");
  const [taskTypeSelectOpen, setTaskTypeSelectOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [serviceEditingTask, setServiceEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [tr, sr, er, mr, cr, pr, mtR] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("supervisors").select("*").order("name"),
        supabase.from("employees").select("*").order("name"),
        supabase.from("managers").select("*").order("name"),
        supabase.from("customers").select("*").order("name"),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("machine_types").select("id, name"),
      ]);
      if (tr.error) throw tr.error;
      if (sr.error) throw sr.error;
      setTasks(tr.data || []);
      setSupervisorRecords(sr.data || []);
      setEmployeeRecords(er.data || []);
      setSupervisors((sr.data || []).map((s: { name: string }) => s.name));
      setEmployees((er.data || []).map((e: { name: string; supervisor_name: string | null }) => ({
        name: e.name,
        supervisor_names: e.supervisor_name ? String(e.supervisor_name).split(",").map((n: string) => n.trim()).filter(Boolean) : null,
      })));
      setManagers((mr.data || []).map((m: { name: string }) => m.name));
      setCustomers(cr.data || []);
      const mtMap = Object.fromEntries((mtR.data || []).map((mt: { id: number; name: string }) => [String(mt.id), mt.name]));
      setProjects((pr.data || []).map((p: { id: string; machine_type_id: string; serial_number: string; customer_name: string; status: string }) => ({
        id: p.id,
        serial_number: p.serial_number,
        customer_name: p.customer_name,
        machine_type_name: mtMap[String(p.machine_type_id)] || "",
        status: p.status,
      })));
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    if (taskModalOpen || detailTask) return;
    const i = setInterval(loadData, 60000);
    return () => clearInterval(i);
  }, [loadData, taskModalOpen, detailTask]);

  useRealtime("tasks", useCallback((payload) => {
    if (payload.eventType === "INSERT") {
      const nt = payload.new as Task;
      setTasks((p) => (p.some((x) => x.id === nt.id) ? p : [nt, ...p]));
    }
    else if (payload.eventType === "UPDATE") setTasks((p) => p.map((t) => (t.id === (payload.new as Task).id ? (payload.new as Task) : t)));
    else if (payload.eventType === "DELETE") setTasks((p) => p.filter((t) => t.id !== (payload.old as { id: string }).id));
  }, []));

  useEffect(() => {
    const off = () => {};
    const on = () => loadData();
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, [loadData]);

  // Role-based filtering (includes extra_assignees so multi-assigned tasks show for everyone)
  const roleFilteredAll = tasks.filter((t) => {
    if (hasFullAccess) return true;
    if (isSupervisor) return t.supervisor === userName || (t.extra_assignees ?? []).includes(userName!);
    if (isEmployee) return t.assigned_to === userName || (t.extra_assignees ?? []).includes(userName!);
    return true;
  });

  // Apply customer scope to EVERYTHING below (stats, charts, dept progress, task list).
  // When a customer is selected, the dashboard shows only that machine's data.
  const roleFiltered = filterCustomer === "All"
    ? roleFilteredAll
    : roleFilteredAll.filter((t) => {
        if (t.customer_id) {
          const cName = customers.find((c) => String(c.id) === String(t.customer_id))?.name;
          if (cName === filterCustomer) return true;
        }
        if (t.project_id) {
          const proj = projects.find((p) => String(p.id) === String(t.project_id));
          if (proj?.customer_name === filterCustomer) return true;
        }
        return false;
      });

  // Build a lookup: person name -> department
  const personDeptMap = new Map<string, string>();
  for (const s of supervisorRecords) { if (s.department) personDeptMap.set(s.name, s.department); }
  for (const e of employeeRecords) { if (e.department) personDeptMap.set(e.name, e.department); }

  // Get department for a task (via supervisor or assigned employee)
  const getTaskDept = (t: Task): string | null =>
    personDeptMap.get(t.supervisor) || (t.assigned_to ? personDeptMap.get(t.assigned_to) : null) || null;

  // All unique departments from team (supervisors + employees)
  const allDepartments = Array.from(new Set(
    [...supervisorRecords.map((s) => s.department), ...employeeRecords.map((e) => e.department)]
      .filter(Boolean) as string[]
  )).sort();

  const filtered = roleFiltered.filter((t) => {
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (filterSup !== "All" && t.supervisor !== filterSup && !(t.extra_assignees ?? []).includes(filterSup)) return false;
    if (filterEmp !== "All" && t.assigned_to !== filterEmp && !(t.extra_assignees ?? []).includes(filterEmp)) return false;
    if (filterMgr !== "All" && t.supervisor !== filterMgr) return false;
    if (filterDept !== "All" && getTaskDept(t) !== filterDept) return false;
    // customer filter is already applied above (affects whole dashboard scope)
    return true;
  });

  const canCreateTask = hasFullAccess || isSupervisor;
  const canEditTask = hasFullAccess || isSupervisor;
  const canDeleteTask = hasFullAccess;
  const roleName = userName || "Admin";

  const handlePriorityChange = async (id: string, priority: string) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, priority: priority as Task["priority"] } : t)));
    await supabase.from("tasks").update({ priority }).eq("id", id);
    toast("Priority updated", "success");
  };

  const handleStatusChange = async (id: string, status: string, comment?: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, status: status as Task["status"] } : t)));
    await supabase.from("tasks").update({ status }).eq("id", id);
    toast("Status updated", "success");
    if (task) {
      const details = comment ? `${task.status} → ${status} | ${comment}` : `${task.status} → ${status}`;
      await logActivity(id, "status_changed", details, roleName);
      const statusRecipients = [task.supervisor, task.assigned_to, ...(task.extra_assignees ?? [])]
        .filter((n): n is string => !!n && n !== roleName);
      await createNotification(`"${task.task}" status → ${status}`, "info", id, statusRecipients);
      if (comment) {
        await supabase.from("comments").insert({ task_id: id, author: roleName, message: `[Status → ${status}] ${comment}` });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    const task = tasks.find((t) => t.id === id);
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id);
    toast("Task deleted", "success");
    if (task) await createNotification(`Task "${task.task}" deleted`, "warning");
  };

  const handleSave = async (data: Omit<Task, "id" | "created_at">) => {
    if (editingTask) {
      const { data: updated, error } = await supabase.from("tasks").update(data).eq("id", editingTask.id).select().single();
      if (!error && updated) { setTasks((p) => p.map((t) => (t.id === editingTask.id ? updated : t))); toast("Task updated", "success");
        await logActivity(editingTask.id, "updated", `Updated "${data.task}"`, roleName); }
      else toast("Update failed", "error");
    } else {
      const { data: created, error } = await supabase.from("tasks").insert(data).select().single();
      if (!error && created) { setTasks((p) => (p.some((x) => x.id === created.id) ? p : [created, ...p])); toast("Task created", "success");
        await logActivity(created.id, "created", `Created "${data.task}"`, roleName);
        const assigneeList = [data.supervisor, data.assigned_to, ...(data.extra_assignees ?? [])]
          .filter((n): n is string => !!n && n !== roleName);
        const label = assigneeList.length > 1 ? assigneeList.join(", ") : (data.assigned_to || data.supervisor);
        await createNotification(`New task "${data.task}" → ${label}`, "success", created.id, assigneeList); }
      else toast("Creation failed", "error");
    }
    setTaskModalOpen(false); setEditingTask(null);
  };

  const handleSaveService = async (data: Omit<Task, "id" | "created_at">) => {
    if (serviceEditingTask) {
      const { data: updated, error } = await supabase.from("tasks").update(data).eq("id", serviceEditingTask.id).select().single();
      if (!error && updated) { setTasks((p) => p.map((t) => (t.id === serviceEditingTask.id ? updated : t))); toast("Task updated", "success"); }
      else toast("Update failed", "error");
    } else {
      const { data: created, error } = await supabase.from("tasks").insert(data).select().single();
      if (!error && created) { setTasks((p) => (p.some((x) => x.id === created.id) ? p : [created, ...p])); toast("Service task created", "success");
        const assigneeList = [data.assigned_to, ...(data.extra_assignees ?? [])].filter((n): n is string => !!n && n !== roleName);
        if (assigneeList.length > 0) await createNotification(`New service task "${data.task}"`, "success", created.id, assigneeList); }
      else toast("Creation failed", "error");
    }
    setServiceModalOpen(false); setServiceEditingTask(null);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify({ tasks, supervisors, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `workflow-${new Date().toISOString().split("T")[0]}.json`; a.click();
    toast("Exported", "success");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d.tasks || !d.supervisors) { alert("Invalid file."); return; }
      if (!confirm(`Import ${d.tasks.length} tasks?`)) return;
      for (const name of d.supervisors) { if (!supervisors.includes(name)) await supabase.from("supervisors").upsert({ name }, { onConflict: "name" }); }
      for (const t of d.tasks) { const { id, created_at, updated_at, ...rest } = t; await supabase.from("tasks").insert(rest); }
      await loadData(); toast("Import complete", "success");
    } catch { toast("Import failed", "error"); }
    e.target.value = "";
  };

  const modalSupervisors = isSupervisor && !hasFullAccess ? [userName!] : [...managers, ...supervisors];
  const modalEmployees = isSupervisor && !hasFullAccess
    ? employees.filter((e) => e.supervisor_names && e.supervisor_names.includes(userName!))
    : employees;

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
        {loading ? <DashboardSkeleton /> : (
          <>
            <StatsCards tasks={roleFiltered} activeFilter={filterStatus} onFilter={setFilterStatus} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 mr-auto">
                    {isEmployee ? "My Tasks" : isSupervisor && !hasFullAccess ? "Team Tasks" : "Tasks"}
                    <span className="text-gray-400 font-medium ml-2 text-sm">({filtered.length})</span>
                  </h2>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-gray-400" />
                    {hasFullAccess && managers.length > 0 && (
                      <select value={filterMgr} onChange={(e) => setFilterMgr(e.target.value)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-gray-700 cursor-pointer focus:outline-none">
                        <option value="All">All Managers</option>
                        {managers.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    )}
                    {hasFullAccess && (
                      <select value={filterSup} onChange={(e) => setFilterSup(e.target.value)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-gray-700 cursor-pointer focus:outline-none">
                        <option value="All">All Supervisors</option>
                        {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {hasFullAccess && (
                      <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-gray-700 cursor-pointer focus:outline-none">
                        <option value="All">All Employees</option>
                        {employees.map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
                      </select>
                    )}
                    {hasFullAccess && allDepartments.length > 0 && (
                      <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-gray-700 cursor-pointer focus:outline-none">
                        <option value="All">All Departments</option>
                        {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    )}
                    {/* Customer filter available to everyone (supervisors & employees see only their own tasks scoped to the selected customer) */}
                    {customers.length > 0 && (
                      <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-white text-gray-700 cursor-pointer focus:outline-none">
                        <option value="All">All Customers / Machines</option>
                        {customers
                          .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i)
                          .map((c) => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                          ))}
                      </select>
                    )}
                  </div>
                  {hasFullAccess && (
                    <>
                      <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-white border border-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                        <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span></button>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-white border border-border px-3 py-1.5 rounded-lg hover:bg-gray-50 transition cursor-pointer">
                        <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Import</span>
                        <input type="file" accept=".json" className="hidden" onChange={handleImport} /></label>
                    </>
                  )}
                  {canCreateTask && (
                    <button onClick={() => { setEditingTask(null); setServiceEditingTask(null); setTaskTypeSelectOpen(true); }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-xl transition shadow-sm">
                      <Plus className="w-3.5 h-3.5" /> New Task</button>
                  )}
                </div>
                <div className="space-y-3">
                  {filtered.length ? filtered.map((t) => (
                    <TaskCard key={t.id} task={t} customerName={t.customer_id ? customers.find((c) => String(c.id) === String(t.customer_id))?.name : t.project_id ? projects.find((p) => String(p.id) === String(t.project_id))?.customer_name : undefined} canEdit={canEditTask} canDelete={canDeleteTask}
                      canChangeStatus={hasFullAccess || (isSupervisor && (t.supervisor === userName || (t.extra_assignees ?? []).includes(userName!))) || (isEmployee && (t.assigned_to === userName || (t.extra_assignees ?? []).includes(userName!)))}
                      onStatusChange={handleStatusChange}
                      onPriorityChange={canEditTask ? handlePriorityChange : undefined}
                      onEdit={(task) => {
                        if (task.task_type === "service") { setServiceEditingTask(task); setServiceModalOpen(true); }
                        else { setEditingTask(task); setTaskModalOpen(true); }
                      }}
                      onDelete={handleDelete} onViewDetail={(task) => setDetailTask(task)} />
                  )) : (
                    <div className="bg-white rounded-2xl border border-border p-12 text-center">
                      <p className="text-3xl mb-3">📭</p><p className="text-sm text-gray-400 font-medium">No tasks found</p></div>
                  )}
                </div>
              </div>
              <div className="space-y-4"><StatusChart tasks={roleFiltered} /></div>
            </div>
            {hasFullAccess && <SupervisorGrid supervisors={supervisors} tasks={tasks} />}

            {/* Department-wise Task Summary */}
            {hasFullAccess && allDepartments.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Department Overview</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {allDepartments.map((dept) => {
                    const deptTasks = roleFiltered.filter((t) => getTaskDept(t) === dept);
                    const pending = deptTasks.filter((t) => t.status === "Pending").length;
                    const inProgress = deptTasks.filter((t) => t.status === "In Progress").length;
                    const done = deptTasks.filter((t) => t.status === "Done").length;
                    const delayed = deptTasks.filter((t) => t.status === "Delayed").length;
                    const onHold = deptTasks.filter((t) => t.status === "On Hold").length;
                    const total = deptTasks.length;
                    return (
                      <div key={dept} className="bg-white rounded-2xl border border-border p-4 hover:shadow-md transition">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                            {dept.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{dept}</p>
                            <p className="text-[10px] text-gray-400">{total} task{total !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        {total > 0 ? (
                          <div className="space-y-1.5">
                            {pending > 0 && <div className="flex items-center gap-2 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-amber-400" /><span>Pending</span><span className="ml-auto font-bold text-gray-700">{pending}</span></div>}
                            {inProgress > 0 && <div className="flex items-center gap-2 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-400" /><span>In Progress</span><span className="ml-auto font-bold text-gray-700">{inProgress}</span></div>}
                            {done > 0 && <div className="flex items-center gap-2 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-400" /><span>Done</span><span className="ml-auto font-bold text-gray-700">{done}</span></div>}
                            {delayed > 0 && <div className="flex items-center gap-2 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-red-400" /><span>Delayed</span><span className="ml-auto font-bold text-gray-700">{delayed}</span></div>}
                            {onHold > 0 && <div className="flex items-center gap-2 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-orange-400" /><span>On Hold</span><span className="ml-auto font-bold text-gray-700">{onHold}</span></div>}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400">No tasks</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {taskTypeSelectOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setTaskTypeSelectOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">New Task</h2>
            <p className="text-sm text-gray-400 mb-5">What type of task are you creating?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setTaskTypeSelectOpen(false); setTaskModalOpen(true); }}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-violet-200 hover:border-violet-500 hover:bg-violet-50 transition group">
                <span className="text-2xl">⚙️</span>
                <span className="text-sm font-bold text-gray-800 group-hover:text-violet-700">Production</span>
                <span className="text-[11px] text-gray-400 text-center">Machine work & project tasks</span>
              </button>
              <button onClick={() => { setTaskTypeSelectOpen(false); setServiceModalOpen(true); }}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 transition group">
                <span className="text-2xl">🔧</span>
                <span className="text-sm font-bold text-gray-800 group-hover:text-blue-700">Service</span>
                <span className="text-[11px] text-gray-400 text-center">Field service & support tasks</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <TaskModal open={taskModalOpen} task={editingTask} supervisors={modalSupervisors}
        employees={modalEmployees} projects={projects.filter((p) => p.status === "Active")} customers={customers} roleName={roleName}
        onClose={() => { setTaskModalOpen(false); setEditingTask(null); }} onSave={handleSave} />
      <ServiceTaskModal open={serviceModalOpen} task={serviceEditingTask}
        supervisors={modalSupervisors} employees={modalEmployees} projects={projects.filter((p) => p.status === "Completed")} customers={customers} roleName={roleName}
        onClose={() => { setServiceModalOpen(false); setServiceEditingTask(null); }} onSave={handleSaveService} />
      <TaskDetailModal open={!!detailTask} task={detailTask} onClose={() => setDetailTask(null)} roleName={roleName} />
      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
