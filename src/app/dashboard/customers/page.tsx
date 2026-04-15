"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Customer, Task } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { Plus, Search, Pencil, Trash2, X, Users } from "lucide-react";

export default function CustomersPage() {
  const { toast } = useToast();
  const { hasFullAccess, login } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", machine_number: "", machine_type: "" });
  const [filterName, setFilterName] = useState("All");
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [cr, tr] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("id, customer_id, status"),
    ]);
    setCustomers(cr.data || []);
    setTasks((tr.data || []) as Task[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", machine_number: "", machine_type: "" });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, machine_number: c.machine_number || "", machine_type: c.machine_type || "" });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast("Customer name is required", "error");
      return;
    }
    const payload = {
      name: form.name.trim(),
      machine_number: form.machine_number.trim() || null,
      machine_type: form.machine_type.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editing.id);
      if (error) return toast(`Update failed: ${error.message}`, "error");
      toast("Customer updated", "success");
    } else {
      const { error } = await supabase.from("customers").insert(payload);
      if (error) return toast(`Create failed: ${error.message}`, "error");
      toast("Customer added", "success");
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this customer?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast(`Delete failed: ${error.message}`, "error");
    setCustomers((p) => p.filter((c) => c.id !== id));
    toast("Customer deleted", "success");
  };

  const uniqueNames = Array.from(new Set(customers.map((c) => c.name))).sort();

  const filtered = customers.filter((c) => {
    if (filterName !== "All" && c.name !== filterName) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || (c.machine_number || "").toLowerCase().includes(q)
      || (c.machine_type || "").toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />
      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Customers</h1>
            <p className="text-sm text-gray-400">{customers.length} total</p>
          </div>
          {hasFullAccess && (
            <button onClick={openNew}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-border p-3 sm:p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, machine number, or type..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
          </div>
          {uniqueNames.length > 0 && (
            <select value={filterName} onChange={(e) => setFilterName(e.target.value)}
              className="text-sm font-semibold px-3 py-2 rounded-xl border border-border bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
              <option value="All">All Customers</option>
              {uniqueNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {(filterName !== "All" || search) && (
            <button onClick={() => { setFilterName("All"); setSearch(""); }}
              className="text-xs font-bold px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
              Clear
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-border p-16 text-center text-sm text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No customers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => {
              const ct = tasks.filter((t) => t.customer_id === c.id);
              const total = ct.length;
              const counts = {
                pending: ct.filter((t) => t.status === "Pending").length,
                inProgress: ct.filter((t) => t.status === "In Progress").length,
                done: ct.filter((t) => t.status === "Done").length,
                delayed: ct.filter((t) => t.status === "Delayed").length,
                onHold: ct.filter((t) => t.status === "On Hold").length,
                cancelled: ct.filter((t) => t.status === "Cancelled").length,
              };
              const pct = total ? Math.round((counts.done / total) * 100) : 0;
              return (
                <div key={c.id} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{c.name}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
                        {c.machine_number && <span>Machine: <span className="font-semibold text-gray-700">{c.machine_number}</span></span>}
                        {c.machine_type && <span>Type: <span className="font-semibold text-gray-700">{c.machine_type}</span></span>}
                      </div>
                    </div>
                    {hasFullAccess && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => openEdit(c)} title="Edit"
                          className="w-8 h-8 rounded-lg hover:bg-primary-50 flex items-center justify-center text-gray-400 hover:text-primary-600 transition">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(c.id)} title="Delete"
                          className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {total === 0 ? (
                    <p className="text-[11px] text-gray-400 italic bg-gray-50 rounded-lg px-3 py-2">No tasks yet for this machine</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] text-gray-500 font-medium">{total} task{total !== 1 ? "s" : ""}</span>
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{pct}% complete</span>
                      </div>
                      <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 mb-2.5">
                        {counts.pending > 0 && <div className="bg-amber-400" style={{ width: `${(counts.pending / total) * 100}%` }} title={`Pending: ${counts.pending}`} />}
                        {counts.inProgress > 0 && <div className="bg-blue-500" style={{ width: `${(counts.inProgress / total) * 100}%` }} title={`In Progress: ${counts.inProgress}`} />}
                        {counts.done > 0 && <div className="bg-emerald-500" style={{ width: `${(counts.done / total) * 100}%` }} title={`Done: ${counts.done}`} />}
                        {counts.delayed > 0 && <div className="bg-red-400" style={{ width: `${(counts.delayed / total) * 100}%` }} title={`Delayed: ${counts.delayed}`} />}
                        {counts.onHold > 0 && <div className="bg-orange-400" style={{ width: `${(counts.onHold / total) * 100}%` }} title={`On Hold: ${counts.onHold}`} />}
                        {counts.cancelled > 0 && <div className="bg-gray-400" style={{ width: `${(counts.cancelled / total) * 100}%` }} title={`Cancelled: ${counts.cancelled}`} />}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {counts.pending > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-600"><span className="w-2 h-2 rounded-full bg-amber-400" />Pending <b className="text-gray-800">{counts.pending}</b></span>}
                        {counts.inProgress > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-600"><span className="w-2 h-2 rounded-full bg-blue-500" />In Progress <b className="text-gray-800">{counts.inProgress}</b></span>}
                        {counts.done > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />Done <b className="text-gray-800">{counts.done}</b></span>}
                        {counts.delayed > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-600"><span className="w-2 h-2 rounded-full bg-red-400" />Delayed <b className="text-gray-800">{counts.delayed}</b></span>}
                        {counts.onHold > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-600"><span className="w-2 h-2 rounded-full bg-orange-400" />On Hold <b className="text-gray-800">{counts.onHold}</b></span>}
                        {counts.cancelled > 0 && <span className="flex items-center gap-1 text-[11px] text-gray-600"><span className="w-2 h-2 rounded-full bg-gray-400" />Cancelled <b className="text-gray-800">{counts.cancelled}</b></span>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-lg font-bold text-gray-900">{editing ? "Edit Customer" : "Add Customer"}</h2>
              <button onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Customer Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. ABC Corp"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Machine Number</label>
                <input type="text" value={form.machine_number} onChange={(e) => setForm({ ...form, machine_number: e.target.value })}
                  placeholder="e.g. MC-12345"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Machine Type / Number</label>
                <input type="text" value={form.machine_type} onChange={(e) => setForm({ ...form, machine_type: e.target.value })}
                  placeholder="e.g. CNC Lathe / MT-789"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
                <p className="text-[10px] text-gray-400 mt-1">For your reference only — shown in Customers list.</p>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-2">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={save}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition shadow-sm">
                {editing ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
  );
}
