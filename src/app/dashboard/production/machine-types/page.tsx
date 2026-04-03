"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { MachineType, MachineTypeDepartment, MachineTypeTask } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus, Trash2, ChevronDown, ChevronRight, ArrowLeft, X, GripVertical,
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
  const { hasFullAccess, userName, login } = useAuth();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [machineTypes, setMachineTypes] = useState<MachineTypeWithDepts[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create form
  const [modalOpen, setModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formDepts, setFormDepts] = useState<{ name: string; tasks: string[] }[]>([
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
    updated[deptIdx].tasks.push(taskName);
    setFormDepts(updated);
    setNewTaskInputs({ ...newTaskInputs, [deptIdx]: "" });
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
          name: t,
          sort_order: j,
        }));
        await supabase.from("machine_type_tasks").insert(taskRows);
      }
    }

    toast("Machine type created!", "success");
    setModalOpen(false);
    setFormName(""); setFormDesc("");
    setFormDepts([{ name: "", tasks: [] }]);
    setNewTaskInputs({});
    setSubmitting(false);
    loadData();
  };

  const deleteMachineType = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and all its departments/tasks?`)) return;
    const { error } = await supabase.from("machine_types").delete().eq("id", id);
    if (!error) { setMachineTypes((p) => p.filter((m) => m.id !== id)); toast("Deleted", "success"); }
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
          {hasFullAccess && (
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
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{mt.name}</h3>
                      <p className="text-xs text-gray-400">{mt.departments.length} departments · {totalTasks} tasks</p>
                      {mt.description && <p className="text-xs text-gray-400 italic mt-1">{mt.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFullAccess && (
                        <button onClick={(e) => { e.stopPropagation(); deleteMachineType(mt.id, mt.name); }}
                          className="text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                          <Trash2 className="w-3 h-3" />
                        </button>
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
                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">{dept.name}</h4>
                            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{dept.tasks.length} tasks</span>
                          </div>
                          {dept.tasks.length > 0 ? (
                            <div className="space-y-1 ml-5">
                              {dept.tasks.map((task, i) => (
                                <p key={task.id} className="text-xs text-gray-600">{i + 1}. {task.name}</p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic ml-5">No tasks defined</p>
                          )}
                        </div>
                      ))}
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
                            <span className="flex-1">{task}</span>
                            <button onClick={() => removeTask(dIdx, tIdx)} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                          </div>
                        ))}
                        <div className="flex items-center gap-2 mt-1">
                          <input type="text" value={newTaskInputs[dIdx] || ""} onChange={(e) => setNewTaskInputs({ ...newTaskInputs, [dIdx]: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && addTask(dIdx)}
                            placeholder="Add task..." className="flex-1 px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
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
