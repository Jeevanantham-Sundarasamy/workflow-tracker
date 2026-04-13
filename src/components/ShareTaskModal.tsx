"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share2, MessageCircle, Send, Copy, Download, Image as ImageIcon } from "lucide-react";
import type { Task } from "@/lib/types";
import { toPng } from "html-to-image";

interface ShareTaskModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
}

type Nav = Navigator & {
  canShare?: (data: { files?: File[] }) => boolean;
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
};

export default function ShareTaskModal({ open, task, onClose }: ShareTaskModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  if (!open || !task) return null;

  const text = buildShareText(task);

  const generateFile = async (): Promise<File | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#ffffff" });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], `task-${task.id.slice(0, 8)}.png`, { type: "image/png" });
  };

  const triggerDownload = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Primary action: device share sheet with screenshot attached
  const nativeShare = async () => {
    setBusy(true);
    try {
      const file = await generateFile();
      const nav = navigator as Nav;
      if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Task Assigned", text });
      } else if (nav.share) {
        await nav.share({ title: "Task Assigned", text });
      } else if (file) {
        triggerDownload(file);
        alert("Screenshot downloaded. Attach it in any chat app.");
      }
    } catch (err) {
      console.warn(err);
    }
    setBusy(false);
  };

  // WhatsApp: send screenshot image directly when device supports it,
  // else download PNG and open WhatsApp with task text so user can attach.
  const shareWhatsApp = async () => {
    setBusy(true);
    try {
      const file = await generateFile();
      const nav = navigator as Nav;
      if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Task Assigned", text });
      } else {
        if (file) triggerDownload(file);
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
        if (file) alert("Screenshot downloaded. In WhatsApp, click the attach (📎) button and select the downloaded image.");
      }
    } catch (err) {
      console.warn(err);
    }
    setBusy(false);
  };

  const shareTelegram = async () => {
    setBusy(true);
    try {
      const file = await generateFile();
      const nav = navigator as Nav;
      if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "Task Assigned", text });
      } else {
        if (file) triggerDownload(file);
        const url = `https://t.me/share/url?url=${encodeURIComponent("Task Assigned")}&text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
        if (file) alert("Screenshot downloaded. In Telegram, attach the downloaded image.");
      }
    } catch (err) {
      console.warn(err);
    }
    setBusy(false);
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  };

  const downloadPng = async () => {
    setBusy(true);
    try {
      const file = await generateFile();
      if (file) triggerDownload(file);
    } catch (err) {
      console.warn(err);
    }
    setBusy(false);
  };

  const priorityColor =
    task.priority === "High" ? "#ef4444" : task.priority === "Medium" ? "#f59e0b" : "#10b981";

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary-600" /> Share Task
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Preview card (captured as PNG) */}
          <div
            ref={cardRef}
            style={{
              background: "linear-gradient(135deg,#ffffff 0%,#f8fafc 100%)",
              borderRadius: 16,
              padding: 20,
              border: "1px solid #e5e7eb",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                W
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>WorkFlow</div>
                <div style={{ fontSize: 10, color: "#6b7280" }}>Task Assignment</div>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  background: priorityColor,
                  padding: "4px 10px",
                  borderRadius: 999,
                }}
              >
                {task.priority.toUpperCase()}
              </div>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "12px 0 8px" }}>
              {task.task}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6, fontSize: 13 }}>
              {task.assigned_to && (
                <>
                  <div style={{ color: "#6b7280", fontWeight: 600 }}>Assigned to</div>
                  <div style={{ color: "#111827", fontWeight: 600 }}>{task.assigned_to}</div>
                </>
              )}
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Supervisor</div>
              <div style={{ color: "#111827" }}>{task.supervisor}</div>
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Due Date</div>
              <div style={{ color: "#111827" }}>{formatDate(task.due_date)}</div>
              <div style={{ color: "#6b7280", fontWeight: 600 }}>Status</div>
              <div style={{ color: "#111827" }}>{task.status}</div>
              {task.location && (
                <>
                  <div style={{ color: "#6b7280", fontWeight: 600 }}>Location</div>
                  <div style={{ color: "#111827" }}>{task.location}</div>
                </>
              )}
              {task.follow_up && (
                <>
                  <div style={{ color: "#6b7280", fontWeight: 600 }}>Notes</div>
                  <div style={{ color: "#111827" }}>{task.follow_up}</div>
                </>
              )}
              {task.extra_assignees && task.extra_assignees.length > 0 && (
                <>
                  <div style={{ color: "#6b7280", fontWeight: 600 }}>Also assigned</div>
                  <div style={{ color: "#111827" }}>{task.extra_assignees.join(", ")}</div>
                </>
              )}
            </div>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              disabled={busy}
              onClick={nativeShare}
              className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold transition col-span-2 sm:col-span-3 shadow-sm"
              title="Opens your device share sheet with the screenshot attached"
            >
              <ImageIcon className="w-4 h-4" /> {busy ? "Preparing..." : "Share Screenshot"}
            </button>
            <button
              disabled={busy}
              onClick={shareWhatsApp}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </button>
            <button
              disabled={busy}
              onClick={shareTelegram}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              <Send className="w-4 h-4" /> Telegram
            </button>
            <button
              onClick={copyText}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border text-gray-700 hover:bg-gray-50 text-sm font-semibold transition"
            >
              <Copy className="w-4 h-4" /> Copy Text
            </button>
            <button
              disabled={busy}
              onClick={downloadPng}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition col-span-2 sm:col-span-3"
            >
              <Download className="w-4 h-4" /> Download PNG
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            On phone: &quot;WhatsApp&quot; sends the screenshot directly.
            On desktop: image is downloaded and WhatsApp Web opens — just attach the image.
          </p>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Plain text fallback (no emojis — some devices show them as broken boxes).
function buildShareText(t: Task): string {
  const lines: string[] = [];
  lines.push(`*Task Assigned*`);
  lines.push(``);
  lines.push(`*${t.task}*`);
  lines.push(`Priority: ${t.priority}`);
  if (t.assigned_to) lines.push(`Assigned to: ${t.assigned_to}`);
  lines.push(`Supervisor: ${t.supervisor}`);
  lines.push(`Due: ${formatDate(t.due_date)}`);
  lines.push(`Status: ${t.status}`);
  if (t.location) lines.push(`Location: ${t.location}`);
  if (t.follow_up) lines.push(`Notes: ${t.follow_up}`);
  if (t.extra_assignees && t.extra_assignees.length > 0)
    lines.push(`Also: ${t.extra_assignees.join(", ")}`);
  return lines.join("\n");
}
