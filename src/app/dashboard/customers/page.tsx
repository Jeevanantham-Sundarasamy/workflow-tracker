"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Customer } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { Plus, Search, Pencil, Trash2, X, Users } from "lucide-react";

export default function CustomersPage() {
  const { toast } = useToast();
  const { hasFullAccess, login } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", machine_number: "" });
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", machine_number: "" });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, machine_number: c.machine_number || "" });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast("Customer name is required", "error");
      return;
    }
    const payload = { name: form.name.trim(), machine_number: form.machine_number.trim() || null };
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

  const filtered = customers.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.machine_number || "").toLowerCase().includes(q);
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

        <div className="bg-white rounded-2xl border border-border p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or machine number..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-sm text-gray-400">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No customers found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-4 py-3">Customer Name</th>
                  <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide px-4 py-3">Machine Number</th>
                  {hasFullAccess && <th className="w-24 px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{c.machine_number || "—"}</td>
                    {hasFullAccess && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => openEdit(c)}
                            className="w-8 h-8 rounded-lg hover:bg-primary-50 flex items-center justify-center text-gray-400 hover:text-primary-600 transition">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => remove(c.id)}
                            className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
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
