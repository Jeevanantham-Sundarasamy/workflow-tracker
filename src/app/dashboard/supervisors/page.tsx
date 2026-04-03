"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Task } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Users, Key, Eye, EyeOff, Pencil, Check, X, Search } from "lucide-react";
import { checkPinUsed } from "@/lib/pinUtils";
import AdminOnly from "@/components/AdminOnly";
const dotColor: Record<string, string> = { Pending: "bg-amber-400", "In Progress": "bg-blue-400", Done: "bg-emerald-400", Delayed: "bg-red-400", "On Hold": "bg-orange-400", Cancelled: "bg-gray-400" };

interface SupervisorData {
  name: string;
  pin: string | null;
  department: string | null;
}

export default function SupervisorsPage() {
  const { toast } = useToast();
  const { hasFullAccess, login } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorData[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editPinValue, setEditPinValue] = useState("");
  const [showPin, setShowPin] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editDeptValue, setEditDeptValue] = useState("");
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [tr, sr] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("supervisors").select("*").order("name"),
      ]);
      if (tr.error) throw tr.error; if (sr.error) throw sr.error;
      setTasks(tr.data || []);
      setSupervisors((sr.data || []).map((s: { name: string; pin?: string; department?: string }) => ({ name: s.name, pin: s.pin || null, department: s.department || null })));
    } catch {
      // offline
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const addSupervisor = async () => {
    const name = newName.trim(); if (!name) return;
    if (supervisors.some((s) => s.name === name)) { toast("Already exists", "error"); return; }
    const pin = newPin.trim() || null;
    if (pin) {
      const usedBy = await checkPinUsed(pin);
      if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; }
    }
    const department = newDepartment.trim() || null;
    const { error } = await supabase.from("supervisors").insert({ name, pin, department });
    if (!error) {
      setSupervisors((p) => [...p, { name, pin, department }].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setNewPin(""); setNewDepartment("");
      toast("Supervisor added", "success");
    } else toast("Failed to add", "error");
  };

  const removeSupervisor = async (name: string) => {
    if (tasks.some((t) => t.supervisor === name) && !confirm(`"${name}" has tasks. Remove anyway?`)) return;
    const { error } = await supabase.from("supervisors").delete().eq("name", name);
    if (!error) { setSupervisors((p) => p.filter((s) => s.name !== name)); toast("Removed", "success"); }
  };

  const updatePin = async (name: string) => {
    const pin = editPinValue.trim() || null;
    if (pin) {
      const usedBy = await checkPinUsed(pin, "supervisor", name);
      if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; }
    }
    const { error } = await supabase.from("supervisors").update({ pin }).eq("name", name);
    if (!error) {
      setSupervisors((p) => p.map((s) => s.name === name ? { ...s, pin } : s));
      setEditingPin(null); setEditPinValue("");
      toast("PIN updated", "success");
    } else toast("Failed to update PIN", "error");
  };

  const updateSupervisor = async (oldName: string) => {
    const newName = editNameValue.trim();
    const department = editDeptValue.trim() || null;
    if (!newName) { setEditingName(null); return; }
    if (newName !== oldName && supervisors.some((s) => s.name === newName)) { toast("Name already exists", "error"); return; }
    const updates: Record<string, string | null> = { department };
    if (newName !== oldName) updates.name = newName;
    const { error } = await supabase.from("supervisors").update(updates).eq("name", oldName);
    if (!error) {
      if (newName !== oldName) {
        await Promise.all([
          supabase.from("tasks").update({ supervisor: newName }).eq("supervisor", oldName),
          supabase.from("employees").update({ supervisor_name: newName }).eq("supervisor_name", oldName),
        ]);
        setTasks((p) => p.map((t) => t.supervisor === oldName ? { ...t, supervisor: newName } : t));
      }
      setSupervisors((p) => p.map((s) => s.name === oldName ? { ...s, name: newName, department } : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingName(null); setEditNameValue(""); setEditDeptValue("");
      toast("Supervisor updated", "success");
    } else toast("Failed to update", "error");
  };

  const filtered = supervisors.filter((s) => {
    if (!search) return true;
    return s.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <AdminOnly>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Supervisors</h1>
          <p className="text-sm text-gray-400">{filtered.length} supervisor{filtered.length !== 1 ? "s" : ""}</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supervisors..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
        </div>

        {hasFullAccess && (
          <div className="bg-white rounded-2xl border border-border p-5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Add New Supervisor</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                placeholder="Supervisor name *"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                placeholder="PIN (optional)"
                maxLength={6} inputMode="numeric"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              <input type="text" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                placeholder="Department (optional)"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
            </div>
            <button onClick={addSupervisor}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition">
              <Plus className="w-4 h-4" /> Add Supervisor
            </button>
          </div>
        )}

        {filtered.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((sup) => {
              const supTasks = tasks.filter((t) => t.supervisor === sup.name);
              const initials = sup.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={sup.name} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
                      <div>
                        {editingName === sup.name ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                              <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") updateSupervisor(sup.name); if (e.key === "Escape") setEditingName(null); }}
                                placeholder="Name *" autoFocus
                                className="px-2 py-1 rounded-lg border border-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                            </div>
                            <input type="text" value={editDeptValue} onChange={(e) => setEditDeptValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") updateSupervisor(sup.name); if (e.key === "Escape") setEditingName(null); }}
                              placeholder="Department"
                              className="px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateSupervisor(sup.name)} className="text-emerald-600 hover:text-emerald-700"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingName(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-bold text-gray-900">{sup.name}</p>
                            {sup.department && <p className="text-xs text-primary-500 font-medium">{sup.department}</p>}
                          </>
                        )}
                        <p className="text-xs text-gray-400">{supTasks.length} task{supTasks.length !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    {hasFullAccess && editingName !== sup.name && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { setEditingName(sup.name); setEditNameValue(sup.name); setEditDeptValue(sup.department || ""); }}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => removeSupervisor(sup.name)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* PIN section */}
                  {hasFullAccess && (
                    <div className="mb-3 p-2.5 rounded-xl bg-gray-50 border border-border-light">
                      {editingPin === sup.name ? (
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <input type="text" value={editPinValue} onChange={(e) => setEditPinValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updatePin(sup.name)}
                            placeholder="Enter PIN" maxLength={6} inputMode="numeric" autoFocus
                            className="flex-1 px-2 py-1 rounded-lg border border-border text-xs text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                          <button onClick={() => updatePin(sup.name)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700">Save</button>
                          <button onClick={() => { setEditingPin(null); setEditPinValue(""); }} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-[11px] text-gray-500">PIN:</span>
                          {sup.pin ? (
                            <>
                              <span className="text-[11px] font-bold text-gray-700 tracking-widest">
                                {showPin === sup.name ? sup.pin : "••••"}
                              </span>
                              <button onClick={() => setShowPin(showPin === sup.name ? null : sup.name)} className="text-gray-400 hover:text-gray-600">
                                {showPin === sup.name ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Not set</span>
                          )}
                          <button onClick={() => { setEditingPin(sup.name); setEditPinValue(sup.pin || ""); }}
                            className="text-[10px] font-bold text-primary-600 hover:text-primary-700 ml-auto">
                            {sup.pin ? "Change" : "Set PIN"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {supTasks.length > 0 ? (
                    <div className="space-y-2 bg-surface-secondary rounded-xl p-3">
                      {STATUSES.filter((s) => supTasks.some((t) => t.status === s)).map((s) => (
                        <div key={s} className="flex items-center gap-2.5 text-xs">
                          <span className={`w-2 h-2 rounded-full ${dotColor[s]}`} />
                          <span className="text-gray-500">{s}</span>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${dotColor[s] || "bg-gray-400"}`}
                              style={{ width: `${(supTasks.filter((t) => t.status === s).length / supTasks.length) * 100}%` }} />
                          </div>
                          <span className="font-bold text-gray-700 min-w-[20px] text-right">{supTasks.filter((t) => t.status === s).length}</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400 italic">No tasks assigned</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-border p-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No supervisors yet</p>
          </div>
        )}
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome, Manager!", "success"); } return ok; }} />
    </div>
    </AdminOnly>
  );
}
