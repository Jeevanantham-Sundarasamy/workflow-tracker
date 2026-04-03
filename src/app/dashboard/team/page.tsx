"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Task, Employee } from "@/lib/types";
import { STATUSES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Users, Key, Eye, EyeOff, Search, Pencil, Check, X, Briefcase, User, UserCircle } from "lucide-react";
import LoginRequired from "@/components/LoginRequired";
import { checkPinUsed } from "@/lib/pinUtils";

const dotColor: Record<string, string> = { Pending: "bg-amber-400", "In Progress": "bg-blue-400", Done: "bg-emerald-400", Delayed: "bg-red-400", "On Hold": "bg-orange-400", Cancelled: "bg-gray-400" };

interface ManagerData { name: string; pin: string | null; department: string | null; phone: string | null; }
interface SupervisorData { name: string; pin: string | null; department: string | null; manager_names: string[]; phone: string | null; }

type Tab = "managers" | "supervisors" | "employees";

export default function TeamPage() {
  const { toast } = useToast();
  const { isAdmin, hasFullAccess, login } = useAuth();
  const [tab, setTab] = useState<Tab>("managers");
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Data
  const [managers, setManagers] = useState<ManagerData[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Add forms
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSupervisor, setNewSupervisor] = useState("");
  const [newManagers, setNewManagers] = useState<string[]>([]);

  // Edit PIN
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editPinValue, setEditPinValue] = useState("");
  const [showPin, setShowPin] = useState<string | null>(null);

  // Edit name/details
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editDeptValue, setEditDeptValue] = useState("");
  const [editDesignationValue, setEditDesignationValue] = useState("");
  const [editPhoneValue, setEditPhoneValue] = useState("");
  const [editSupervisorValue, setEditSupervisorValue] = useState("");
  const [editManagerValues, setEditManagerValues] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [tr, mr, sr, er] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("managers").select("*").order("name"),
        supabase.from("supervisors").select("*").order("name"),
        supabase.from("employees").select("*").order("name"),
      ]);
      setTasks(tr.data || []);
      setManagers((mr.data || []).map((m: ManagerData) => ({ name: m.name, pin: m.pin || null, department: m.department || null, phone: m.phone || null })));
      setSupervisors((sr.data || []).map((s: { name: string; pin?: string; department?: string; manager_names?: string; phone?: string }) => ({
        name: s.name, pin: s.pin || null, department: s.department || null,
        manager_names: s.manager_names ? s.manager_names.split(",").map((n) => n.trim()).filter(Boolean) : [],
        phone: s.phone || null,
      })));
      setEmployees(er.data || []);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const clearForm = () => {
    setNewName(""); setNewPin(""); setNewDepartment(""); setNewDesignation(""); setNewPhone(""); setNewSupervisor(""); setNewManagers([]);
  };

  // ==================== MANAGERS ====================
  const addManager = async () => {
    const name = newName.trim(); if (!name) return;
    if (managers.some((m) => m.name === name)) { toast("Already exists", "error"); return; }
    const pin = newPin.trim() || null;
    if (pin) { const usedBy = await checkPinUsed(pin); if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; } }
    const department = newDepartment.trim() || null;
    const phone = newPhone.trim() || null;
    const { error } = await supabase.from("managers").insert({ name, pin, department, phone });
    if (!error) { setManagers((p) => [...p, { name, pin, department, phone }].sort((a, b) => a.name.localeCompare(b.name))); clearForm(); toast("Manager added", "success"); }
    else toast("Failed to add", "error");
  };

  const removeManager = async (name: string) => {
    if (!confirm(`Remove manager "${name}"?`)) return;
    const { error } = await supabase.from("managers").delete().eq("name", name);
    if (!error) { setManagers((p) => p.filter((m) => m.name !== name)); toast("Removed", "success"); }
  };

  const updateManagerPin = async (name: string) => {
    const pin = editPinValue.trim() || null;
    if (pin) { const usedBy = await checkPinUsed(pin, "manager", name); if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; } }
    const { error } = await supabase.from("managers").update({ pin }).eq("name", name);
    if (!error) { setManagers((p) => p.map((m) => m.name === name ? { ...m, pin } : m)); setEditingPin(null); setEditPinValue(""); toast("PIN updated", "success"); }
  };

  const updateManager = async (oldName: string) => {
    const name = editNameValue.trim(); if (!name) { setEditingItem(null); return; }
    if (name !== oldName && managers.some((m) => m.name === name)) { toast("Name exists", "error"); return; }
    const department = editDeptValue.trim() || null;
    const phone = editPhoneValue.trim() || null;
    const { error } = await supabase.from("managers").update({ name, department, phone }).eq("name", oldName);
    if (!error) { setManagers((p) => p.map((m) => m.name === oldName ? { ...m, name, department, phone } : m).sort((a, b) => a.name.localeCompare(b.name))); setEditingItem(null); toast("Updated", "success"); }
  };

  // ==================== SUPERVISORS ====================
  const addSupervisor = async () => {
    const name = newName.trim(); if (!name) return;
    if (supervisors.some((s) => s.name === name)) { toast("Already exists", "error"); return; }
    const pin = newPin.trim() || null;
    if (pin) { const usedBy = await checkPinUsed(pin); if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; } }
    const department = newDepartment.trim() || null;
    const manager_names_str = newManagers.length > 0 ? newManagers.join(",") : null;
    const phone = newPhone.trim() || null;
    const { error } = await supabase.from("supervisors").insert({ name, pin, department, manager_names: manager_names_str, phone });
    if (!error) { setSupervisors((p) => [...p, { name, pin, department, manager_names: newManagers, phone }].sort((a, b) => a.name.localeCompare(b.name))); clearForm(); toast("Supervisor added", "success"); }
    else toast("Failed to add", "error");
  };

  const removeSupervisor = async (name: string) => {
    if (tasks.some((t) => t.supervisor === name) && !confirm(`"${name}" has tasks. Remove anyway?`)) return;
    const { error } = await supabase.from("supervisors").delete().eq("name", name);
    if (!error) { setSupervisors((p) => p.filter((s) => s.name !== name)); toast("Removed", "success"); }
  };

  const updateSupervisorPin = async (name: string) => {
    const pin = editPinValue.trim() || null;
    if (pin) { const usedBy = await checkPinUsed(pin, "supervisor", name); if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; } }
    const { error } = await supabase.from("supervisors").update({ pin }).eq("name", name);
    if (!error) { setSupervisors((p) => p.map((s) => s.name === name ? { ...s, pin } : s)); setEditingPin(null); setEditPinValue(""); toast("PIN updated", "success"); }
  };

  const updateSupervisor = async (oldName: string) => {
    const name = editNameValue.trim(); if (!name) { setEditingItem(null); return; }
    if (name !== oldName && supervisors.some((s) => s.name === name)) { toast("Name exists", "error"); return; }
    const department = editDeptValue.trim() || null;
    const manager_names_str = editManagerValues.length > 0 ? editManagerValues.join(",") : null;
    const phone = editPhoneValue.trim() || null;
    const updates: Record<string, string | null> = { department, manager_names: manager_names_str, phone };
    if (name !== oldName) updates.name = name;
    const { error } = await supabase.from("supervisors").update(updates).eq("name", oldName);
    if (!error) {
      if (name !== oldName) {
        await Promise.all([
          supabase.from("tasks").update({ supervisor: name }).eq("supervisor", oldName),
          supabase.from("employees").update({ supervisor_name: name }).eq("supervisor_name", oldName),
        ]);
        setTasks((p) => p.map((t) => t.supervisor === oldName ? { ...t, supervisor: name } : t));
      }
      setSupervisors((p) => p.map((s) => s.name === oldName ? { ...s, name, department, manager_names: editManagerValues, phone } : s).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingItem(null); toast("Updated", "success");
    }
  };

  // ==================== EMPLOYEES ====================
  const addEmployee = async () => {
    const name = newName.trim(); if (!name) { toast("Name required", "error"); return; }
    const pin = newPin.trim() || null;
    if (pin) { const usedBy = await checkPinUsed(pin); if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; } }
    const { data, error } = await supabase.from("employees").insert({
      name, pin,
      supervisor_name: newSupervisor || null,
      designation: newDesignation.trim() || null,
      phone: newPhone.trim() || null,
      department: newDepartment.trim() || null,
    }).select().single();
    if (!error && data) { setEmployees((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name))); clearForm(); toast("Employee added", "success"); }
    else toast("Failed to add", "error");
  };

  const removeEmployee = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) { setEmployees((p) => p.filter((e) => e.id !== id)); toast("Removed", "success"); }
  };

  const updateEmployeePin = async (id: string) => {
    const pin = editPinValue.trim() || null;
    if (pin) { const emp = employees.find((e) => e.id === id); const usedBy = await checkPinUsed(pin, "employee", emp?.name); if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; } }
    const { error } = await supabase.from("employees").update({ pin }).eq("id", id);
    if (!error) { setEmployees((p) => p.map((e) => e.id === id ? { ...e, pin } : e)); setEditingPin(null); setEditPinValue(""); toast("PIN updated", "success"); }
  };

  const updateEmployee = async (id: string) => {
    const name = editNameValue.trim(); if (!name) { toast("Name required", "error"); return; }
    const updates = {
      name,
      designation: editDesignationValue.trim() || null,
      phone: editPhoneValue.trim() || null,
      supervisor_name: editSupervisorValue || null,
      department: editDeptValue.trim() || null,
    };
    const { error } = await supabase.from("employees").update(updates).eq("id", id);
    if (!error) { setEmployees((p) => p.map((e) => e.id === id ? { ...e, ...updates } : e).sort((a, b) => a.name.localeCompare(b.name))); setEditingItem(null); toast("Updated", "success"); }
  };

  const [filterDept, setFilterDept] = useState("All");

  // Get all unique departments across all roles
  const allDepartments = Array.from(new Set([
    ...managers.map((m) => m.department).filter(Boolean),
    ...supervisors.map((s) => s.department).filter(Boolean),
    ...employees.map((e) => e.department).filter(Boolean),
  ] as string[])).sort();

  // Filtering
  const q = search.toLowerCase();
  const filteredManagers = managers.filter((m) => {
    if (filterDept !== "All" && m.department !== filterDept) return false;
    if (q && !m.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const filteredSupervisors = supervisors.filter((s) => {
    if (filterDept !== "All" && s.department !== filterDept) return false;
    if (q && !s.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const filteredEmployees = employees.filter((e) => {
    if (filterDept !== "All" && e.department !== filterDept) return false;
    if (q && !e.name.toLowerCase().includes(q) && !(e.designation || "").toLowerCase().includes(q)) return false;
    return true;
  });

  // Group by department helper
  const groupByDept = <T extends { department?: string | null }>(items: T[]) => {
    const groups: Record<string, T[]> = {};
    for (const item of items) {
      const dept = item.department || "No Department";
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No Department") return 1;
      if (b === "No Department") return -1;
      return a.localeCompare(b);
    });
  };

  // PIN section component
  const PinSection = ({ id, pin, onUpdate }: { id: string; pin: string | null; onUpdate: (id: string) => void }) => (
    <div className="p-2.5 rounded-xl bg-gray-50 border border-border-light">
      {editingPin === id ? (
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input type="text" value={editPinValue} onChange={(e) => setEditPinValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onUpdate(id)}
            placeholder="Enter PIN" maxLength={6} inputMode="numeric" autoFocus
            className="flex-1 px-2 py-1 rounded-lg border border-border text-xs text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
          <button onClick={() => onUpdate(id)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700">Save</button>
          <button onClick={() => { setEditingPin(null); setEditPinValue(""); }} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-[11px] text-gray-500">PIN:</span>
          {pin ? (
            <>
              <span className="text-[11px] font-bold text-gray-700 tracking-widest">{showPin === id ? pin : "••••"}</span>
              <button onClick={() => setShowPin(showPin === id ? null : id)} className="text-gray-400 hover:text-gray-600">
                {showPin === id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </>
          ) : <span className="text-[11px] text-gray-400 italic">Not set</span>}
          <button onClick={() => { setEditingPin(id); setEditPinValue(pin || ""); }}
            className="text-[10px] font-bold text-primary-600 hover:text-primary-700 ml-auto">
            {pin ? "Change" : "Set PIN"}
          </button>
        </div>
      )}
    </div>
  );

  const tabs: { key: Tab; label: string; icon: typeof Briefcase; count: number; color: string }[] = [
    { key: "managers", label: "Managers", icon: Briefcase, count: managers.length, color: "text-violet-600" },
    { key: "supervisors", label: "Supervisors", icon: User, count: supervisors.length, color: "text-emerald-600" },
    { key: "employees", label: "Employees", icon: UserCircle, count: employees.length, color: "text-blue-600" },
  ];

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-400">Manage managers, supervisors & employees</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch(""); setEditingItem(null); setEditingPin(null); clearForm(); }}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition ${
                tab === t.key ? "bg-primary-600 text-white" : "bg-white border border-border text-gray-500 hover:bg-gray-50"
              }`}>
              <t.icon className="w-4 h-4" /> {t.label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Search + Department Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${tab}...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
          </div>
          {allDepartments.length > 0 && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-border bg-white text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
              <option value="All">All Departments</option>
              {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {/* ==================== MANAGERS TAB ==================== */}
        {tab === "managers" && (
          <>
            {isAdmin && (
              <div className="bg-white rounded-2xl border border-border p-5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Add New Manager</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManager()}
                    placeholder="Manager name *" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManager()}
                    placeholder="PIN (for login)" maxLength={6} inputMode="numeric"
                    className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManager()}
                    placeholder="Department *" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addManager()}
                    placeholder="Phone (optional)" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
                <button onClick={addManager} className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition">
                  <Plus className="w-4 h-4" /> Add Manager</button>
              </div>
            )}

            {filteredManagers.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredManagers.map((mgr) => {
                  const initials = mgr.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={mgr.name} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
                          <div>
                            {editingItem === `mgr-${mgr.name}` ? (
                              <div className="space-y-2">
                                <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateManager(mgr.name); if (e.key === "Escape") setEditingItem(null); }}
                                  placeholder="Name *" autoFocus className="px-2 py-1 rounded-lg border border-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                <input type="text" value={editDeptValue} onChange={(e) => setEditDeptValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateManager(mgr.name); if (e.key === "Escape") setEditingItem(null); }}
                                  placeholder="Department" className="px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                <input type="text" value={editPhoneValue} onChange={(e) => setEditPhoneValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateManager(mgr.name); if (e.key === "Escape") setEditingItem(null); }}
                                  placeholder="Phone" className="px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => updateManager(mgr.name)}
                                    className="text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-1.5 rounded-lg transition">Save</button>
                                  <button onClick={() => setEditingItem(null)}
                                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg transition">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-gray-900">{mgr.name}</p>
                                {mgr.department && <p className="text-xs text-violet-500 font-medium">{mgr.department}</p>}
                                {mgr.phone && <p className="text-xs text-gray-400">Phone: {mgr.phone}</p>}
                                <p className="text-[10px] text-gray-400 font-semibold uppercase">Manager</p>
                              </>
                            )}
                          </div>
                        </div>
                        {isAdmin && editingItem !== `mgr-${mgr.name}` && (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setEditingItem(`mgr-${mgr.name}`); setEditNameValue(mgr.name); setEditDeptValue(mgr.department || ""); setEditPhoneValue(mgr.phone || ""); }}
                              className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                              <Pencil className="w-3 h-3" /> Edit</button>
                            <button onClick={() => removeManager(mgr.name)}
                              className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                              <Trash2 className="w-3 h-3" /> Remove</button>
                          </div>
                        )}
                      </div>
                      {isAdmin && <PinSection id={`mgr-${mgr.name}`} pin={mgr.pin} onUpdate={() => updateManagerPin(mgr.name)} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-border p-16 text-center">
                <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No managers yet</p>
              </div>
            )}
          </>
        )}

        {/* ==================== SUPERVISORS TAB ==================== */}
        {tab === "supervisors" && (
          <>
            {hasFullAccess && (
              <div className="bg-white rounded-2xl border border-border p-5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Add New Supervisor</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                    placeholder="Supervisor name *" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                    placeholder="PIN (optional)" maxLength={6} inputMode="numeric"
                    className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                    placeholder="Department *" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSupervisor()}
                    placeholder="Phone (optional)" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  {managers.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Reports to Manager(s)</p>
                      <div className="flex flex-wrap gap-2">
                        {managers.map((m) => (
                          <label key={m.name} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border cursor-pointer transition ${
                            newManagers.includes(m.name) ? "bg-violet-50 text-violet-700 border-violet-300" : "bg-white text-gray-500 border-border hover:bg-gray-50"
                          }`}>
                            <input type="checkbox" className="hidden" checked={newManagers.includes(m.name)}
                              onChange={(e) => setNewManagers(e.target.checked ? [...newManagers, m.name] : newManagers.filter((n) => n !== m.name))} />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button onClick={addSupervisor} className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition">
                  <Plus className="w-4 h-4" /> Add Supervisor</button>
              </div>
            )}

            {filteredSupervisors.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSupervisors.map((sup) => {
                  const supTasks = tasks.filter((t) => t.supervisor === sup.name);
                  const initials = sup.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={sup.name} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
                          <div>
                            {editingItem === `sup-${sup.name}` ? (
                              <div className="space-y-2">
                                <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateSupervisor(sup.name); if (e.key === "Escape") setEditingItem(null); }}
                                  placeholder="Name *" autoFocus className="px-2 py-1 rounded-lg border border-border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                <input type="text" value={editDeptValue} onChange={(e) => setEditDeptValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateSupervisor(sup.name); if (e.key === "Escape") setEditingItem(null); }}
                                  placeholder="Department" className="px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                <input type="text" value={editPhoneValue} onChange={(e) => setEditPhoneValue(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") updateSupervisor(sup.name); if (e.key === "Escape") setEditingItem(null); }}
                                  placeholder="Phone" className="px-2 py-1 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-36" />
                                {managers.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {managers.map((m) => (
                                      <label key={m.name} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border cursor-pointer transition ${
                                        editManagerValues.includes(m.name) ? "bg-violet-50 text-violet-700 border-violet-300" : "bg-white text-gray-400 border-border"
                                      }`}>
                                        <input type="checkbox" className="hidden" checked={editManagerValues.includes(m.name)}
                                          onChange={(e) => setEditManagerValues(e.target.checked ? [...editManagerValues, m.name] : editManagerValues.filter((n) => n !== m.name))} />
                                        {m.name}
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <button onClick={() => updateSupervisor(sup.name)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-1.5 rounded-lg transition">
                                    Save
                                  </button>
                                  <button onClick={() => setEditingItem(null)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg transition">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm font-bold text-gray-900">{sup.name}</p>
                                {sup.department && <p className="text-xs text-emerald-500 font-medium">{sup.department}</p>}
                                {sup.manager_names.length > 0 && <p className="text-xs text-gray-400">Reports to: <span className="font-semibold text-violet-600">{sup.manager_names.join(", ")}</span></p>}
                                {sup.phone && <p className="text-xs text-gray-400">Phone: {sup.phone}</p>}
                              </>
                            )}
                            <p className="text-xs text-gray-400">{supTasks.length} task{supTasks.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        {hasFullAccess && editingItem !== `sup-${sup.name}` && (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setEditingItem(`sup-${sup.name}`); setEditNameValue(sup.name); setEditDeptValue(sup.department || ""); setEditPhoneValue(sup.phone || ""); setEditManagerValues(sup.manager_names); }}
                              className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                              <Pencil className="w-3 h-3" /> Edit</button>
                            <button onClick={() => removeSupervisor(sup.name)}
                              className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                              <Trash2 className="w-3 h-3" /> Remove</button>
                          </div>
                        )}
                      </div>
                      {hasFullAccess && <PinSection id={`sup-${sup.name}`} pin={sup.pin} onUpdate={() => updateSupervisorPin(sup.name)} />}
                      {supTasks.length > 0 && (
                        <div className="space-y-2 bg-surface-secondary rounded-xl p-3 mt-3">
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
                      )}
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
          </>
        )}

        {/* ==================== EMPLOYEES TAB ==================== */}
        {tab === "employees" && (
          <>
            {hasFullAccess && (
              <div className="bg-white rounded-2xl border border-border p-5">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Add New Employee</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                    placeholder="Employee name *" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value)}
                    placeholder="PIN (for login)" maxLength={6} inputMode="numeric"
                    className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <select value={newSupervisor} onChange={(e) => setNewSupervisor(e.target.value)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                    <option value="">Reports to (optional)</option>
                    {managers.length > 0 && <optgroup label="Managers">
                      {managers.map((m) => <option key={`mgr-${m.name}`} value={m.name}>{m.name}</option>)}
                    </optgroup>}
                    {supervisors.length > 0 && <optgroup label="Supervisors">
                      {supervisors.map((s) => <option key={`sup-${s.name}`} value={s.name}>{s.name}</option>)}
                    </optgroup>}
                  </select>
                  <input type="text" value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder="Designation (optional)" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="Phone (optional)" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                  <input type="text" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}
                    placeholder="Department (optional)" className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
                <button onClick={addEmployee} className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition">
                  <Plus className="w-4 h-4" /> Add Employee</button>
              </div>
            )}

            {filteredEmployees.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEmployees.map((emp) => {
                  const initials = emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={emp.id} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                      {editingItem === `emp-${emp.id}` ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <input type="text" value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} placeholder="Name *"
                              className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                            <input type="text" value={editDesignationValue} onChange={(e) => setEditDesignationValue(e.target.value)} placeholder="Designation"
                              className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                            <input type="text" value={editPhoneValue} onChange={(e) => setEditPhoneValue(e.target.value)} placeholder="Phone"
                              className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                            <input type="text" value={editDeptValue} onChange={(e) => setEditDeptValue(e.target.value)} placeholder="Department"
                              className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                            <select value={editSupervisorValue} onChange={(e) => setEditSupervisorValue(e.target.value)}
                              className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                              <option value="">No Reporting</option>
                              {managers.length > 0 && <optgroup label="Managers">
                                {managers.map((m) => <option key={`mgr-${m.name}`} value={m.name}>{m.name}</option>)}
                              </optgroup>}
                              {supervisors.length > 0 && <optgroup label="Supervisors">
                                {supervisors.map((s) => <option key={`sup-${s.name}`} value={s.name}>{s.name}</option>)}
                              </optgroup>}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateEmployee(emp.id)} className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition">
                              <Check className="w-3.5 h-3.5" /> Save</button>
                            <button onClick={() => setEditingItem(null)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition">
                              <X className="w-3.5 h-3.5" /> Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                                <p className="text-xs text-gray-400">{emp.designation || "Employee"}</p>
                              </div>
                            </div>
                            {hasFullAccess && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => { setEditingItem(`emp-${emp.id}`); setEditNameValue(emp.name); setEditDesignationValue(emp.designation || ""); setEditPhoneValue(emp.phone || ""); setEditSupervisorValue(emp.supervisor_name || ""); setEditDeptValue(emp.department || ""); }}
                                  className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                                  <Pencil className="w-3 h-3" /> Edit</button>
                                <button onClick={() => removeEmployee(emp.id, emp.name)}
                                  className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                                  <Trash2 className="w-3 h-3" /> Remove</button>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5 mb-3">
                            {emp.supervisor_name && (
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <Users className="w-3.5 h-3.5" />
                                <span>Reports to: <span className="font-semibold text-gray-700">{emp.supervisor_name}</span></span>
                              </div>
                            )}
                            {emp.department && <div className="text-xs text-gray-500">Dept: <span className="font-semibold text-gray-700">{emp.department}</span></div>}
                            {emp.phone && <div className="text-xs text-gray-500">Phone: {emp.phone}</div>}
                          </div>
                          {hasFullAccess && <PinSection id={`emp-${emp.id}`} pin={emp.pin} onUpdate={() => updateEmployeePin(emp.id)} />}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-border p-16 text-center">
                <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No employees yet</p>
              </div>
            )}
          </>
        )}
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
