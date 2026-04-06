"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { MachineType, MachineTypeDepartment, MachineTypeTask } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus, Trash2, ChevronDown, ChevronRight, ArrowLeft, X, GripVertical, Pencil, Check,
} from "lucide-react";
import Link from "next/link";
import LoginRequired from "@/components/LoginRequired";

interface DeptWithTasks extends MachineTypeDepartment {
  tasks: MachineTypeTask[];
}

interface MachineTypeWithDepts extends MachineType {
  departments: DeptWithTasks[];
}

export default function MachineTypesPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, userName, login } = useAuth();
  const canEdit = hasFullAccess || isSupervisor;
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [machineTypes, setMachineTypes] = useState<MachineTypeWithDepts[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDepts, setFormDepts] = useState<{ name: string; tasks: { name: string; priority: string }[] }[]>([
    { name: "Purchase", tasks: [] },
    { name: "Imports", tasks: [] },
    { name: "Fabrication", tasks: [] },
    { name: "Machine Shop", tasks: [] },
    { name: "Assembly Mechanical", tasks: [] },
    { name: "Assembly Electrical", tasks: [] },
    { name: "Validation", tasks: [] },
    { name: "Dispatch", tasks: [] },
    { name: "Installation & Commissioning", tasks: [] },
  ]);
  const [formTaskPriority, setFormTaskPriority] = useState("Medium");
  const [newTaskInputs, setNewTaskInputs] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data: mts } = await supabase.from("machine_types").select("*").order("name");
      const { data: depts } = await supabase.from("machine_type_departments").select("*").order("sort_order");
      const { data: tasks } = await supabase.from("machine_type_tasks").select("*").order("sort_order");

      const result: MachineTypeWithDepts[] = (mts || []).map((mt: MachineType) => {
        const mtDepts = (depts || []).filter((d: MachineTypeDepartment) => d.machine_type_id === mt.id);
        return {
          ...mt,
          departments: mtDepts.map((d: MachineTypeDepartment) => ({
            ...d,
            tasks: (tasks || []).filter((t: MachineTypeTask) => t.department_id === d.id),
          })),
        };
      });
      setMachineTypes(result);
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const addDept = () => {
    setFormDepts([...formDepts, { name: "", tasks: [] }]);
  };

  const removeDept = (i: number) => {
    setFormDepts(formDepts.filter((_, idx) => idx !== i));
  };

  const addTask = (deptIdx: number) => {
    const taskName = (newTaskInputs[deptIdx] || "").trim();
    if (!taskName) return;
    const updated = [...formDepts];
    updated[deptIdx].tasks.push({ name: taskName, priority: formTaskPriority });
    setFormDepts(updated);
    setNewTaskInputs({ ...newTaskInputs, [deptIdx]: "" });
    setFormTaskPriority("Medium");
  };

  const removeTask = (deptIdx: number, taskIdx: number) => {
    const updated = [...formDepts];
    updated[deptIdx].tasks.splice(taskIdx, 1);
    setFormDepts(updated);
  };

  const handleCreate = async () => {
    if (!formName.trim()) { toast("Machine type name required", "error"); return; }
    const validDepts = formDepts.filter((d) => d.name.trim());
    if (validDepts.length === 0) { toast("Add at least one department", "error"); return; }

    setSubmitting(true);

    const { data: mt, error } = await supabase.from("machine_types").insert({
      name: formName.trim(),
      description: formDesc.trim() || null,
      created_by: userName || "Admin",
    }).select().single();

    if (error || !mt) { toast("Failed to create", "error"); setSubmitting(false); return; }

    for (let i = 0; i < validDepts.length; i++) {
      const dept = validDepts[i];
      const { data: deptData } = await supabase.from("machine_type_departments").insert({
        machine_type_id: mt.id,
        name: dept.name.trim(),
        sort_order: i,
      }).select().single();

      if (deptData && dept.tasks.length > 0) {
        const taskRows = dept.tasks.map((t, j) => ({
          department_id: deptData.id,
          name: t.name,
          priority: t.priority,
          sort_order: j,
        }));
        await supabase.from("machine_type_tasks").insert(taskRows);
      }
    }

    toast("Machine type created!", "success");
    setModalOpen(false);
    setFormName(""); setFormDesc("");
    setFormDepts([{ name: "", tasks: [] }]); setFormTaskPriority("Medium");
    setNewTaskInputs({});
    setSubmitting(false);
    loadData();
  };

  const deleteMachineType = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its departments/tasks?`)) return;
    const { error } = await supabase.from("machine_types").delete().eq("id", id);
    if (!error) { setMachineTypes((p) => p.filter((m) => m.id !== id)); toast("Deleted", "success"); }
  };

  // Inline editing state
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [editDeptName, setEditDeptName] = useState("");
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [addingTaskToDept, setAddingTaskToDept] = useState<string | null>(null);
  const [inlineNewTask, setInlineNewTask] = useState("");
  const [inlineNewTaskPriority, setInlineNewTaskPriority] = useState("Medium");
  const [addingDeptToType, setAddingDeptToType] = useState<string | null>(null);
  const [inlineNewDept, setInlineNewDept] = useState("");
  const [editingMtName, setEditingMtName] = useState<string | null>(null);
  const [editMtNameValue, setEditMtNameValue] = useState("");
  const [editMtDescValue, setEditMtDescValue] = useState("");

  // Edit machine type name/description
  const updateMachineType = async (id: string) => {
    const name = editMtNameValue.trim(); if (!name) return;
    const { error } = await supabase.from("machine_types").update({ name, description: editMtDescValue.trim() || null }).eq("id", id);
    if (!error) { setMachineTypes((p) => p.map((m) => m.id === id ? { ...m, name, description: editMtDescValue.trim() || null } : m)); setEditingMtName(null); toast("Updated", "success"); }
  };

  // Department CRUD
  const addDeptToType = async (mtId: string) => {
    const name = inlineNewDept.trim(); if (!name) return;
    const sortOrder = machineTypes.find((m) => m.id === mtId)?.departments.length || 0;
    const { data, error } = await supabase.from("machine_type_departments").insert({ machine_type_id: mtId, name, sort_order: sortOrder }).select().single();
    if (!error && data) {
      setMachineTypes((p) => p.map((m) => m.id === mtId ? { ...m, departments: [...m.departments, { ...data, tasks: [] }] } : m));
      setInlineNewDept(""); setAddingDeptToType(null); toast("Department added", "success");
    } else toast("Failed — name may already exist", "error");
  };

  const updateDeptName = async (deptId: string, mtId: string) => {
    const name = editDeptName.trim(); if (!name) return;
    const { error } = await supabase.from("machine_type_departments").update({ name }).eq("id", deptId);
    if (!error) {
      setMachineTypes((p) => p.map((m) => m.id === mtId ? { ...m, departments: m.departments.map((d) => d.id === deptId ? { ...d, name } : d) } : m));
      setEditingDept(null); toast("Updated", "success");
    }
  };

  const deleteDept = async (deptId: string, mtId: string, name: string) => {
    if (!confirm(`Delete department "${name}" and all its tasks?`)) return;
    const { error } = await supabase.from("machine_type_departments").delete().eq("id", deptId);
    if (!error) {
      setMachineTypes((p) => p.map((m) => m.id === mtId ? { ...m, departments: m.departments.filter((d) => d.id !== deptId) } : m));
      toast("Deleted", "success");
    }
  };

  // Task CRUD
  const addTaskToDept = async (deptId: string, mtId: string) => {
    const name = inlineNewTask.trim(); if (!name) return;
    const dept = machineTypes.find((m) => m.id === mtId)?.departments.find((d) => d.id === deptId);
    const sortOrder = dept?.tasks.length || 0;
    const deptName = dept?.name || "";
    const { data, error } = await supabase.from("machine_type_tasks").insert({ department_id: deptId, name, priority: inlineNewTaskPriority, sort_order: sortOrder }).select().single();
    if (!error && data) {
      setMachineTypes((p) => p.map((m) => m.id === mtId ? { ...m, departments: m.departments.map((d) => d.id === deptId ? { ...d, tasks: [...d.tasks, data] } : d) } : m));

      // Also add this task to all existing projects of this machine type
      const { data: projects } = await supabase.from("projects").select("id").eq("machine_type_id", mtId).neq("status", "Completed");
      if (projects && projects.length > 0) {
        const projectTasks = projects.map((p: { id: string }) => ({
          project_id: p.id,
          department_name: deptName,
          task_name: name,
          priority: inlineNewTaskPriority,
          sort_order: sortOrder,
        }));
        await supabase.from("project_tasks").insert(projectTasks);
        toast(`Task added to template + ${projects.length} existing project${projects.length > 1 ? "s" : ""}`, "success");
      } else {
        toast("Task added to template", "success");
      }
      setInlineNewTask(""); setInlineNewTaskPriority("Medium");
    }
  };

  const updateTaskName = async (taskId: string, deptId: string, mtId: string) => {
    const name = editTaskName.trim(); if (!name) return;
    const { error } = await supabase.from("machine_type_tasks").update({ name }).eq("id", taskId);
    if (!error) {
      setMachineTypes((p) => p.map((m) => m.id === mtId ? { ...m, departments: m.departments.map((d) => d.id === deptId ? { ...d, tasks: d.tasks.map((t) => t.id === taskId ? { ...t, name } : t) } : d) } : m));
      setEditingTask(null); toast("Updated", "success");
    }
  };

  const deleteTask = async (taskId: string, deptId: string, mtId: string) => {
    const { error } = await supabase.from("machine_type_tasks").delete().eq("id", taskId);
    if (!error) {
      setMachineTypes((p) => p.map((m) => m.id === mtId ? { ...m, departments: m.departments.map((d) => d.id === deptId ? { ...d, tasks: d.tasks.filter((t) => t.id !== taskId) } : d) } : m));
      toast("Deleted", "success");
    }
  };

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/production" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Machine Types</h1>
              <p className="text-sm text-gray-400">{machineTypes.length} type{machineTypes.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {canEdit && (
            <button onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
              <Plus className="w-4 h-4" /> New Type
            </button>
          )}
        </div>

        {/* Machine Type List */}
        {loading ? (
          <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="bg-white rounded-2xl border border-border p-6 h-24 animate-pulse" />)}</div>
        ) : machineTypes.length ? (
          <div className="space-y-3">
            {machineTypes.map((mt) => {
              const isOpen = expanded === mt.id;
              const totalTasks = mt.departments.reduce((sum, d) => sum + d.tasks.length, 0);
              return (
                <div key={mt.id} className="bg-white rounded-2xl border border-border overflow-hidden">
                  <button onClick={() => setExpanded(isOpen ? null : mt.id)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      {editingMtName === mt.id ? (
                        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <input type="text" value={editMtNameValue} onChange={(e) => setEditMtNameValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updateMachineType(mt.id)}
                            placeholder="Name" autoFocus className="px-2 py-1 rounded-lg border border-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-40" />
                          <input type="text" value={editMtDescValue} onChange={(e) => setEditMtDescValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updateMachineType(mt.id)}
                            placeholder="Description" className="px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-48" />
                          <button onClick={(e) => { e.stopPropagation(); updateMachineType(mt.id); }} className="text-emerald-600"><Check className="w-4 h-4" /></button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingMtName(null); }} className="text-gray-400"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-sm font-bold text-gray-900">{mt.name}</h3>
                          <p className="text-xs text-gray-400">{mt.departments.length} departments · {totalTasks} tasks</p>
                          {mt.description && <p className="text-xs text-gray-400 italic mt-1">{mt.description}</p>}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {canEdit && editingMtName !== mt.id && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); setEditingMtName(mt.id); setEditMtNameValue(mt.name); setEditMtDescValue(mt.description || ""); }}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteMachineType(mt.id, mt.name); }}
                            className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border p-5 bg-gray-50 space-y-3">
                      {mt.departments.map((dept) => (
                        <div key={dept.id} className="bg-white rounded-xl border border-border p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                            {editingDept === dept.id ? (
                              <div className="flex items-center gap-1.5">
                                <input type="text" value={editDeptName} onChange={(e) => setEditDeptName(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && updateDeptName(dept.id, mt.id)} autoFocus
                                  className="px-2 py-0.5 rounded-lg border border-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                <button onClick={() => updateDeptName(dept.id, mt.id)} className="text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setEditingDept(null)} className="text-gray-400"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <>
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">{dept.name}</h4>
                                <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{dept.tasks.length} tasks</span>
                                {canEdit && (
                                  <div className="flex items-center gap-1 ml-auto">
                                    <button onClick={() => { setEditingDept(dept.id); setEditDeptName(dept.name); }}
                                      className="text-gray-400 hover:text-primary-600"><Pencil className="w-3 h-3" /></button>
                                    <button onClick={() => deleteDept(dept.id, mt.id, dept.name)}
                                      className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {/* Tasks list */}
                          <div className="space-y-1 ml-5">
                            {dept.tasks.map((task, i) => (
                              <div key={task.id} className="flex items-center gap-2 group">
                                {editingTask === task.id ? (
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <span className="text-gray-400 text-xs">{i + 1}.</span>
                                    <input type="text" value={editTaskName} onChange={(e) => setEditTaskName(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && updateTaskName(task.id, dept.id, mt.id)} autoFocus
                                      className="flex-1 px-2 py-0.5 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                                    <button onClick={() => updateTaskName(task.id, dept.id, mt.id)} className="text-emerald-600"><Check className="w-3 h-3" /></button>
                                    <button onClick={() => setEditingTask(null)} className="text-gray-400"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-xs text-gray-600 flex-1">{i + 1}. {task.name}
                                      <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${task.priority === "High" ? "text-red-600 bg-red-50" : task.priority === "Low" ? "text-gray-400 bg-gray-100" : "text-amber-600 bg-amber-50"}`}>{task.priority}</span>
                                    </p>
                                    {canEdit && (
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <button onClick={() => { setEditingTask(task.id); setEditTaskName(task.name); }}
                                          className="text-gray-400 hover:text-primary-600"><Pencil className="w-2.5 h-2.5" /></button>
                                        <button onClick={() => deleteTask(task.id, dept.id, mt.id)}
                                          className="text-gray-400 hover:text-red-500"><Trash2 className="w-2.5 h-2.5" /></button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ))}
                            {dept.tasks.length === 0 && <p className="text-xs text-gray-400 italic">No tasks defined</p>}
                            {/* Add task inline */}
                            {canEdit && (
                              addingTaskToDept === dept.id ? (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <input type="text" value={inlineNewTask} onChange={(e) => setInlineNewTask(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addTaskToDept(dept.id, mt.id)} autoFocus
                                    placeholder="Task name" className="flex-1 px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                                  <select value={inlineNewTaskPriority} onChange={(e) => setInlineNewTaskPriority(e.target.value)}
                                    className="px-1.5 py-1 rounded-lg border border-border text-[10px] font-bold focus:outline-none">
                                    <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                                  </select>
                                  <button onClick={() => addTaskToDept(dept.id, mt.id)} className="text-[10px] font-bold text-primary-600">Add</button>
                                  <button onClick={() => { setAddingTaskToDept(null); setInlineNewTask(""); setInlineNewTaskPriority("Medium"); }} className="text-gray-400"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => { setAddingTaskToDept(dept.id); setInlineNewTask(""); }}
                                  className="text-[10px] font-bold text-primary-600 hover:text-primary-700 mt-1 flex items-center gap-0.5">
                                  <Plus className="w-3 h-3" /> Add Task
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Add department inline */}
                      {canEdit && (
                        addingDeptToType === mt.id ? (
                          <div className="flex items-center gap-2">
                            <input type="text" value={inlineNewDept} onChange={(e) => setInlineNewDept(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addDeptToType(mt.id)} autoFocus
                              placeholder="Department name" className="flex-1 px-3 py-2 rounded-xl border border-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                            <button onClick={() => addDeptToType(mt.id)} className="text-xs font-bold text-primary-600">Add</button>
                            <button onClick={() => { setAddingDeptToType(null); setInlineNewDept(""); }} className="text-gray-400"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setAddingDeptToType(mt.id); setInlineNewDept(""); }}
                            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Add Department
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border p-16 text-center">
            <p className="text-sm text-gray-400 font-medium">No machine types yet</p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-base font-bold text-gray-900">New Machine Type</h2>
              <button onClick={() => setModalOpen(false)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Name <span className="text-red-400">*</span></label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. CNC Machine"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Description</label>
                <input type="text" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              </div>

              {/* Departments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Departments & Tasks</label>
                  <button onClick={addDept} className="text-[10px] font-bold text-primary-600 hover:text-primary-700">+ Add Department</button>
                </div>
                <div className="space-y-3">
                  {formDepts.map((dept, dIdx) => (
                    <div key={dIdx} className="bg-gray-50 rounded-xl border border-border p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input type="text" value={dept.name} onChange={(e) => { const u = [...formDepts]; u[dIdx].name = e.target.value; setFormDepts(u); }}
                          placeholder="Department name" className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                        <button onClick={() => removeDept(dIdx)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {/* Tasks */}
                      <div className="ml-2 space-y-1">
                        {dept.tasks.map((task, tIdx) => (
                          <div key={tIdx} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className="text-gray-400">{tIdx + 1}.</span>
                            <span className="flex-1">{task.name}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${task.priority === "High" ? "text-red-600 bg-red-50" : task.priority === "Low" ? "text-gray-400 bg-gray-100" : "text-amber-600 bg-amber-50"}`}>{task.priority}</span>
                            <button onClick={() => removeTask(dIdx, tIdx)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-1">
                          <input type="text" value={newTaskInputs[dIdx] || ""} onChange={(e) => setNewTaskInputs({ ...newTaskInputs, [dIdx]: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && addTask(dIdx)}
                            placeholder="Add task..." className="flex-1 px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                          <select value={formTaskPriority} onChange={(e) => setFormTaskPriority(e.target.value)}
                            className="px-1.5 py-1 rounded-lg border border-border text-[10px] font-bold focus:outline-none">
                            <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                          </select>
                          <button onClick={() => addTask(dIdx)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700">Add</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleCreate} disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition disabled:opacity-50">
                {submitting ? "Creating..." : "Create Machine Type"}
              </button>
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
