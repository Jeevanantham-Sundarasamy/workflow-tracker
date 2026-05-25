"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Task } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import { FileText, FileSpreadsheet, RefreshCw, TrendingUp, CheckCircle2, Clock, AlertCircle, BarChart2 } from "lucide-react";

type ReportType = "daily" | "weekly" | "custom";

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(task: Task): boolean {
  if (task.status === "Done" || task.status === "Cancelled") return false;
  if (!task.due_date) return false;
  return task.due_date < new Date().toLocaleDateString("en-CA");
}

function getCompletionPct(status: Task["status"]): number {
  switch (status) {
    case "Done": return 100;
    case "In Progress": return 50;
    case "Delayed": return 25;
    case "On Hold": return 10;
    default: return 0;
  }
}

function getDisplayStatus(task: Task): string {
  return isOverdue(task) ? "Overdue" : task.status;
}

const STATUS_BADGE: Record<string, string> = {
  Done: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Pending: "bg-gray-100 text-gray-600",
  Delayed: "bg-red-100 text-red-700",
  "On Hold": "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-gray-100 text-gray-400",
  Overdue: "bg-red-200 text-red-800",
};

const ROW_COLOR: Record<string, string> = {
  Done: "bg-emerald-50/50",
  "In Progress": "bg-blue-50/40",
  Pending: "bg-white",
  Delayed: "bg-red-50/30",
  "On Hold": "bg-yellow-50/40",
  Cancelled: "bg-gray-50",
  Overdue: "bg-red-50/60",
};

const PRIORITY_COLOR: Record<string, string> = {
  High: "text-red-600 font-bold",
  Medium: "text-yellow-600 font-bold",
  Low: "text-green-600 font-bold",
};

