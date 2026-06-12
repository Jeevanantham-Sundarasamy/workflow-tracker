"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { logActivity, createNotification } from "@/lib/activity";
import { useAuth } from "@/lib/AuthContext";
import type { Task, Customer } from "@/lib/types";
import Topbar from "@/components/Topbar";
import TaskCard from "@/components/TaskCard";
import TaskModal from "@/components/TaskModal";
import ServiceTaskModal from "@/components/ServiceTaskModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import ShareTaskModal from "@/components/ShareTaskModal";
import PinModal from "@/components/PinModal";
import { TaskCardSkeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Plus, Search, CheckSquare, Share2, X as XIcon } from "lucide-react";

export default function TasksPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { hasFullAccess, isSupervisor, isEmployee, hasTaskCreateAccess, userName, role, login } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [managers, setManagers] = useState<string[]>([]);
  const [employees, setEmployees] = useState<{ name: string; supervisor_names: string[] | null }[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<{ id: string; serial_number: string; customer_name: string; machine_type_name: string; status: string }[]>([]);
  const [connection, setConnection] = useState<"live" | "offline" | "connecting">("connecting");
  const [loading, setLoading] = useState(true);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterSup, setFilterSup] = useState("All");
  const [filterEmp, setFilterEmp] = useState("All");
  const [filterCustomer, setFilterCustomer] = useState("All");
  const [filterProject, setFilterProject] = useState("All");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [taskTypeSelectOpen, setTaskTypeSelectOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [serviceEditingTask, setServiceEditingTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [filterTaskType, setFilterTaskType] = useState("All");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareTasks, setShareTasks] = useState<Task[]>([]);

  const handleConvertToPorterBooking = (task: Task) => {
    const parts = task.task.split(" | ");
    let materials: string[] = [];
    let pickup = "";
    let drop = "";
    let vehicle = "";
    for (const part of parts.slice(1)) {
      if (part.startsWith("Materials: ")) materials = part.replace("Materials: ", "").split(", ").filter(Boolean);
      else if (part.startsWith("From: ")) pickup = part.replace("From: ", "");
      else if (part.startsWith("To: ")) drop = part.replace("To: ", "");
      else if (part.startsWith("Vehicle: ")) vehicle = part.replace("Vehicle: ", "");
    }
    let weight = "";
    let supplierName = "";
    let receiverName = "";
    let notes = "";
    if (task.follow_up) {
      const fpParts = task.follow_up.split(" | ");
      for (const part of fpParts) {
        if (part.startsWith("Weight: ")) weight = part.replace("Weight: ", "");
        else if (part.startsWith("Supplier: ")) supplierName = part.replace("Supplier: ", "");
        else if (part.startsWith("Receiver: ")) receiverName = part.replace("Receiver: ", "");
        else if (part && !notes) notes = part;
      }
    }
    sessionStorage.setItem("porter_booking_prefill", JSON.stringify({
      materials, pickup, drop, vehicle, weight, supplierName, receiverName, notes,
      taskId: task.id,
      requestedBy: task.created_by,
    }));
    router.push("/dashboard/porter");
  };

  const loadData = useCallback(async () => {
    try {
      const [tr, sr, er, mr, cr, pr, mtr] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("supervisors").select("*").order("name"),
        supabase.from("employees").select("name, supervisor_name").order("name"),
        supabase.from("managers").select("name").order("name"),
        supabase.from("customers").select("*").order("name"),
        supabase.from("projects").select("id, serial_number, customer_name, machine_type_id, status").order("created_at", { ascending: false }),
        supabase.from("machine_types").select("id, name"),
      ]);
      if (tr.error) throw tr.error; if (sr.error) throw sr.error;
      setTasks(tr.data || []);
      setSupervisors((sr.data || []).map((s: { name: string }) => s.name));
      setEmployees((er.data || []).map((e: { name: string; supervisor_name: string | null }) => ({
        name: e.name,
        supervisor_names: e.supervisor_name ? String(e.supervisor_name).split(",").map((n: string) => n.trim()).filter(Boolean) : null,
      })));
      setManagers((mr.data || []).map((m: { name: string }) => m.name));
      setCustomers(cr.data || []);
      const mtMap = Object.fromEntries((mtr.data || []).map((m: { id: string; name: string }) => [m.id, m.name]));
      setProjects((pr.data || []).map((p: { id: string; serial_number: string; customer_name: string; machine_type_id: string; status: string }) => ({
        id: p.id,
        serial_number: p.serial_number,
        customer_name: p.customer_name,
        machine_type_name: mtMap[p.machine_type_id] || "",
        status: p.status,
      })));
      setConnection("live");
    } catch { setConnection("offline"); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    if (taskModalOpen || serviceModalOpen || detailTask) return;
    const i = setInterval(loadData, 60000);
    return () => clearInterval(i);
  }, [loadData, taskModalOpen, serviceModalOpen, detailTask]);

  useRealtime("tasks", useCallback((payload) => {
    if (payload.eventType === "INSERT") {
      const nt = payload.new as Task;
      setTasks((p) => (p.some((x) => x.id === nt.id) ? p : [nt, ...p]));
    }
    else if (payload.eventType === "UPDATE") setTasks((p) => p.map((t) => (t.id === (payload.new as Task).id ? (payload.new as Task) : t)));
    else if (payload.eventType === "DELETE") setTasks((p) => p.filter((t) => t.id !== (payload.old as { id: string }).id));
  }, []));

  // Role-based task filtering
  const roleFiltered = tasks.filter((t) => {
    if (hasFullAccess) return true;
    if (isSupervisor) return t.supervisor === userName || (t.extra_assignees ?? []).includes(userName!);
    if (isEmployee) return t.assigned_to === userName || (t.extra_assignees ?? []).includes(userName!) || (hasTaskCreateAccess && t.created_by === userName);
    return true; // guest sees all
  });

  const priorityOrder: Record<string, number> = { high: 1, medium: 2, low: 3 };

  const filtered = roleFiltered.filter((t) => {
    if (filterStatus === "All" && t.status === "Done") return false;
    if (filterStatus === "Completed" && t.status !== "Done") return false;
    if (filterStatus !== "All" && filterStatus !== "Completed" && t.status !== filterStatus) return false;
    if (filterSup !== "All" && t.supervisor !== filterSup) return false;
    if (filterEmp !== "All" && t.assigned_to !== filterEmp && !(t.extra_assignees ?? []).includes(filterEmp)) return false;
    if (filterProject !== "All" && t.project_id !== filterProject) return false;
    if (filterCustomer !== "All") {
      let matched = false;
      if (t.customer_id) {
        const cName = customers.find((c) => String(c.id) === String(t.customer_id))?.name;
        if (cName === filterCustomer) matched = true;
      }
      if (!matched && t.project_id) {
        const proj = projects.find((p) => String(p.id) === String(t.project_id));
        if (proj?.customer_name === filterCustomer) matched = true;
      }
      if (!matched) return false;
    }
    if (filterTaskType !== "All" && (t.task_type || "production") !== filterTaskType) return false;
    if (search && !t.task.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom || dateTo) {
      const dateField = filterStatus === "Completed"
        ? (t.completed_at || t.created_at || "")
        : (t.due_date || "");
      const d = dateField.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
    }
    return true;
  }).sort((a, b) => {
    if (filterStatus === "Completed") {
      const ad = a.completed_at || a.created_at || "";
      const bd = b.completed_at || b.created_at || "";
      return bd.localeCompare(ad);
    }
    return (priorityOrder[a.priority.toLowerCase()] ?? 4) - (priorityOrder[b.priority.toLowerCase()] ?? 4);
  });

  const canCreateTask = hasFullAccess || isSupervisor || hasTaskCreateAccess;
  const canEditTask = hasFullAccess || isSupervisor;
  const canDeleteTask = hasFullAccess;
  const canSelectMultiple = hasFullAccess || isSupervisor || hasTaskCreateAccess;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const shareSelected = () => {
    const toShare = filtered.filter((t) => selectedIds.has(t.id));
    if (toShare.length === 0) return;
    setShareTasks(toShare);
    exitSelectMode();
  };

  const handlePriorityChange = async (id: string, priority: string) => {
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, priority: priority as Task["priority"] } : t)));
    await supabase.from("tasks").update({ priority }).eq("id", id);
    toast("Priority updated", "success");
  };

  const handleStatusChange = async (id: string, status: string, comment?: string) => {
    const task = tasks.find((t) => t.id === id);
    const completed_at = status === "Done" ? new Date().toISOString() : (task?.status === "Done" ? null : task?.completed_at ?? null);
    setTasks((p) => p.map((t) => (t.id === id ? { ...t, status: status as Task["status"], completed_at } : t)));
    await supabase.from("tasks").update({ status, completed_at }).eq("id", id);
    toast("Status updated", "success");
    const actor = userName || (hasFullAccess ? "Manager" : "Unknown");
    if (task) {
      const details = comment ? `${task.status} → ${status} | ${comment}` : `${task.status} → ${status}`;
      await logActivity(id, "status_changed", details, actor);
      const statusRecipients = [task.supervisor, task.assigned_to, ...(task.extra_assignees ?? [])]
        .filter((n): n is string => !!n && n !== actor);
      await createNotification(`"${task.task}" status → ${status}`, "info", id, statusRecipients);
      if (comment) {
        await supabase.from("comments").insert({ task_id: id, author: actor, message: `[Status → ${status}] ${comment}` });
      }
      // Sync status back to linked porter booking
      if (task.location_gps?.startsWith("porter_booking_id:")) {
        const bookingId = task.location_gps.replace("porter_booking_id:", "");
        const bookingStatusMap: Partial<Record<Task["status"], string>> = {
          "In Progress": "In Transit",
          "Done": "Completed",
          "Cancelled": "Cancelled",
          "Pending": "Pending",
        };
        const bookingStatus = bookingStatusMap[status as Task["status"]];
        if (bookingStatus) {
          await supabase.from("porter_bookings")
            .update({ status: bookingStatus, updated_at: new Date().toISOString() })
            .eq("id", bookingId);
        }
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    setTasks((p) => p.filter((t) => t.id !== id));
    await supabase.from("tasks").delete().eq("id", id); toast("Task deleted", "success");
  };

  const handleSave = async (data: Omit<Task, "id" | "created_at">) => {
    const actor = userName || "Manager";
    if (editingTask) {
      const { data: updated, error } = await supabase.from("tasks").update(data).eq("id", editingTask.id).select().single();
      if (!error && updated) { setTasks((p) => p.map((t) => (t.id === editingTask.id ? updated : t))); toast("Task updated", "success"); }
    } else {
      const { data: created, error } = await supabase.from("tasks").insert(data).select().single();
      if (!error && created) { setTasks((p) => (p.some((x) => x.id === created.id) ? p : [created, ...p])); toast("Task created", "success");
        await logActivity(created.id, "created", `Created "${data.task}"`, actor);
        const assigneeList = [data.supervisor, data.assigned_to, ...(data.extra_assignees ?? [])]
          .filter((n): n is string => !!n && n !== actor);
        const label = assigneeList.length > 1 ? assigneeList.join(", ") : (data.assigned_to || data.supervisor);
        await createNotification(`New task "${data.task}" → ${label}`, "success", created.id, assigneeList);
        setShareTasks([created]); }
      else if (error) { toast(`Creation failed: ${error.message}`, "error"); }
    }
    setTaskModalOpen(false); setEditingTask(null);
  };

  const handleSaveService = async (data: Omit<Task, "id" | "created_at">) => {
    const actor = userName || "Manager";
    if (serviceEditingTask) {
      const { data: updated, error } = await supabase.from("tasks").update(data).eq("id", serviceEditingTask.id).select().single();
      if (!error && updated) { setTasks((p) => p.map((t) => (t.id === serviceEditingTask.id ? updated : t))); toast("Task updated", "success"); }
    } else {
      const { data: created, error } = await supabase.from("tasks").insert(data).select().single();
      if (!error && created) { setTasks((p) => (p.some((x) => x.id === created.id) ? p : [created, ...p])); toast("Service task created", "success");
        await logActivity(created.id, "created", `Created service task "${data.task}"`, actor);
        const assigneeList = [data.assigned_to, ...(data.extra_assignees ?? [])].filter((n): n is string => !!n && n !== actor);
        if (assigneeList.length > 0) await createNotification(`New service task "${data.task}"`, "success", created.id, assigneeList);
        setShareTasks([created]); }
      else if (error) { toast(`Creation failed: ${error.message}`, "error"); }
    }
    setServiceModalOpen(false); setServiceEditingTask(null);
  };

  // For supervisor: only show their supervisors list (just themselves)
  const modalSupervisors = isSupervisor && !hasFullAccess ? [userName!] : [...managers, ...supervisors];
  // For supervisor: only show their team employees
  const modalEmployees = isSupervisor && !hasFullAccess
    ? employees.filter((e) => e.supervisor_names && e.supervisor_names.includes(userName!))
    : employees;

  const roleName = userName || (hasFullAccess ? "Admin" : role === "supervisor" ? "Supervisor" : "Employee");

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />
      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isEmployee && !hasTaskCreateAccess ? "My Tasks" : isSupervisor ? "Team Tasks" : "All Tasks"}
            </h1>
            <p className="text-sm text-gray-400">{roleFiltered.length} total</p>
          </div>
          <div className="flex items-center gap-2">
            {canSelectMultiple && !selectMode && (
              <button onClick={() => setSelectMode(true)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition">
                <CheckSquare className="w-4 h-4" /> Select
              </button>
            )}
            {selectMode && (
              <>
                <button onClick={exitSelectMode}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2.5 rounded-xl transition">
                  <XIcon className="w-4 h-4" /> Cancel
                </button>
                {selectedIds.size > 0 && (
                  <button onClick={shareSelected}
                    className="flex items-center gap-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 px-4 py-2.5 rounded-xl transition shadow-sm">
                    <Share2 className="w-4 h-4" /> Share {selectedIds.size}
                  </button>
                )}
              </>
            )}
            {canCreateTask && !selectMode && (
              <button onClick={() => { setEditingTask(null); setServiceEditingTask(null); setTaskTypeSelectOpen(true); }}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
                <Plus className="w-4 h-4" /> New Task
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap bg-white rounded-2xl border border-border p-3 sm:p-4">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterStatus("All")}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterStatus === "All" ? "bg-gray-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All Tasks
            </button>
            <button onClick={() => setFilterStatus("Completed")}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterStatus === "Completed" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600"}`}>
              Completed
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setFilterTaskType("All")}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterTaskType === "All" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              All Types
            </button>
            <button onClick={() => setFilterTaskType("production")}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterTaskType === "production" ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-600"}`}>
              Production
            </button>
            <button onClick={() => setFilterTaskType("service")}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterTaskType === "service" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600"}`}>
              Service
            </button>
          </div>
          {(!isEmployee || hasTaskCreateAccess) && (
            <select value={filterSup} onChange={(e) => setFilterSup(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-white cursor-pointer focus:outline-none">
              <option value="All">All Supervisors</option>{supervisors.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          )}
          {(!isEmployee || hasTaskCreateAccess) && (
            <select value={filterEmp} onChange={(e) => setFilterEmp(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-white cursor-pointer focus:outline-none">
              <option value="All">All Employees</option>
              {(isSupervisor && !hasFullAccess
                ? employees.filter((e) => e.supervisor_names && e.supervisor_names.includes(userName!))
                : employees
              ).map((e) => <option key={e.name} value={e.name}>{e.name}</option>)}
            </select>
          )}
          {projects.length > 0 && (
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-white cursor-pointer focus:outline-none">
              <option value="All">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.serial_number} — {p.customer_name}</option>
              ))}
            </select>
          )}
          {customers.length > 0 && (
            <select value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full sm:w-auto text-xs font-semibold px-3 py-2 rounded-lg border border-border bg-white cursor-pointer focus:outline-none">
              <option value="All">All Customers</option>
              {customers
                .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i)
                .map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          )}
          <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-semibold text-gray-600">{filterStatus === "Completed" ? "Completed From" : "Due From"}</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs font-semibold px-2 py-2 rounded-lg border border-border bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              <label className="text-xs font-semibold text-gray-600">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-xs font-semibold px-2 py-2 rounded-lg border border-border bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="text-xs font-bold px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">Clear</button>
              )}
            </div>
          <span className="text-xs text-gray-400 font-medium ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="space-y-3">
          {loading ? [...Array(3)].map((_, i) => <TaskCardSkeleton key={i} />) :
            filtered.length ? filtered.map((t) => {
              const isMyPorterTask = t.task.startsWith("Porter Booking") && t.assigned_to === userName;
              const isMyCreatedTask = hasTaskCreateAccess && t.created_by === userName;
              const customerName = t.customer_id
                ? customers.find((c) => String(c.id) === String(t.customer_id))?.name
                : t.project_id
                  ? projects.find((p) => String(p.id) === String(t.project_id))?.customer_name
                  : undefined;
              return <TaskCard key={t.id} task={t} customerName={customerName}
                canEdit={(canEditTask || isMyPorterTask || isMyCreatedTask) && !selectMode}
                canDelete={(canDeleteTask || isMyPorterTask || isMyCreatedTask) && !selectMode}
                canChangeStatus={!selectMode && (hasFullAccess || (isSupervisor && (t.supervisor === userName || (t.extra_assignees ?? []).includes(userName!))) || (isEmployee && (t.assigned_to === userName || (t.extra_assignees ?? []).includes(userName!) || isMyCreatedTask)))}
                onStatusChange={handleStatusChange}
                onPriorityChange={(canEditTask || isMyCreatedTask) && !selectMode ? handlePriorityChange : undefined}
                onEdit={(task) => {
                  if (task.task_type === "service") { setServiceEditingTask(task); setServiceModalOpen(true); }
                  else { setEditingTask(task); setTaskModalOpen(true); }
                }}
                onDelete={handleDelete}
                onViewDetail={!selectMode ? (task) => setDetailTask(task) : undefined}
                onShare={!selectMode ? (task) => setShareTasks([task]) : undefined}
                onConvertToPorterBooking={!selectMode && t.task.startsWith("Porter Booking") ? handleConvertToPorterBooking : undefined}
                selectable={selectMode}
                selected={selectedIds.has(t.id)}
                onSelect={toggleSelect} />;
            }) : (
              <div className="bg-white rounded-2xl border border-border p-16 text-center">
                <p className="text-4xl mb-3">📭</p><p className="text-sm text-gray-400 font-medium">No tasks found</p></div>
            )}
        </div>
      </div>
      {/* Task type selector */}
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
      <ShareTaskModal open={shareTasks.length > 0} tasks={shareTasks} onClose={() => setShareTasks([])} />
      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
  );
}
