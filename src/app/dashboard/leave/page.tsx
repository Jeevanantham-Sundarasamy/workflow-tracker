"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { LeaveRequest } from "@/lib/types";
import { LEAVE_TYPES } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/AuthContext";
import {
  Plus, X, Calendar, CheckCircle2, XCircle, Clock,
  User, FileText, AlertTriangle,
} from "lucide-react";

const statusStyle = {
  Pending: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock },
  Approved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  Rejected: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
};

export default function LeavePage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, login } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [teamEmployees, setTeamEmployees] = useState<string[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [submitting, setSubmitting] = useState(false);
  const [tableError, setTableError] = useState(false);

  const [actionModal, setActionModal] = useState<{ id: string; status: "Approved" | "Rejected" } | null>(null);
  const [actionComment, setActionComment] = useState("");

  const [form, setForm] = useState({
    employee_name: "",
    leave_type: "Casual" as LeaveRequest["leave_type"],
    from_date: "",
    to_date: "",
    reason: "",
  });

  const loadData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          setTableError(true);
        }
        throw error;
      }
      setLeaves(data || []);
      setTableError(false);
    } catch {
      // Keep leaves empty if table not found
    }

    // Load team employees for supervisor
    if (isSupervisor && userName) {
      try {
        const { data } = await supabase
          .from("employees")
          .select("name")
          .eq("supervisor_name", userName);
        setTeamEmployees((data || []).map((e: { name: string }) => e.name));
      } catch { /* ignore */ }
    }
  }, [isSupervisor, userName]);

  useEffect(() => {
    loadData();
    const i = setInterval(loadData, 60000);
    return () => clearInterval(i);
  }, [loadData]);

  // Role-based filtering
  const roleFiltered = leaves.filter((l) => {
    if (hasFullAccess) return true;
    if (isSupervisor) {
      // Supervisor sees their own leave + their team's leave
      return l.employee_name === userName || teamEmployees.includes(l.employee_name);
    }
    if (isEmployee) {
      // Employee sees only their own
      return l.employee_name === userName;
    }
    return true; // guest sees all
  });

  const filtered = filterStatus === "All"
    ? roleFiltered
    : roleFiltered.filter((l) => l.status === filterStatus);

  // This week's leaves (Mon-Sun)
  const getWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return { mon, sun };
  };
  const { mon: weekStart, sun: weekEnd } = getWeekRange();
  const thisWeekLeaves = roleFiltered.filter((l) => {
    const from = new Date(l.from_date);
    const to = new Date(l.to_date);
    return from <= weekEnd && to >= weekStart;
  });

  const stats = {
    total: roleFiltered.length,
    pending: roleFiltered.filter((l) => l.status === "Pending").length,
    approved: roleFiltered.filter((l) => l.status === "Approved").length,
    rejected: roleFiltered.filter((l) => l.status === "Rejected").length,
  };

  // Can this user approve/reject a leave?
  const canApprove = (leave: LeaveRequest) => {
    if (hasFullAccess) return true;
    if (isSupervisor && leave.employee_name !== userName && teamEmployees.includes(leave.employee_name)) return true;
    return false;
  };

  // Can this user delete a leave?
  const canDelete = (leave: LeaveRequest) => {
    if (hasFullAccess) return true;
    return false;
  };

  // Auto-fill employee name for logged in users
  const openApplyModal = () => {
    setForm({
      employee_name: (isEmployee || isSupervisor) && userName ? userName : "",
      leave_type: "Casual",
      from_date: "",
      to_date: "",
      reason: "",
    });
    setModalOpen(true);
  };

  const handleApply = async () => {
    if (!form.employee_name.trim()) {
      toast("Employee name is required", "error");
      return;
    }
    if (!form.from_date || !form.to_date) {
      toast("From date and To date are required", "error");
      return;
    }
    if (form.to_date < form.from_date) {
      toast("To date must be after From date", "error");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from("leave_requests").insert({
      employee_name: form.employee_name.trim(),
      leave_type: form.leave_type,
      from_date: form.from_date,
      to_date: form.to_date,
      reason: form.reason.trim() || null,
      status: "Pending",
    }).select().single();

    setSubmitting(false);

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        toast("Leave table not found. Run the SQL schema first.", "error");
        setTableError(true);
      } else {
        toast(`Failed: ${error.message}`, "error");
      }
      return;
    }

    if (data) {
      setLeaves((p) => [data, ...p]);
    }
    toast("Leave request submitted!", "success");
    setModalOpen(false);
  };

  const openActionModal = (id: string, status: "Approved" | "Rejected") => {
    setActionComment("");
    setActionModal({ id, status });
  };

  const handleAction = async () => {
    if (!actionModal) return;
    const { id, status } = actionModal;
    const approver = userName || "Manager";
    const comment = actionComment.trim() || null;
    const { error } = await supabase
      .from("leave_requests")
      .update({ status, approved_by: approver, approval_comment: comment })
      .eq("id", id);
    if (!error) {
      setLeaves((p) => p.map((l) => (l.id === id ? { ...l, status, approved_by: approver, approval_comment: comment } : l)));
      toast(`Leave ${status.toLowerCase()}`, status === "Approved" ? "success" : "warning");
    } else {
      toast("Action failed", "error");
    }
    setActionModal(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this leave request?")) return;
    const { error } = await supabase.from("leave_requests").delete().eq("id", id);
    if (!error) {
      setLeaves((p) => p.filter((l) => l.id !== id));
      toast("Deleted", "success");
    }
  };

  const getDays = (from: string, to: string) => {
    const diff = new Date(to).getTime() - new Date(from).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  // Can apply leave: supervisors and employees
  const canApplyLeave = isSupervisor || isEmployee || !userName;

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />

      <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
        {tableError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-800">Leave table not found in Supabase</p>
              <p className="text-[11px] text-amber-600 mt-0.5">Run the SQL schema in Supabase SQL Editor.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Leave Planner</h1>
            <p className="text-sm text-gray-400">
              {isEmployee ? "Your leave requests" : isSupervisor ? "Team leave requests" : "All leave requests"}
            </p>
          </div>
          {canApplyLeave && (
            <button onClick={openApplyModal}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm">
              <Plus className="w-4 h-4" /> Apply Leave
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", count: stats.total, color: "text-gray-900", bg: "bg-gray-50" },
            { label: "Pending", count: stats.pending, color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Approved", count: stats.approved, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Rejected", count: stats.rejected, color: "text-red-600", bg: "bg-red-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-border`}>
              <p className="text-[10px] font-bold text-gray-400 uppercase">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* This Week's Leave */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600" />
              This Week&apos;s Leave
            </h2>
            <span className="text-[10px] font-bold text-gray-400 uppercase">
              {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          </div>
          {thisWeekLeaves.length > 0 ? (
            <div className="space-y-2">
              {thisWeekLeaves.map((l) => {
                const st = statusStyle[l.status];
                const StIcon = st.icon;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-border-light">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${st.bg} flex items-center justify-center flex-shrink-0`}>
                        <StIcon className={`w-3.5 h-3.5 ${st.text}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{l.employee_name}</p>
                        <p className="text-[10px] text-gray-400">{l.leave_type} · {l.from_date} → {l.to_date}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${st.bg} ${st.text} ${st.border}`}>
                      {l.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 text-center py-4">No leave this week</p>
          )}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {["All", "Pending", "Approved", "Rejected"].map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`text-xs font-semibold px-4 py-1.5 rounded-full transition ${
                filterStatus === s
                  ? "bg-primary-600 text-white"
                  : "bg-white border border-border text-gray-500 hover:bg-gray-50"
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* Leave List */}
        <div className="space-y-3">
          {filtered.length ? filtered.map((l) => {
            const st = statusStyle[l.status];
            const StIcon = st.icon;
            const showApproval = canApprove(l);
            const showDelete = canDelete(l);
            return (
              <div key={l.id} className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900">{l.employee_name}</h3>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border}`}>
                        {l.leave_type}
                      </span>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full border flex-shrink-0 ${st.bg} ${st.text} ${st.border}`}>
                    <StIcon className="w-3 h-3" /> {l.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {l.from_date} → {l.to_date}
                    <span className="text-primary-600 font-bold">({getDays(l.from_date, l.to_date)} day{getDays(l.from_date, l.to_date) > 1 ? "s" : ""})</span>
                  </span>
                  {l.approved_by && (
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> {l.status} by {l.approved_by}
                    </span>
                  )}
                </div>

                {l.reason && (
                  <div className="text-xs text-gray-400 italic bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-border-light flex items-start gap-2">
                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" /> {l.reason}
                  </div>
                )}

                {l.approval_comment && (
                  <div className={`text-xs italic rounded-xl px-3 py-2 mb-3 border flex items-start gap-2 ${
                    l.status === "Approved" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-red-50 text-red-500 border-red-200"
                  }`}>
                    <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span><span className="font-semibold">Comment:</span> {l.approval_comment}</span>
                  </div>
                )}

                {/* Approve/Reject + Delete */}
                {(showApproval || showDelete) && (
                  <div className="flex gap-2 pt-1 flex-wrap">
                    {showApproval && l.status === "Pending" && (
                      <>
                        <button onClick={() => openActionModal(l.id, "Approved")}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition">
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => openActionModal(l.id, "Rejected")}
                          className="flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {showDelete && (
                      <button onClick={() => handleDelete(l.id)}
                        className="text-[10px] font-semibold text-gray-400 hover:text-red-500 transition ml-auto">
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="bg-white rounded-2xl border border-border p-16 text-center">
              <p className="text-3xl mb-3">🏖️</p>
              <p className="text-sm text-gray-400 font-medium">No leave requests</p>
            </div>
          )}
        </div>
      </div>

      {/* Apply Leave Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-base font-bold text-gray-900">Apply for Leave</h2>
              <button onClick={() => setModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Employee Name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={form.employee_name}
                  onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                  placeholder="Your full name"
                  readOnly={!!(isEmployee && userName)}
                  className={`w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 ${isEmployee && userName ? "bg-gray-50 text-gray-600" : ""}`} />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Leave Type</label>
                <select value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value as LeaveRequest["leave_type"] })}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400">
                  {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    From <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={form.from_date}
                    onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    To <span className="text-red-400">*</span>
                  </label>
                  <input type="date" value={form.to_date}
                    onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Reason</label>
                <input type="text" value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Optional reason..."
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handleApply} disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition disabled:opacity-50">
                  {submitting ? "Submitting..." : "Submit Leave"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve/Reject Comment Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 pb-0">
              <h2 className="text-base font-bold text-gray-900">
                {actionModal.status === "Approved" ? "Approve" : "Reject"} Leave
              </h2>
              <button onClick={() => setActionModal(null)}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Comment <span className="text-gray-300">(optional)</span>
                </label>
                <textarea value={actionComment} onChange={(e) => setActionComment(e.target.value)}
                  placeholder={actionModal.status === "Approved" ? "e.g. Approved, enjoy your leave!" : "e.g. Reason for rejection..."}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setActionModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button onClick={handleAction}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition ${
                    actionModal.status === "Approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600"
                  }`}>
                  {actionModal.status === "Approved" ? "Approve" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => { const ok = await login(pin); if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); } return ok; }} />
    </div>
  );
}
