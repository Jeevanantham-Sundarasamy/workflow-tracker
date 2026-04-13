"use client";

import { useEffect, useRef, useState } from "react";
import { X, Share2, MessageCircle, Send, Copy, Download, Image as ImageIcon, Clipboard } from "lucide-react";
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
  const [status, setStatus] = useState<{ kind: "info" | "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setStatus(null);
    }
  }, [open]);

  if (!open || !task) return null;

  const text = buildShareText(task);

  const generateBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const generateFile = async (): Promise<File | null> => {
    const blob = await generateBlob();
    if (!blob) return null;
    return new File([blob], `task-${String(task.id).slice(0, 8)}.png`, { type: "image/png" });
  };

  const triggerDownload = (file: File | Blob, name: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  };

  const tryNativeShareWithFile = async (file: File): Promise<boolean> => {
    const nav = navigator as Nav;
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: "Task Assigned", text });
        return true;
      } catch (err) {
        const e = err as DOMException;
        if (e.name === "AbortError") return true; // user cancelled — don't fall back
        console.warn("share failed", err);
      }
    }
    return false;
  };

  const tryCopyImageToClipboard = async (blob: Blob): Promise<boolean> => {
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      return true;
    } catch (err) {
      console.warn("clipboard write failed", err);
      return false;
    }
  };

  const handleError = (err: unknown) => {
    console.error(err);
    setStatus({
      kind: "error",
      msg: `Could not generate screenshot: ${(err as Error).message || "unknown error"}`,
    });
  };

  // Primary: device share sheet (mobile = best UX)
  const nativeShare = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const file = await generateFile();
      if (!file) throw new Error("Could not capture screenshot");
      const shared = await tryNativeShareWithFile(file);
      if (shared) {
        setStatus({ kind: "success", msg: "Opened share sheet." });
      } else {
        // Desktop fallback: copy to clipboard if possible, otherwise download
        const copied = await tryCopyImageToClipboard(file);
        if (copied) {
          setStatus({ kind: "success", msg: "Image copied. Paste it (Ctrl+V) in any chat app." });
        } else {
          triggerDownload(file, file.name);
          setStatus({ kind: "info", msg: "Screenshot downloaded — attach it in any chat app." });
        }
      }
    } catch (err) {
      handleError(err);
    }
    setBusy(false);
  };

  // WhatsApp: try native share with file → else copy image + open WhatsApp Web → else download + open
  const shareWhatsApp = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const file = await generateFile();
      if (!file) throw new Error("Could not capture screenshot");

      const shared = await tryNativeShareWithFile(file);
      if (shared) {
        setStatus({ kind: "success", msg: "Opened share sheet." });
      } else {
        const copied = await tryCopyImageToClipboard(file);
        const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
        if (copied) {
          setStatus({
            kind: "success",
            msg: "Image copied to clipboard. In WhatsApp, pick a chat and press Ctrl+V to paste the screenshot.",
          });
        } else {
          triggerDownload(file, file.name);
          setStatus({
            kind: "info",
            msg: "Screenshot downloaded. In WhatsApp Web, click attach (clip icon) and select the downloaded image.",
          });
        }
      }
    } catch (err) {
      handleError(err);
    }
    setBusy(false);
  };

  const shareTelegram = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const file = await generateFile();
      if (!file) throw new Error("Could not capture screenshot");

      const shared = await tryNativeShareWithFile(file);
      if (shared) {
        setStatus({ kind: "success", msg: "Opened share sheet." });
      } else {
        const copied = await tryCopyImageToClipboard(file);
        const url = `https://t.me/share/url?url=${encodeURIComponent("Task Assigned")}&text=${encodeURIComponent(text)}`;
        window.open(url, "_blank");
        if (copied) {
          setStatus({
            kind: "success",
            msg: "Image copied. In Telegram, pick a chat and press Ctrl+V to paste.",
          });
        } else {
          triggerDownload(file, file.name);
          setStatus({
            kind: "info",
            msg: "Screenshot downloaded. Attach it in Telegram.",
          });
        }
      }
    } catch (err) {
      handleError(err);
    }
    setBusy(false);
  };

  const copyImage = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const blob = await generateBlob();
      if (!blob) throw new Error("Could not capture screenshot");
      const ok = await tryCopyImageToClipboard(blob);
      if (ok) {
        setStatus({ kind: "success", msg: "Image copied. Paste with Ctrl+V in WhatsApp / Telegram / email." });
      } else {
        setStatus({ kind: "error", msg: "Your browser does not support copying images. Use Download instead." });
      }
    } catch (err) {
      handleError(err);
    }
    setBusy(false);
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus({ kind: "success", msg: "Text copied to clipboard." });
    } catch (err) {
      handleError(err);
    }
  };

  const downloadPng = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const file = await generateFile();
      if (!file) throw new Error("Could not capture screenshot");
      triggerDownload(file, file.name);
      setStatus({ kind: "success", msg: "Screenshot downloaded." });
    } catch (err) {
      handleError(err);
    }
    setBusy(false);
  };

  const priorityColor =
    task.priority === "High" ? "#ef4444" : task.priority === "Medium" ? "#f59e0b" : "#10b981";

  const statusColor =
    status?.kind === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status?.kind === "error"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-blue-50 text-blue-700 border-blue-200";

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

          {status && (
            <div className={`text-xs font-medium px-3 py-2 rounded-xl border ${statusColor}`}>
              {status.msg}
            </div>
          )}

          {/* Share buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              disabled={busy}
              onClick={nativeShare}
              className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold transition col-span-2 sm:col-span-3 shadow-sm"
              title="On phone: opens share sheet. On desktop: copies image / downloads."
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
              disabled={busy}
              onClick={copyImage}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-semibold transition"
              title="Copy image — paste with Ctrl+V in WhatsApp / Telegram / Email"
            >
              <Clipboard className="w-4 h-4" /> Copy Image
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
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-semibold transition col-span-2"
            >
              <Download className="w-4 h-4" /> Download PNG
            </button>
          </div>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            <strong>Phone:</strong> tap WhatsApp/Telegram → share sheet appears with image.<br />
            <strong>Desktop:</strong> tap Copy Image, then paste (Ctrl+V) in WhatsApp Web / Telegram Web.
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
