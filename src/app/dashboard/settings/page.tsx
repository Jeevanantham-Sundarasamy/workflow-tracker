"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import { Lock, Upload, FileSpreadsheet, FileJson } from "lucide-react";
import AdminOnly from "@/components/AdminOnly";
import { checkPinUsed } from "@/lib/pinUtils";

export default function SettingsPage() {
  const { toast } = useToast();
  const { isAdmin, login, refreshPin } = useAuth();
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
    const usedBy = await checkPinUsed(newPin, "admin");
    if (usedBy) { setPinMsg({ text: `PIN already used by ${usedBy}`, error: true }); return; }
    const { error } = await supabase.from("settings").update({ value: newPin }).eq("key", "admin_pin");
    if (error) setPinMsg({ text: "Save failed", error: true });
    else { await refreshPin(); setCurPin(""); setNewPin(""); setConfirmPin(""); setPinMsg({ text: "PIN changed!", error: false }); }
  };

  const fetchAllData = async () => {
    const [tasks, managers, supervisors, employees, leaves, settings, notifications, comments, activityLog, attachments, userRoles] = await Promise.all([
      supabase.from("tasks").select("*"),
      supabase.from("managers").select("*"),
      supabase.from("supervisors").select("*"),
      supabase.from("employees").select("*"),
      supabase.from("leave_requests").select("*"),
      supabase.from("settings").select("*"),
      supabase.from("notifications").select("*"),
      supabase.from("comments").select("*"),
      supabase.from("activity_log").select("*"),
      supabase.from("attachments").select("*"),
      supabase.from("user_roles").select("*"),
    ]);
    return {
      tasks: tasks.data || [],
      managers: managers.data || [],
      supervisors: supervisors.data || [],
      employees: employees.data || [],
      leave_requests: leaves.data || [],
      settings: settings.data || [],
      notifications: notifications.data || [],
      comments: comments.data || [],
      activity_log: activityLog.data || [],
      attachments: attachments.data || [],
      user_roles: userRoles.data || [],
      exportedAt: new Date().toISOString(),
    };
  };

  const handleExportJSON = async () => {
    const data = await fetchAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `workflow-backup-${new Date().toISOString().split("T")[0]}.json`; a.click();
    toast("Exported as JSON", "success");
  };

  const handleExportExcel = async () => {
    const data = await fetchAllData();
    const toCsv = (rows: Record<string, unknown>[]) => {
      if (!rows.length) return "";
      const headers = Object.keys(rows[0]);
      const csvRows = [headers.join(",")];
      for (const row of rows) {
        csvRows.push(headers.map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        }).join(","));
      }
      return csvRows.join("\n");
    };

    const sheets: Record<string, Record<string, unknown>[]> = {
      tasks: data.tasks,
      managers: data.managers,
      supervisors: data.supervisors,
      employees: data.employees,
      leave_requests: data.leave_requests,
      settings: data.settings,
      notifications: data.notifications,
      comments: data.comments,
      activity_log: data.activity_log,
      attachments: data.attachments,
      user_roles: data.user_roles,
    };

    // Build a multi-sheet CSV (sections separated by sheet name headers)
    let csvContent = "";
    for (const [name, rows] of Object.entries(sheets)) {
      if (rows.length > 0) {
        csvContent += `--- ${name.toUpperCase()} ---\n${toCsv(rows)}\n\n`;
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `workflow-backup-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    toast("Exported as Excel/CSV", "success");
  };

  return (
    <AdminOnly>
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-400">Manage your workspace</p>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Lock className="w-4 h-4 text-amber-600" /></div>
              <div><h3 className="text-sm font-bold text-gray-900">Change Admin PIN</h3><p className="text-xs text-gray-400">Update access PIN</p></div>
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
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Export all data (tasks, supervisors, employees, leaves, settings, etc.)</p>
            <div className="flex gap-3">
              <button onClick={handleExportJSON} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                <FileJson className="w-4 h-4" /> Export JSON</button>
              <button onClick={handleExportExcel} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel</button>
            </div>
            <label className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer">
              <Upload className="w-4 h-4" /> Import Data
              <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0]; if (!file) return;
                try {
                  const d = JSON.parse(await file.text());
                  const counts: string[] = [];
                  if (d.managers?.length) counts.push(`${d.managers.length} managers`);
                  if (d.supervisors?.length) counts.push(`${d.supervisors.length} supervisors`);
                  if (d.employees?.length) counts.push(`${d.employees.length} employees`);
                  if (d.tasks?.length) counts.push(`${d.tasks.length} tasks`);
                  if (d.leave_requests?.length) counts.push(`${d.leave_requests.length} leave requests`);
                  if (!counts.length) { alert("No data found in file"); return; }
                  if (!confirm(`Import ${counts.join(", ")}?`)) return;

                  const insertRows = async (table: string, rows: Record<string, unknown>[]) => {
                    for (const row of rows) {
                      const { id, created_at, updated_at, ...rest } = row;
                      await supabase.from(table).insert(rest);
                    }
                  };

                  // Import in order (respect foreign keys)
                  if (d.managers?.length) await insertRows("managers", d.managers);
                  if (d.supervisors?.length) await insertRows("supervisors", d.supervisors);
                  if (d.employees?.length) await insertRows("employees", d.employees);
                  if (d.tasks?.length) await insertRows("tasks", d.tasks);
                  if (d.leave_requests?.length) await insertRows("leave_requests", d.leave_requests);
                  if (d.notifications?.length) await insertRows("notifications", d.notifications);
                  if (d.comments?.length) await insertRows("comments", d.comments);
                  if (d.activity_log?.length) await insertRows("activity_log", d.activity_log);
                  if (d.attachments?.length) await insertRows("attachments", d.attachments);

                  alert("Imported successfully! Refresh to see.");
                } catch (err) { alert("Import failed: " + (err instanceof Error ? err.message : "Unknown error")); }
                e.target.value = "";
              }} /></label>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-border p-6">
          <h3 className="text-sm font-bold text-gray-900 mb-2">About</h3>
          <div className="space-y-2 text-xs text-gray-500">
            <p><span className="font-semibold text-gray-700">App:</span> WorkFlow Tracker v1.0</p>
            <p><span className="font-semibold text-gray-700">Built by:</span> Pragadeesh V</p>
            <p><span className="font-semibold text-gray-700">Stack:</span> Next.js + Supabase + Tailwind CSS</p>
            <p><span className="font-semibold text-gray-700">Auto-sync:</span> Every 60 seconds + Realtime</p>
          </div>
        </div>
      </div>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome, Admin!", "success"); } return ok; }} />
    </div>
    </AdminOnly>
  );
}
