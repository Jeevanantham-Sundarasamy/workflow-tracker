"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Upload,
  FileText,
  Clock,
  User,
  MapPin,
  Paperclip,
  MessageSquare,
  Activity,
  Trash2,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Task, Comment, ActivityLog, Attachment } from "@/lib/types";
import { logActivity } from "@/lib/activity";

interface TaskDetailModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  roleName: string;
}

export default function TaskDetailModal({
  task,
  open,
  onClose,
  roleName,
}: TaskDetailModalProps) {
  const [tab, setTab] = useState<"comments" | "activity" | "files">("comments");
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [porterSuppliers, setPorterSuppliers] = useState<{ name: string; address: string }[]>([]);

  const loadData = useCallback(async () => {
    if (!task) return;
    const [cRes, aRes, fRes] = await Promise.all([
      supabase
        .from("comments")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("activity_log")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("attachments")
        .select("*")
        .eq("task_id", task.id)
        .order("created_at", { ascending: false }),
    ]);
    if (cRes.data) setComments(cRes.data);
    if (aRes.data) setActivities(aRes.data);
    if (fRes.data) setAttachments(fRes.data);
  }, [task]);

  useEffect(() => {
    if (open && task) {
      loadData();
      setTab("comments");
      setNewComment("");
      if (task.task.startsWith("Porter Booking")) {
        supabase.from("porter_suppliers").select("name, address").then(
          (res: { data: { name: string; address: string }[] | null }) => {
            setPorterSuppliers(res.data || []);
          }
        );
      }
    }
  }, [open, task, loadData]);

  if (!open || !task) return null;

  const addComment = async () => {
    if (!newComment.trim()) return;
    const { data, error } = await supabase
      .from("comments")
      .insert({
        task_id: task.id,
        author: roleName || "User",
        message: newComment.trim(),
      })
      .select()
      .single();
    if (!error && data) {
      setComments((prev) => [data, ...prev]);
      setNewComment("");
      await logActivity(task.id, "commented", newComment.trim(), roleName || "User");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${task.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("task-attachments")
        .getPublicUrl(path);

      const { data, error } = await supabase
        .from("attachments")
        .insert({
          task_id: task.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: roleName || "User",
        })
        .select()
        .single();
      if (!error && data) {
        setAttachments((prev) => [data, ...prev]);
        await logActivity(task.id, "file_uploaded", file.name, roleName || "User");
      }
    } catch {
      alert("Upload failed. Make sure 'task-attachments' bucket exists in Supabase Storage.");
    }
    setUploading(false);
    e.target.value = "";
  };

  const deleteAttachment = async (att: Attachment) => {
    if (!confirm("Delete this file?")) return;
    await supabase.from("attachments").delete().eq("id", att.id);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const activityIcons: Record<string, string> = {
    created: "🆕",
    updated: "✏️",
    status_changed: "🔄",
    assigned: "👤",
    commented: "💬",
    file_uploaded: "📎",
  };

  const tabs = [
    { key: "comments" as const, label: "Comments", icon: MessageSquare, count: comments.length },
    { key: "activity" as const, label: "Activity", icon: Activity, count: activities.length },
    { key: "files" as const, label: "Files", icon: Paperclip, count: attachments.length },
  ];

  const displayTitle = (() => {
    if (!task.task.startsWith("Porter Booking")) return task.task;
    const fp = task.follow_up || "";
    const supplier = fp.match(/Supplier:\s*([^|]+)/)?.[1]?.trim();
    const receiver = fp.match(/Receiver:\s*([^|]+)/)?.[1]?.trim();
    let title = task.task;
    if (supplier) title = title.replace(/From:\s*[^|]+(\||$)/, (_, end) => `From: ${supplier}${end === "|" ? " | " : ""}`);
    if (receiver) {
      title = title.replace(/To:\s*[^|]+(\||$)/, (_, end) => `To: ${receiver}${end === "|" ? " | " : ""}`);
    } else {
      title = title.replace(/To:\s*([^|]+)(\||$)/, (_, addr, end) => {
        const rawAddr = addr.trim();
        // Try to match against known supplier addresses
        const matched = porterSuppliers.find((s) => {
          const sFirst = s.address.split(",")[0].trim().toLowerCase();
          const aFirst = rawAddr.split(",")[0].trim().toLowerCase();
          return sFirst && aFirst && (sFirst === aFirst || rawAddr.toLowerCase().startsWith(sFirst) || s.address.toLowerCase().startsWith(aFirst));
        });
        if (matched) return `To: ${matched.name}${end === "|" ? " | " : ""}`;
        // Fallback: show first 2 comma-parts
        const short = rawAddr.split(",").slice(0, 2).join(",").trim();
        return `To: ${short}${end === "|" ? " | " : ""}`;
      });
    }
    return title;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{displayTitle}</h2>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {task.supervisor}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> Due: {task.due_date}
              </span>
              {task.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {task.location}
                </span>
              )}
              {task.extra_assignees && task.extra_assignees.length > 0 && (
                <span className="flex items-center gap-1 text-purple-600">
                  <User className="w-3 h-3" /> +{task.extra_assignees.join(", ")}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition ${
                tab === t.key
                  ? "border-primary-500 text-primary-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {t.count > 0 && (
                <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Comments Tab */}
          {tab === "comments" && (
            <div className="space-y-3">
              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment()}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                />
                <button
                  onClick={addComment}
                  className="w-10 h-10 rounded-xl bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

              {/* Comment List */}
              {comments.length ? (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {c.author[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-gray-900">{c.author}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{c.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-6">No comments yet</p>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {tab === "activity" && (
            <div className="space-y-0">
              {activities.length ? (
                activities.map((a, i) => (
                  <div key={a.id} className="flex gap-3 relative">
                    {i < activities.length - 1 && (
                      <div className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-200" />
                    )}
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0 z-10">
                      {activityIcons[a.action] || "📌"}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-700">{a.actor}</span>
                        <span className="text-[10px] text-gray-400">{timeAgo(a.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        <span className="font-semibold capitalize">{a.action.replace("_", " ")}</span>
                        {a.details && ` — ${a.details}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-6">No activity yet</p>
              )}
            </div>
          )}

          {/* Files Tab */}
          {tab === "files" && (
            <div className="space-y-3">
              {/* Upload */}
              <label className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary-400 cursor-pointer transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500">
                  {uploading ? "Uploading..." : "Click to upload a file"}
                </span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>

              {/* File list */}
              {attachments.length ? (
                attachments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-gray-50 transition"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{a.file_name}</p>
                      <p className="text-[10px] text-gray-400">
                        {formatSize(a.file_size)} &middot; {a.uploaded_by} &middot; {timeAgo(a.created_at)}
                      </p>
                    </div>
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary-600"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => deleteAttachment(a)}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-6">No files attached</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
