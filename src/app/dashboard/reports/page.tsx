"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import type { Task, Comment } from "@/lib/types";
import Topbar from "@/components/Topbar";
import PinModal from "@/components/PinModal";
import { useToast } from "@/components/ui/Toast";
import {
  FileText, FileSpreadsheet, RefreshCw, TrendingUp,
  CheckCircle2, Clock, AlertCircle, BarChart2, PauseCircle, User,
} from "lucide-react";

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
  if (task.status === "Done" || task.status === "Cancelled" || task.status === "On Hold" || task.status === "Delayed") return false;
  if (!task.due_date) return false;
  return task.due_date < new Date().toLocaleDateString("en-CA");
}

function getDisplayStatus(task: Task): string {
  return isOverdue(task) ? "Overdue" : task.status;
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

const STATUS_SORT: Record<string, number> = {
  Done: 0, "In Progress": 1, "On Hold": 2, Delayed: 3, Overdue: 4, Pending: 5, Cancelled: 6,
};

const STATUS_BADGE: Record<string, string> = {
  Done: "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Pending: "bg-gray-100 text-gray-600",
  Delayed: "bg-orange-100 text-orange-700",
  "On Hold": "bg-yellow-100 text-yellow-700",
  Cancelled: "bg-gray-100 text-gray-400",
  Overdue: "bg-red-200 text-red-800",
};

const STATUS_LEFT_BORDER: Record<string, string> = {
  Done: "border-l-4 border-l-emerald-400",
  "In Progress": "border-l-4 border-l-blue-400",
  Pending: "border-l-4 border-l-gray-300",
  Delayed: "border-l-4 border-l-orange-400",
  "On Hold": "border-l-4 border-l-yellow-400",
  Cancelled: "border-l-4 border-l-gray-200",
  Overdue: "border-l-4 border-l-red-500",
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
  const [commentsByTask, setCommentsByTask] = useState<Record<string, Comment[]>>({});
  const [allEmployees, setAllEmployees] = useState<{ name: string; supervisor_name: string | null }[]>([]);
  const [allSupervisors, setAllSupervisors] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [reportData, setReportData] = useState<Task[] | null>(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      setFetching(true);
      const [{ data: taskData }, { data: commentData }, { data: empData }, { data: supData }] = await Promise.all([
        supabase.from("tasks").select("*").order("due_date", { ascending: true }),
        supabase.from("comments").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("name, supervisor_name").order("name"),
        supabase.from("supervisors").select("name").order("name"),
      ]);
      setTasks(taskData || []);
      setAllEmployees((empData || []) as { name: string; supervisor_name: string | null }[]);
      setAllSupervisors(((supData || []) as { name: string }[]).map(s => s.name));
      const grouped: Record<string, Comment[]> = {};
      for (const c of (commentData || []) as Comment[]) {
        if (!grouped[c.task_id]) grouped[c.task_id] = [];
        grouped[c.task_id].push(c);
      }
      setCommentsByTask(grouped);
      setFetching(false);
    };
    fetchData();
  }, []);

  const getDateRange = (): { from: string; to: string } => {
    const today = new Date().toLocaleDateString("en-CA");
    if (reportType === "daily") return { from: today, to: today };
    if (reportType === "weekly") {
      const monday = getMonday(new Date());
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { from: monday.toLocaleDateString("en-CA"), to: sunday.toLocaleDateString("en-CA") };
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

  const getTaskNotes = (t: Task): string => {
    const latestComment = commentsByTask[t.id]?.[0]?.message || "";
    const parts: string[] = [];
    if (t.follow_up) parts.push(t.follow_up);
    if (latestComment && latestComment !== t.follow_up) parts.push(latestComment);
    return parts.join(" | ");
  };

  // Group tasks by assignee — expand extra_assignees so each person gets their tasks
  const groupedReport = (() => {
    if (!reportData) return [];
    const map: Record<string, { tasks: Task[]; supervisor: string }> = {};

    for (const t of reportData) {
      const assignees: string[] = [];
      if (t.assigned_to) assignees.push(t.assigned_to);
      if (t.extra_assignees?.length) assignees.push(...t.extra_assignees);
      if (assignees.length === 0) assignees.push(t.supervisor);
      for (const name of assignees) {
        if (!map[name]) map[name] = { tasks: [], supervisor: t.supervisor };
        map[name].tasks.push(t);
      }
    }

    // Include employees/supervisors with zero tasks in this period
    const relevantPeople: string[] = hasFullAccess
      ? [...allEmployees.map(e => e.name), ...allSupervisors]
      : isSupervisor
        ? allEmployees
            .filter(e => (e.supervisor_name || "").split(",").map(s => s.trim()).includes(userName!))
            .map(e => e.name)
        : [];

    for (const person of relevantPeople) {
      if (!map[person]) {
        const empRecord = allEmployees.find(e => e.name === person);
        const supName = empRecord?.supervisor_name?.split(",")[0]?.trim() || (isSupervisor ? userName! : "");
        map[person] = { tasks: [], supervisor: supName };
      }
    }

    return Object.entries(map)
      .map(([name, { tasks, supervisor }]) => ({
        name,
        supervisor,
        tasks: [...tasks].sort((a, b) => {
          const sa = STATUS_SORT[getDisplayStatus(a)] ?? 9;
          const sb = STATUS_SORT[getDisplayStatus(b)] ?? 9;
          return sa - sb;
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const summary = reportData
    ? {
        total: reportData.length,
        completed: reportData.filter((t) => t.status === "Done").length,
        inProgress: reportData.filter((t) => t.status === "In Progress").length,
        onHold: reportData.filter((t) => t.status === "On Hold").length,
        overdue: reportData.filter((t) => isOverdue(t)).length,
        rate: reportData.length > 0
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

  const excelNotes = (t: Task): string => {
    const raw = getTaskNotes(t);
    if (!raw) return "-";
    const cleaned = raw.replace(/\[Status\s*.+?\]\s*/gi, "").trim();
    return cleaned || "-";
  };

  const downloadExcel = async () => {
    if (!reportData) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "Workflow Tracker";
    const ws = wb.addWorksheet("Report", { views: [{ state: "frozen", ySplit: 5 }] });

    // ── Fixed column widths — tight but readable ──
    ws.columns = [
      { key: "no",         width: 4  },
      { key: "assignee",   width: 16 },
      { key: "supervisor", width: 16 },
      { key: "task",       width: 36 },
      { key: "status",     width: 13 },
      { key: "notes",      width: 28 },
      { key: "due",        width: 13 },
      { key: "priority",   width: 9  },
      { key: "done",       width: 8  },
    ];

    // ── Row 1: Report title ──
    const { from, to } = getDateRange();
    const titleRow = ws.addRow([getFileName().replace(/_/g, " ")]);
    ws.mergeCells(`A1:I1`);
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: "FF1E1E2E" } };
    titleRow.height = 22;

    // ── Row 2: Period ──
    const periodRow = ws.addRow([`Period: ${formatDate(from)} - ${formatDate(to)}   |   Generated: ${formatDate(new Date().toLocaleDateString("en-CA"))}`]);
    ws.mergeCells("A2:I2");
    periodRow.getCell(1).font = { size: 9, color: { argb: "FF888888" } };
    periodRow.height = 16;

    // ── Row 3: Summary ──
    if (summary) {
      const sumRow = ws.addRow([
        `Total: ${summary.total}    Done: ${summary.completed}    In Progress: ${summary.inProgress}    On Hold: ${summary.onHold}    Overdue: ${summary.overdue}    Rate: ${summary.rate}%`,
      ]);
      ws.mergeCells("A3:I3");
      sumRow.getCell(1).font = { size: 9, bold: true, color: { argb: "FF3B3B5C" } };
      sumRow.height = 16;
    } else {
      ws.addRow([]);
    }

    // ── Row 4: blank spacer ──
    ws.addRow([]);

    // ── Row 5: Column headers ──
    const HEADER_COLS = ["#", "Assignee", "Supervisor", "Task", "Status", "Notes / Reason", "Due Date", "Priority", "Done %"];
    const headerRow = ws.addRow(HEADER_COLS);
    headerRow.height = 20;
    const HEADER_FILLS: Record<number, string> = {
      1: "FF4F46E5",   // # — indigo
      2: "FF4F46E5",   // Assignee — indigo
      3: "FF6D67F0",   // Supervisor — lighter indigo
      4: "FF4F46E5",   // Task — indigo
      5: "FF4F46E5",   // Status — indigo
      6: "FF6D67F0",   // Notes — lighter indigo
      7: "FF6D67F0",   // Due Date
      8: "FF6D67F0",   // Priority
      9: "FF4F46E5",   // Done %
    };
    headerRow.eachCell((cell, colNum) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILLS[colNum] || "FF4F46E5" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE0E0E0" } },
        bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
        left: { style: "thin", color: { argb: "FFE0E0E0" } },
        right: { style: "thin", color: { argb: "FFE0E0E0" } },
      };
    });

    // ── Status colours (cell fill) ──
    const STATUS_FILL: Record<string, string> = {
      Done:         "FFD1FAE5",
      "In Progress":"FFDBEAFE",
      "On Hold":    "FFFEF9C3",
      Delayed:      "FFFFE4B5",
      Overdue:      "FFFECACA",
      Pending:      "FFF3F4F6",
      Cancelled:    "FFE5E7EB",
    };
    const STATUS_FONT: Record<string, string> = {
      Done:         "FF065F46",
      "In Progress":"FF1E40AF",
      "On Hold":    "FF854D0E",
      Delayed:      "FF9A3412",
      Overdue:      "FF991B1B",
      Pending:      "FF374151",
      Cancelled:    "FF6B7280",
    };
    const PRIORITY_FONT: Record<string, string> = {
      High:   "FF991B1B",
      Medium: "FF92400E",
      Low:    "FF14532D",
    };

    const borderThin = (argb = "FFD1D5DB") => ({ style: "thin" as const, color: { argb } });
    const cellBorder = {
      top: borderThin(), bottom: borderThin(), left: borderThin(), right: borderThin(),
    };

    let dataRowNum = 5; // header is row 5 (1-indexed in excel)

    for (const group of groupedReport) {
      // ── Employee header row ──
      dataRowNum++;
      const empRow = ws.addRow([
        "",
        group.name,
        `Supervisor: ${group.supervisor}`,
        "",
        `${group.tasks.filter(t => t.status === "Done").length}/${group.tasks.length} Done`,
        "",
        "",
        "",
        "",
      ]);
      ws.mergeCells(`B${dataRowNum}:B${dataRowNum}`);
      ws.mergeCells(`C${dataRowNum}:D${dataRowNum}`);
      ws.mergeCells(`E${dataRowNum}:I${dataRowNum}`);
      empRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBECFF" } };
        cell.font = { bold: true, size: 9, color: { argb: "FF3730A3" } };
        cell.alignment = { vertical: "middle" };
        cell.border = cellBorder;
      });

      // ── Task rows ──
      const groupStartRow = dataRowNum + 1;

      if (group.tasks.length === 0) {
        dataRowNum++;
        const emptyRow = ws.addRow(["", group.name, "", "No tasks in this period", "", "", "", "", ""]);
        ws.mergeCells(`C${dataRowNum}:I${dataRowNum}`);
        emptyRow.eachCell((cell, colNum) => {
          cell.font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } };
          cell.border = cellBorder;
          if (colNum === 2) cell.font = { bold: true, size: 9, color: { argb: "FF374151" } };
        });
      }

      group.tasks.forEach((t, idx) => {
        dataRowNum++;
        const ds = getDisplayStatus(t);
        const pct = getCompletionPct(t.status);
        const notes = excelNotes(t);

        const taskRow = ws.addRow([
          idx + 1,
          group.name,       // will be merged vertically after all tasks added
          group.supervisor,
          t.task,
          ds,
          notes,
          formatDate(t.due_date),
          t.priority,
          `${pct}%`,
        ]);
        taskRow.eachCell((cell, colNum) => {
          cell.alignment = { vertical: "middle", wrapText: true };
          cell.border = cellBorder;
          cell.font = { size: 9 };

          // Assignee col — center, grey
          if (colNum === 2) {
            cell.font = { bold: true, size: 9, color: { argb: "FF374151" } };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
          }
          // Status col — coloured fill & font
          if (colNum === 5) {
            const fill = STATUS_FILL[ds] || "FFF9FAFB";
            const color = STATUS_FONT[ds] || "FF374151";
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
            cell.font = { bold: true, size: 8.5, color: { argb: color } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
          // Priority col — coloured font
          if (colNum === 8) {
            cell.font = { bold: true, size: 9, color: { argb: PRIORITY_FONT[t.priority] || "FF374151" } };
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
          // Done% col — center
          if (colNum === 9) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { bold: true, size: 9, color: { argb: pct === 100 ? "FF065F46" : pct >= 50 ? "FF1E40AF" : "FF92400E" } };
          }
          // # col — center
          if (colNum === 1) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.font = { size: 8.5, color: { argb: "FF9CA3AF" } };
          }
        });
      });

      const groupEndRow = dataRowNum;

      // ── Merge Assignee column vertically for this group ──
      if (groupEndRow >= groupStartRow) {
        ws.mergeCells(`B${groupStartRow}:B${groupEndRow}`);
        const mergedCell = ws.getCell(`B${groupStartRow}`);
        mergedCell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
        mergedCell.font = { bold: true, size: 9, color: { argb: "FF374151" } };
      }

      // ── Blank spacer row between employee groups ──
      dataRowNum++;
      ws.addRow([]);
    }

    // ── Write & download ──
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${getFileName()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Excel downloaded", "success");
  };

  // Strip "[Status → X]" prefix — keeps only the plain reason text, avoids Unicode encoding bugs in jsPDF
  const pdfNotes = (t: Task): string => {
    const raw = getTaskNotes(t);
    if (!raw) return "-";
    const cleaned = raw.replace(/\[Status\s*.+?\]\s*/gi, "").trim();
    return cleaned || "-";
  };

  // Replace non-Latin-1 characters so jsPDF doesn't switch to monospace
  const safe = (str: string) =>
    str.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x00-\xFF]/g, "");

  const downloadPDF = async () => {
    if (!reportData) return;
    setPdfLoading(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const { from, to } = getDateRange();
      const pageW = doc.internal.pageSize.getWidth();

      // Title block
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(30, 30, 30);
      doc.text(safe(getFileName().replace(/_/g, " ")), 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(
        `Period: ${formatDate(from)} - ${formatDate(to)}   |   Generated: ${formatDate(new Date().toLocaleDateString("en-CA"))}`,
        14, 22,
      );

      if (summary) {
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        doc.text(
          `Total: ${summary.total}   Done: ${summary.completed}   In Progress: ${summary.inProgress}   On Hold: ${summary.onHold}   Overdue: ${summary.overdue}   Rate: ${summary.rate}%`,
          14, 29,
        );
      }

      // ── Pre-bucket groups into pages ──
      // Employees with <3 tasks share a page; ≥3 tasks get their own page.
      // Estimate height: 25mm overhead (header + col-header) + 10mm per task row.
      const PDF_USABLE_H = 175; // mm available per non-title page
      const estH = (g: typeof groupedReport[0]) => g.tasks.length === 0 ? 10 : 25 + g.tasks.length * 10;

      type Bucket = typeof groupedReport;
      const pageBuckets: Bucket[] = [];
      let smallBucket: Bucket = [];
      let smallBucketH = 0;

      for (const group of groupedReport) {
        if (group.tasks.length > 4) {
          if (smallBucket.length > 0) { pageBuckets.push([...smallBucket]); smallBucket = []; smallBucketH = 0; }
          pageBuckets.push([group]);
        } else {
          const h = estH(group);
          if (smallBucketH + h > PDF_USABLE_H && smallBucket.length > 0) {
            pageBuckets.push([...smallBucket]); smallBucket = []; smallBucketH = 0;
          }
          smallBucket.push(group);
          smallBucketH += h;
        }
      }
      if (smallBucket.length > 0) pageBuckets.push([...smallBucket]);

      // ── Render page buckets ──
      const drawGroup = (group: typeof groupedReport[0], startY: number) => {
        const done        = group.tasks.filter((t) => t.status === "Done").length;
        const total       = group.tasks.length;
        const onHoldCount = group.tasks.filter((t) => t.status === "On Hold").length;
        const overdueCount = group.tasks.filter((t) => isOverdue(t)).length;

        // ── Compact employee header (7mm tall) ──
        doc.setFillColor(235, 237, 255);
        doc.rect(14, startY, pageW - 28, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(40, 40, 40);
        doc.text(safe(group.name), 17, startY + 5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(90, 90, 90);
        const detail = total === 0
          ? `Supervisor: ${group.supervisor}  |  No tasks in this period`
          : [
              `Supervisor: ${group.supervisor}`,
              `${done}/${total} Done`,
              onHoldCount  ? `On Hold: ${onHoldCount}`  : "",
              overdueCount ? `Overdue: ${overdueCount}` : "",
            ].filter(Boolean).join("  |  ");
        doc.text(safe(detail), 65, startY + 5);

        // Zero-task employee — just the header bar, no table
        if (total === 0) return startY + 7;

        const tableRows = group.tasks.map((t, i) => [
          i + 1,
          safe(t.task),
          getDisplayStatus(t),
          safe(pdfNotes(t)),
          formatDate(t.due_date),
          t.priority,
          `${getCompletionPct(t.status)}%`,
        ]);

        // Columns: 8+82+22+88+25+18+26 = 269mm (full landscape usable width)
        autoTable(doc, {
          startY: startY + 8,
          showHead: "everyPage",
          head: [["#", "Task", "Status", "Notes / Reason", "Due Date", "Priority", "Done %"]],
          body: tableRows,
          styles: {
            fontSize: 7.5,
            cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 },
            overflow: "linebreak",
            font: "helvetica",
            textColor: [30, 30, 30],
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: [79, 70, 229],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 7,
            font: "helvetica",
            cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
          },
          columnStyles: {
            0: { cellWidth: 8,  halign: "center" },
            1: { cellWidth: 82 },
            2: { cellWidth: 22 },
            3: { cellWidth: 88 },
            4: { cellWidth: 25 },
            5: { cellWidth: 18 },
            6: { cellWidth: 26, halign: "center" },
          },
          didParseCell: (data) => {
            if (data.section === "body") {
              const status = String((data.row.raw as (string | number)[])[2]);
              if      (status === "Done")        data.cell.styles.fillColor = [236, 253, 245];
              else if (status === "In Progress") data.cell.styles.fillColor = [239, 246, 255];
              else if (status === "Overdue")     data.cell.styles.fillColor = [255, 228, 228];
              else if (status === "Delayed")     data.cell.styles.fillColor = [255, 237, 213];
              else if (status === "On Hold")     data.cell.styles.fillColor = [254, 252, 232];
              else if (status === "Cancelled")   data.cell.styles.fillColor = [245, 245, 245];
            }
          },
          alternateRowStyles: { fillColor: false },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            if (data.pageNumber > 1) {
              const y = 8;
              doc.setFillColor(235, 237, 255);
              doc.rect(14, y, pageW - 28, 7, "F");
              doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(40, 40, 40);
              doc.text(safe(group.name) + " (cont.)", 17, y + 5);
              doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(90, 90, 90);
              doc.text(safe(`${done}/${total} Done`), 100, y + 5);
            }
          },
        });

        return (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      };

      let currentY = 34;
      pageBuckets.forEach((bucket, bi) => {
        if (bi > 0) { doc.addPage(); currentY = 14; }
        for (const group of bucket) {
          currentY = drawGroup(group, currentY) + 5; // 5mm gap between groups on shared page
        }
      });

      // Page numbers footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(`Page ${i} of ${pageCount}`, pageW - 22, doc.internal.pageSize.getHeight() - 5);
      }

      doc.save(`${getFileName()}.pdf`);
      toast("PDF downloaded", "success");
    } catch (e) {
      console.error(e);
      toast("PDF generation failed", "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const reportLabel = { daily: "Daily Report", weekly: "Weekly Report", custom: "Custom Range Report" }[reportType];

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar onLoginClick={() => setPinModalOpen(true)} />
      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400">Generate and verify task reports by date range</p>
        </div>

        {/* Report Builder Card */}
        <div className="bg-white rounded-2xl border border-border p-5 space-y-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary-600" />
            Report Settings
          </h2>

          <div className="flex gap-2 flex-wrap">
            {(["daily", "weekly", "custom"] as ReportType[]).map((type) => (
              <button
                key={type}
                onClick={() => { setReportType(type); setReportData(null); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  reportType === type ? "bg-primary-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {type === "daily" ? "Daily" : type === "weekly" ? "Weekly" : "Custom Range"}
              </button>
            ))}
          </div>

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
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <BarChart2 className="w-4 h-4 text-gray-500" />
                <p className="text-xl font-bold text-gray-800">{summary!.total}</p>
                <p className="text-[10px] font-semibold text-gray-500">Total</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-xl font-bold text-emerald-700">{summary!.completed}</p>
                <p className="text-[10px] font-semibold text-emerald-600">Done</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <Clock className="w-4 h-4 text-blue-600" />
                <p className="text-xl font-bold text-blue-700">{summary!.inProgress}</p>
                <p className="text-[10px] font-semibold text-blue-600">In Progress</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <PauseCircle className="w-4 h-4 text-yellow-600" />
                <p className="text-xl font-bold text-yellow-700">{summary!.onHold}</p>
                <p className="text-[10px] font-semibold text-yellow-600">On Hold</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <p className="text-xl font-bold text-red-700">{summary!.overdue}</p>
                <p className="text-[10px] font-semibold text-red-600">Overdue</p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                <p className="text-xl font-bold text-violet-700">{summary!.rate}%</p>
                <p className="text-[10px] font-semibold text-violet-600">Done Rate</p>
              </div>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-gray-700">{reportLabel}</p>
                <p className="text-xs text-gray-400">
                  {(() => { const { from, to } = getDateRange(); return from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`; })()}
                  {" · "}{reportData.length} task{reportData.length !== 1 ? "s" : ""}
                  {" · "}{groupedReport.length} employee{groupedReport.length !== 1 ? "s" : ""}
                </p>

              </div>
              {groupedReport.length > 0 && (
                <div className="ml-auto flex gap-2 flex-wrap">
                  <button
                    onClick={downloadExcel}
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

            {/* Report — grouped by employee */}
            <div ref={tableRef} className="space-y-3">
              {groupedReport.length === 0 ? (
                <div className="bg-white rounded-2xl border border-border p-12 text-center">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm text-gray-400 font-medium">No data found for this period</p>
                  <p className="text-xs text-gray-300 mt-1">Try a different date range</p>
                </div>
              ) : (
                groupedReport.map((group) => {
                  const done = group.tasks.filter((t) => t.status === "Done").length;
                  const total = group.tasks.length;
                  const onHoldCount = group.tasks.filter((t) => t.status === "On Hold").length;
                  const overdueCount = group.tasks.filter((t) => isOverdue(t)).length;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const isEmpty = total === 0;

                  return (
                    <div key={group.name} className="bg-white rounded-xl border border-border overflow-hidden">
                      {/* Employee header — compact single line */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-border">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-primary-600" />
                        </div>
                        <span className="text-xs font-bold text-gray-900">{group.name}</span>
                        {group.supervisor && <span className="text-[10px] text-gray-400">· {group.supervisor}</span>}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {!isEmpty && (
                            <>
                              <div className="w-20 bg-gray-200 rounded-full h-1">
                                <div className={`h-1 rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-yellow-400"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-500">{done}/{total}</span>
                            </>
                          )}
                          {onHoldCount > 0 && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">{onHoldCount} hold</span>}
                          {overdueCount > 0 && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{overdueCount} overdue</span>}
                          {isEmpty && <span className="text-[10px] font-semibold text-gray-400 italic">No tasks</span>}
                        </div>
                      </div>

                      {/* Tasks table — compact rows */}
                      {!isEmpty && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs min-w-[800px]">
                            <thead>
                              <tr className="border-b border-border/50 bg-white">
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-6">#</th>
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Task</th>
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-24">Status</th>
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Notes / Reason</th>
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-24">Due Date</th>
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-16">Priority</th>
                                <th className="text-left px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide w-24">Done %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.tasks.map((t, idx) => {
                                const ds = getDisplayStatus(t);
                                const pct = getCompletionPct(t.status);
                                const notes = getTaskNotes(t);
                                return (
                                  <tr key={t.id + group.name} className={`${STATUS_LEFT_BORDER[ds] || ""} border-b border-border/30 hover:bg-gray-50/50 transition`}>
                                    <td className="px-3 py-2 text-[10px] text-gray-400 align-top">{idx + 1}</td>
                                    <td className="px-3 py-2 align-top max-w-[200px]">
                                      <p className="text-xs text-gray-800 font-medium leading-snug">{t.task}</p>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[ds] || "bg-gray-100 text-gray-600"}`}>{ds}</span>
                                    </td>
                                    <td className="px-3 py-2 align-top max-w-[200px]">
                                      {notes ? <p className="text-[11px] text-gray-500 leading-relaxed">{notes}</p> : <span className="text-[11px] text-gray-300">—</span>}
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <span className={`text-[11px] ${isOverdue(t) ? "text-red-600 font-semibold" : "text-gray-500"}`}>{formatDate(t.due_date)}</span>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <span className={`text-[11px] ${PRIORITY_COLOR[t.priority] || "text-gray-600"}`}>{t.priority}</span>
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                      <div className="flex items-center gap-1.5">
                                        <div className="bg-gray-200 rounded-full h-1 w-14">
                                          <div className={`h-1 rounded-full ${pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : pct > 0 ? "bg-yellow-400" : "bg-gray-300"}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="text-[11px] font-semibold text-gray-600">{pct}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
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
