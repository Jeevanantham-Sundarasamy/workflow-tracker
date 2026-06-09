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
  const [form, setForm] = useState({ name: "", machine_number: "", machine_type: "", contact: "", phone: "", gst: "", city: "" });
  const [filterName, setFilterName] = useState("All");
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
    setForm({ name: "", machine_number: "", machine_type: "", contact: "", phone: "", gst: "", city: "" });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, machine_number: c.machine_number || "", machine_type: c.machine_type || "", contact: c.contact || "", phone: c.phone || "", gst: c.gst || "", city: c.city || "" });
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
      contact: form.contact.trim() || null,
      phone: form.phone.trim() || null,
      gst: form.gst.trim() || null,
      city: form.city.trim() || null,
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
            {Object.values(
              filtered.reduce((acc, c) => {
                const key = c.name.toLowerCase().trim();
                if (!acc[key]) acc[key] = { primary: c, ids: [c.id] };
                else acc[key].ids.push(c.id);
                return acc;
              }, {} as Record<string, { primary: Customer; ids: string[] }>)
            ).map(({ primary: c }) => (
              <div key={c.id} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900 truncate">{c.name}</h3>
                    <div className="mt-2 space-y-1">
                      {c.contact && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-14 font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Contact</span>
                          <span className="text-gray-700">{c.contact}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-14 font-semibold text-gray-400 uppercase tracking-wide text-[10px]">Phone</span>
                          <span className="text-gray-700">{c.phone}</span>
                        </div>
                      )}
                      {c.gst && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-14 font-semibold text-gray-400 uppercase tracking-wide text-[10px]">GST</span>
                          <span className="text-gray-700 font-mono">{c.gst}</span>
                        </div>
                      )}
                      {c.city && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-14 font-semibold text-gray-400 uppercase tracking-wide text-[10px]">City</span>
                          <span className="text-gray-700">{c.city}</span>
                        </div>
                      )}
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
              </div>
            ))}
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
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Customer Name <span className="text-red-500">*</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. ABC Corp"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Contact</label>
                <input type="text" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Phone</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="e.g. +91 9999999999"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">GST</label>
                <input type="text" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })}
                  placeholder="e.g. 33AABCC1234D1ZX"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">City</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="e.g. Tiruppur, Tamil Nadu"
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
