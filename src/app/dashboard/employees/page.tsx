"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { Plus, Trash2, Users, Key, Eye, EyeOff, Search, Pencil, Check, X } from "lucide-react";
import LoginRequired from "@/components/LoginRequired";
import { checkPinUsed } from "@/lib/pinUtils";

export default function EmployeesPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, userName, login } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Add form
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newSupervisor, setNewSupervisor] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDepartment, setNewDepartment] = useState("");

  // Edit PIN
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editPinValue, setEditPinValue] = useState("");
  const [showPin, setShowPin] = useState<string | null>(null);

  // Edit employee details
  const [editingEmp, setEditingEmp] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState("");
  const [editEmpDesignation, setEditEmpDesignation] = useState("");
  const [editEmpPhone, setEditEmpPhone] = useState("");
  const [editEmpSupervisor, setEditEmpSupervisor] = useState("");
  const [editEmpDepartment, setEditEmpDepartment] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [er, sr] = await Promise.all([
        supabase.from("employees").select("*").order("name"),
        supabase.from("supervisors").select("name").order("name"),
      ]);
      if (er.error) throw er.error;
      setEmployees(er.data || []);
      setSupervisors((sr.data || []).map((s: { name: string }) => s.name));
    } catch {
      // offline
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filter: supervisors see only their team
  const filtered = employees.filter((e) => {
    if (isSupervisor && !hasFullAccess) {
      if (e.supervisor_name !== userName) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q) ||
        (e.supervisor_name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const addEmployee = async () => {
    const name = newName.trim();
    if (!name) { toast("Name is required", "error"); return; }
    const sup = isSupervisor ? userName : newSupervisor;
    const pin = newPin.trim() || null;
    if (pin) {
      const usedBy = await checkPinUsed(pin);
      if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; }
    }
    const { data, error } = await supabase.from("employees").insert({
      name,
      pin,
      supervisor_name: sup || null,
      designation: newDesignation.trim() || null,
      phone: newPhone.trim() || null,
      department: newDepartment.trim() || null,
    }).select().single();
    if (!error && data) {
      setEmployees((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setNewPin(""); setNewSupervisor(""); setNewDesignation(""); setNewPhone(""); setNewDepartment("");
      toast("Employee added", "success");
    } else {
      toast("Failed to add employee", "error");
    }
  };

  const removeEmployee = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}"?`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (!error) {
      setEmployees((p) => p.filter((e) => e.id !== id));
      toast("Employee removed", "success");
    }
  };

  const updatePin = async (id: string) => {
    const pin = editPinValue.trim() || null;
    if (pin) {
      const emp = employees.find((e) => e.id === id);
      const usedBy = await checkPinUsed(pin, "employee", emp?.name);
      if (usedBy) { toast(`PIN already used by ${usedBy}`, "error"); return; }
    }
    const { error } = await supabase.from("employees").update({ pin }).eq("id", id);
    if (!error) {
      setEmployees((p) => p.map((e) => e.id === id ? { ...e, pin } : e));
      setEditingPin(null); setEditPinValue("");
      toast("PIN updated", "success");
    } else toast("Failed to update PIN", "error");
  };

  const startEditEmp = (emp: Employee) => {
    setEditingEmp(emp.id);
    setEditEmpName(emp.name);
    setEditEmpDesignation(emp.designation || "");
    setEditEmpPhone(emp.phone || "");
    setEditEmpSupervisor(emp.supervisor_name || "");
    setEditEmpDepartment(emp.department || "");
  };

  const updateEmployee = async (id: string) => {
    const name = editEmpName.trim();
    if (!name) { toast("Name is required", "error"); return; }
    const updates = {
      name,
      designation: editEmpDesignation.trim() || null,
      phone: editEmpPhone.trim() || null,
      supervisor_name: editEmpSupervisor || null,
      department: editEmpDepartment.trim() || null,
    };
    const { error } = await supabase.from("employees").update(updates).eq("id", id);
    if (!error) {
      setEmployees((p) => p.map((e) => e.id === id ? { ...e, ...updates } : e).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingEmp(null);
      toast("Employee updated", "success");
    } else toast("Failed to update", "error");
  };

  const canManage = hasFullAccess || isSupervisor;

  return (
    <LoginRequired>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Employees</h1>
            <p className="text-sm text-gray-400">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}{isSupervisor && !hasFullAccess ? " in your team" : ""}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employees..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
        </div>

        {/* Add Employee Form */}
        {canManage && (
          <div className="bg-white rounded-2xl border border-border p-5">
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-3">Add New Employee</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Employee name *"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              <input type="text" value={newPin} onChange={(e) => setNewPin(e.target.value)}
                placeholder="PIN (for login)" maxLength={6} inputMode="numeric"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              {hasFullAccess && (
                <select value={newSupervisor} onChange={(e) => setNewSupervisor(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                  <option value="">Select Supervisor</option>
                  {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <input type="text" value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)}
                placeholder="Designation (optional)"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              <input type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              <input type="text" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)}
                placeholder="Department (optional)"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
            </div>
            <button onClick={addEmployee}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition">
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          </div>
        )}

        {/* Employee List */}
        {filtered.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((emp) => {
              const initials = emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <div key={emp.id} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                  {editingEmp === emp.id ? (
                    /* Edit Mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input type="text" value={editEmpName} onChange={(e) => setEditEmpName(e.target.value)}
                          placeholder="Name *"
                          className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        <input type="text" value={editEmpDesignation} onChange={(e) => setEditEmpDesignation(e.target.value)}
                          placeholder="Designation"
                          className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        <input type="text" value={editEmpPhone} onChange={(e) => setEditEmpPhone(e.target.value)}
                          placeholder="Phone"
                          className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        <input type="text" value={editEmpDepartment} onChange={(e) => setEditEmpDepartment(e.target.value)}
                          placeholder="Department"
                          className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                        {hasFullAccess && (
                          <select value={editEmpSupervisor} onChange={(e) => setEditEmpSupervisor(e.target.value)}
                            className="px-3 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                            <option value="">No Supervisor</option>
                            {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateEmployee(emp.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition">
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button onClick={() => setEditingEmp(null)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View Mode */
                    <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold">{initials}</div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.designation || "Employee"}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => startEditEmp(emp)}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button onClick={() => removeEmployee(emp.id, emp.name)}
                          className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="space-y-1.5 mb-3">
                    {emp.supervisor_name && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>Team: <span className="font-semibold text-gray-700">{emp.supervisor_name}</span></span>
                      </div>
                    )}
                    {emp.department && (
                      <div className="text-xs text-gray-500">Dept: <span className="font-semibold text-gray-700">{emp.department}</span></div>
                    )}
                    {emp.phone && (
                      <div className="text-xs text-gray-500">Phone: {emp.phone}</div>
                    )}
                  </div>

                  {/* PIN section */}
                  {canManage && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-border-light">
                      {editingPin === emp.id ? (
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <input type="text" value={editPinValue} onChange={(e) => setEditPinValue(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && updatePin(emp.id)}
                            placeholder="Enter PIN" maxLength={6} inputMode="numeric" autoFocus
                            className="flex-1 px-2 py-1 rounded-lg border border-border text-xs text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500/20" />
                          <button onClick={() => updatePin(emp.id)} className="text-[10px] font-bold text-primary-600 hover:text-primary-700">Save</button>
                          <button onClick={() => { setEditingPin(null); setEditPinValue(""); }} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-[11px] text-gray-500">PIN:</span>
                          {emp.pin ? (
                            <>
                              <span className="text-[11px] font-bold text-gray-700 tracking-widest">
                                {showPin === emp.id ? emp.pin : "••••"}
                              </span>
                              <button onClick={() => setShowPin(showPin === emp.id ? null : emp.id)} className="text-gray-400 hover:text-gray-600">
                                {showPin === emp.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Not set</span>
                          )}
                          <button onClick={() => { setEditingPin(emp.id); setEditPinValue(emp.pin || ""); }}
                            className="text-[10px] font-bold text-primary-600 hover:text-primary-700 ml-auto">
                            {emp.pin ? "Change" : "Set PIN"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
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
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
    </LoginRequired>
  );
}