export default function ReportsPage() {
  const { toast } = useToast();
  const { hasFullAccess, isSupervisor, isEmployee, userName, login } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [fetching, setFetching] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reportData, setReportData] = useState<Task[] | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      setFetching(true);
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });
      setTasks(data || []);
      setFetching(false);
    };
    fetchTasks();
  }, []);

  const getDateRange = (): { from: string; to: string } => {
    const today = new Date().toLocaleDateString("en-CA");
    if (reportType === "daily") return { from: today, to: today };
    if (reportType === "weekly") {
      const monday = getMonday(new Date());
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: monday.toLocaleDateString("en-CA"),
        to: sunday.toLocaleDateString("en-CA"),
      };
    }
    return { from: customFrom, to: customTo };
  };

  const generateReport = () => {
    if (reportType === "custom" && (!customFrom || !customTo)) {
      toast("Please select both start and end dates.", "error");
      return;
    }
    const { from, to } = getDateRange();

    let filtered = tasks.filter((t) => {
      if (hasFullAccess) return true;
      if (isSupervisor) return t.supervisor === userName || (t.extra_assignees ?? []).includes(userName!);
      if (isEmployee) return t.assigned_to === userName || (t.extra_assignees ?? []).includes(userName!);
      return true;
    });

    filtered = filtered.filter((t) => {
      const due = t.due_date || t.created_at?.slice(0, 10) || "";
      return due >= from && due <= to;
    });

    setReportData(filtered);
  };

  const summary = reportData
    ? {
        total: reportData.length,
        completed: reportData.filter((t) => t.status === "Done").length,
        inProgress: reportData.filter((t) => t.status === "In Progress").length,
        overdue: reportData.filter((t) => isOverdue(t)).length,
        rate:
          reportData.length > 0
            ? Math.round((reportData.filter((t) => t.status === "Done").length / reportData.length) * 100)
            : 0,
      }
    : null;

  const getFileName = () => {
    const { from, to } = getDateRange();
    if (reportType === "daily") return `Daily_Report_${from}`;
    if (reportType === "weekly") return `Weekly_Report_${from}_to_${to}`;
    return `Custom_Report_${from}_to_${to}`;
  };

  const downloadCSV = () => {
    if (!reportData) return;
    const headers = [
      "No.",
      "Assignee",
      "Supervisor",
      "Task",
      "Status",
      "Created Date",
      "Due Date",
      "Priority",
      "Completion %",
      "Notes",
    ];
    const rows = reportData.map((t, i) => [
      i + 1,
      t.assigned_to || t.supervisor,
      t.supervisor,
      t.task,
      getDisplayStatus(t),
      formatDate(t.created_at),
      formatDate(t.due_date),
      t.priority,
      `${getCompletionPct(t.status)}%`,
      t.follow_up || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getFileName()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Excel/CSV downloaded", "success");
  };

  const downloadPDF = async () => {
    if (!reportData) return;
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const title = getFileName().replace(/_/g, " ");
      const { from, to } = getDateRange();

      // Title
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.text(title, 14, 16);

      // Date range sub-title
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Period: ${formatDate(from)} — ${formatDate(to)}   |   Generated: ${formatDate(new Date().toLocaleDateString("en-CA"))}`, 14, 23);

      // Summary bar
      if (summary) {
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);
        const summaryText = `Total: ${summary.total}   Completed: ${summary.completed}   In Progress: ${summary.inProgress}   Overdue: ${summary.overdue}   Completion Rate: ${summary.rate}%`;
        doc.text(summaryText, 14, 30);
      }

      const tableRows = reportData.map((t, i) => [
        i + 1,
        t.assigned_to || t.supervisor,
        t.task.length > 45 ? t.task.slice(0, 45) + "…" : t.task,
        getDisplayStatus(t),
        formatDate(t.created_at),
        formatDate(t.due_date),
        t.priority,
        `${getCompletionPct(t.status)}%`,
        (t.follow_up || "").length > 30 ? (t.follow_up || "").slice(0, 30) + "…" : (t.follow_up || "—"),
      ]);

      autoTable(doc, {
        startY: 35,
        head: [["#", "Assignee", "Task", "Status", "Created", "Due Date", "Priority", "Done %", "Notes"]],
        body: tableRows,
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 28 },
          2: { cellWidth: 60 },
          3: { cellWidth: 22 },
          4: { cellWidth: 24 },
          5: { cellWidth: 24 },
          6: { cellWidth: 18 },
          7: { cellWidth: 16 },
          8: { cellWidth: 50 },
        },
        didParseCell: (data) => {
          if (data.section === "body") {
            const row = data.row.raw as (string | number)[];
            const status = String(row[3]);
            if (status === "Done") data.cell.styles.fillColor = [236, 253, 245];
            else if (status === "In Progress") data.cell.styles.fillColor = [239, 246, 255];
            else if (status === "Overdue" || status === "Delayed") data.cell.styles.fillColor = [254, 226, 226];
            else if (status === "On Hold") data.cell.styles.fillColor = [254, 252, 232];
            else if (status === "Cancelled") data.cell.styles.fillColor = [249, 250, 251];
          }
        },
        alternateRowStyles: { fillColor: false },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 20, doc.internal.pageSize.getHeight() - 5);
      }

      doc.save(`${getFileName()}.pdf`);
      toast("PDF downloaded", "success");
    } catch {
      toast("PDF generation failed", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const reportLabel = {
    daily: "Daily Report",
    weekly: "Weekly Report",
    custom: "Custom Range Report",
  }[reportType];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400">Generate and download task reports by date range</p>
        </div>

        {/* Report Builder Card */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary-600" />
            Report Settings
          </h2>

          {/* Type buttons */}
          <div className="flex gap-2 flex-wrap">
            {(["daily", "weekly", "custom"] as ReportType[]).map((type) => (
              <button
                key={type}
                onClick={() => { setReportType(type); setReportData(null); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  reportType === type
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "daily" ? "Daily Report" : type === "weekly" ? "Weekly Report" : "Custom Range"}
              </button>
            ))}
          </div>

          {/* Custom date range */}
          {reportType === "custom" && (
            <div className="flex items-center gap-4 flex-wrap p-4 bg-gray-50 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => { setCustomFrom(e.target.value); setReportData(null); }}
                  className="text-sm px-3 py-2 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">To</label>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(e) => { setCustomTo(e.target.value); setReportData(null); }}
                  className="text-sm px-3 py-2 rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
              </div>
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={fetching}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
            Generate Report
          </button>
        </div>

        {/* Report Output */}
        {reportData !== null && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col items-center gap-1">
                <BarChart2 className="w-5 h-5 text-gray-500" />
                <p className="text-2xl font-bold text-gray-800">{summary!.total}</p>
                <p className="text-[11px] font-semibold text-gray-500">Total Tasks</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col items-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-2xl font-bold text-emerald-700">{summary!.completed}</p>
                <p className="text-[11px] font-semibold text-emerald-600">Completed</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col items-center gap-1">
                <Clock className="w-5 h-5 text-blue-600" />
                <p className="text-2xl font-bold text-blue-700">{summary!.inProgress}</p>
                <p className="text-[11px] font-semibold text-blue-600">In Progress</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col items-center gap-1">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-2xl font-bold text-red-700">{summary!.overdue}</p>
                <p className="text-[11px] font-semibold text-red-600">Overdue</p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex flex-col items-center gap-1">
                <TrendingUp className="w-5 h-5 text-violet-600" />
                <p className="text-2xl font-bold text-violet-700">{summary!.rate}%</p>
                <p className="text-[11px] font-semibold text-violet-600">Completion Rate</p>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-gray-700">{reportLabel}</p>
                <p className="text-xs text-gray-400">
                  {(() => {
                    const { from, to } = getDateRange();
                    return from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`;
                  })()}
                  {" · "}{reportData.length} task{reportData.length !== 1 ? "s" : ""}
                </p>
              </div>
              {reportData.length > 0 && (
                <div className="ml-auto flex gap-2 flex-wrap">
                  <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold transition"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Download Excel
                  </button>
                  <button
                    onClick={downloadPDF}
                    disabled={pdfLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-semibold transition disabled:opacity-60"
                  >
                    <FileText className="w-4 h-4" />
                    {pdfLoading ? "Generating…" : "Download PDF"}
                  </button>
                </div>
              )}
            </div>

            {/* Report Table */}
            <div ref={tableRef} className="bg-white rounded-2xl border border-border overflow-hidden">
              {reportData.length === 0 ? (
                <div className="p-16 text-center">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm text-gray-400 font-medium">No tasks found for this period</p>
                  <p className="text-xs text-gray-300 mt-1">Try a different date range</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-border">
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-8">#</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Assignee</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Task</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Created</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Due Date</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Priority</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Done %</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((t, idx) => {
                        const ds = getDisplayStatus(t);
                        const pct = getCompletionPct(t.status);
                        const rowBg = ROW_COLOR[ds] || "bg-white";
                        return (
                          <tr key={t.id} className={`${rowBg} border-b border-border/50 hover:brightness-[0.97] transition`}>
                            <td className="px-4 py-3 text-xs text-gray-400 font-medium">{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                              <div>{t.assigned_to || t.supervisor}</div>
                              {t.assigned_to && (
                                <div className="text-[11px] text-gray-400 font-normal">{t.supervisor}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-700 max-w-[220px]">
                              <span className="line-clamp-2 leading-snug">{t.task}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${STATUS_BADGE[ds] || "bg-gray-100 text-gray-600"}`}>
                                {ds}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {formatDate(t.created_at)}
                            </td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              <span className={isOverdue(t) ? "text-red-600 font-semibold" : "text-gray-500"}>
                                {formatDate(t.due_date)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs ${PRIORITY_COLOR[t.priority] || "text-gray-600"}`}>
                                {t.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 min-w-[80px]">
                                <div className="flex-1 bg-gray-200 rounded-full h-1.5 w-14">
                                  <div
                                    className={`h-1.5 rounded-full transition-all ${
                                      pct === 100
                                        ? "bg-emerald-500"
                                        : pct >= 50
                                        ? "bg-blue-500"
                                        : pct > 0
                                        ? "bg-yellow-400"
                                        : "bg-gray-300"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs font-semibold text-gray-600">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">
                              <span className="line-clamp-2">{t.follow_up || "—"}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PinModal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={async (pin) => {
          const ok = await login(pin);
          if (ok) { setPinModalOpen(false); toast("Welcome!", "success"); }
          return ok;
        }}
      />
    </div>
  );
}
