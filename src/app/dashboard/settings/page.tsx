"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { Lock, Download, Upload } from "lucide-react";
import ManagerOnly from "@/components/ManagerOnly";
import { checkPinUsed } from "@/lib/pinUtils";

export default function SettingsPage() {
  const { toast } = useToast();
  const { isManager, login, refreshPin } = useAuth();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [connection, setConnection] = useState<"live" | "offline" | "connecting">("connecting");

  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const { error } = await supabase.from("settings").select("value").eq("key", "admin_pin").single();
        setConnection(error ? "offline" : "live");
      } catch { setConnection("offline"); }
    };
    check();
  }, []);

  const handleChangePin = async () => {
    setPinMsg(null);
    if (!curPin || !newPin || !confirmPin) { setPinMsg({ text: "All fields required", error: true }); return; }
    if (!(await login(curPin))) { setPinMsg({ text: "Current PIN incorrect", error: true }); return; }
    if (newPin.length < 4) { setPinMsg({ text: "PIN must be at least 4 digits", error: true }); return; }
    if (newPin !== confirmPin) { setPinMsg({ text: "PINs do not match", error: true }); return; }
    const usedBy = await checkPinUsed(newPin, "manager");
    if (usedBy) { setPinMsg({ text: `PIN already used by ${usedBy}`, error: true }); return; }
    const { error } = await supabase.from("settings").update({ value: newPin }).eq("key", "admin_pin");
    if (error) setPinMsg({ text: "Save failed", error: true });
    else { await refreshPin(); setCurPin(""); setNewPin(""); setConfirmPin(""); setPinMsg({ text: "PIN changed!", error: false }); }
  };

  const handleExport = async () => {
    const [tr, sr] = await Promise.all([supabase.from("tasks").select("*"), supabase.from("supervisors").select("*")]);
    const blob = new Blob([JSON.stringify({ tasks: tr.data, supervisors: (sr.data || []).map((s: { name: string }) => s.name), exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `workflow-backup-${new Date().toISOString().split("T")[0]}.json`; a.click();
  };

  return (
    <ManagerOnly>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-400">Manage your workspace</p>
        </div>

        {isManager && (
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Lock className="w-4 h-4 text-amber-600" /></div>
              <div><h3 className="text-sm font-bold text-gray-900">Change Manager PIN</h3><p className="text-xs text-gray-400">Update access PIN</p></div>
            </div>
            <div className="space-y-3">
              <div><label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Current PIN</label>
                <input type="password" value={curPin} onChange={(e) => setCurPin(e.target.value)} maxLength={6} inputMode="numeric"
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm text-center tracking-[8px] font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">New PIN</label>
                  <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} maxLength={6} inputMode="numeric"
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm text-center tracking-[8px] font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" /></div>
                <div><label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Confirm PIN</label>
                  <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} maxLength={6} inputMode="numeric"
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm text-center tracking-[8px] font-bold focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" /></div>
              </div>
              {pinMsg && <p className={`text-xs font-semibold ${pinMsg.error ? "text-red-500" : "text-emerald-500"}`}>{pinMsg.text}</p>}
              <button onClick={handleChangePin} className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition">Update PIN</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Data Management</h3>
          <div className="flex gap-3">
            <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              <Download className="w-4 h-4" /> Export Data</button>
            <label className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer">
              <Upload className="w-4 h-4" /> Import Data
              <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try { const d = JSON.parse(await file.text());
                  if (!d.tasks) { alert("Invalid"); return; } if (!confirm(`Import ${d.tasks.length} tasks?`)) return;
                  if (d.supervisors) { for (const n of d.supervisors) await supabase.from("supervisors").upsert({ name: n }, { onConflict: "name" }); }
                  for (const t of d.tasks) { const { id, created_at, updated_at, ...rest } = t; await supabase.from("tasks").insert(rest); }
                  alert("Imported! Refresh to see."); } catch { alert("Failed."); }
                e.target.value = "";
              }} /></label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-2">About</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <p><span className="font-semibold text-gray-700">App:</span> WorkFlow Tracker v1.0</p>
            <p><span className="font-semibold text-gray-700">Stack:</span> Next.js + Supabase + Tailwind CSS</p>
            <p><span className="font-semibold text-gray-700">Auto-sync:</span> Every 30 seconds</p>
          </div>
        </div>
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome, Manager!", "success"); } return ok; }} />
    </div>
    </ManagerOnly>
  );
}
