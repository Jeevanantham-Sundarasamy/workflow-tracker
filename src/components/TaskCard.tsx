"use client";

import { Calendar, User, Flag, Pencil, Trash2, MapPin, Eye, UserCircle, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import type { Task } from "@/lib/types";
import { STATUSES } from "@/lib/types";

interface TaskCardProps {
  task: Task;
  canEdit: boolean;
  canDelete: boolean;
  canChangeStatus: boolean;
  onStatusChange: (id: string, status: string, comment?: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onViewDetail?: (task: Task) => void;
}

const statusStyles: Record<string, string> = {
  Pending: "bg-amber-50 text-amber-700 border-amber-200",
  "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
  Done: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Delayed: "bg-red-50 text-red-700 border-red-200",
  "On Hold": "bg-orange-50 text-orange-700 border-orange-200",
  Cancelled: "bg-gray-100 text-gray-500 border-gray-300",
};

const priorityStyles = {
  High: "text-red-600",
  Medium: "text-amber-600",
  Low: "text-gray-400",
};

export default function TaskCard({
  task,
  canEdit,
  canDelete,
  canChangeStatus,
  onStatusChange,
  onEdit,
  onDelete,
  onViewDetail,
}: TaskCardProps) {
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = task.status !== "Done" && task.status !== "Cancelled" && task.due_date < today;
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [comment, setComment] = useState("");

  const handleStatusClick = (status: string) => {
    if (status === task.status) return;
    setSelectedStatus(status);
    setComment("");
    setShowStatusModal(true);
  };

  const handleStatusConfirm = () => {
    onStatusChange(task.id, selectedStatus, comment.trim() || undefined);
    setShowStatusModal(false);
    setSelectedStatus("");
    setComment("");
  };

  return (
    <>
    <div
      className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-md ${
        isOverdue
          ? "border-l-4 border-l-red-400 border-t-border border-r-border border-b-border"
          : "border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900 truncate">
              {task.task}
            </h3>
            {isOverdue && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                Overdue
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-[11px] font-bold px-3 py-1 rounded-full border flex-shrink-0 ${
            statusStyles[task.status] || statusStyles.Pending
          }`}
        >
          {task.status}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 sm:gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          {task.supervisor}
        </span>
        {task.assigned_to && (
          <span className="flex items-center gap-1.5 text-blue-600">
            <UserCircle className="w-3.5 h-3.5" />
            {task.assigned_to}
          </span>
        )}
        <span className={`flex items-center gap-1.5 font-semibold ${priorityStyles[task.priority]}`}>
          <Flag className="w-3.5 h-3.5" />
          {task.priority}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          {task.due_date}
        </span>
        {task.location && (
          <span className="flex items-center gap-1.5 text-primary-600">
            <MapPin className="w-3.5 h-3.5" />
            {task.location}
          </span>
        )}
      </div>

      {/* Notes */}
      {task.follow_up && (
        <div className="text-xs text-gray-400 italic bg-gray-50 rounded-xl px-3 py-2 mb-3 border border-border-light">
          {task.follow_up}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {canChangeStatus && (
          <div className="flex gap-1 flex-wrap">
            {STATUSES.filter((s) => s !== task.status).map((s) => {
              const colors: Record<string, string> = {
                "Pending": "text-amber-600 bg-amber-50 hover:bg-amber-100",
                "In Progress": "text-blue-600 bg-blue-50 hover:bg-blue-100",
                "Done": "text-emerald-600 bg-emerald-50 hover:bg-emerald-100",
                "Delayed": "text-red-600 bg-red-50 hover:bg-red-100",
                "On Hold": "text-orange-600 bg-orange-50 hover:bg-orange-100",
                "Cancelled": "text-gray-500 bg-gray-100 hover:bg-gray-200",
              };
              return (
                <button key={s} onClick={() => handleStatusClick(s)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg transition ${colors[s] || ""}`}>
                  {s}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {onViewDetail && (
            <button onClick={() => onViewDetail(task)}
              className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition">
              <Eye className="w-3 h-3" /> Detail
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(task)}
              className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          {canDelete && (
            <button onClick={() => onDelete(task.id)}
              className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Status Change Modal with Comment */}
    {showStatusModal && (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && setShowStatusModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="flex items-center justify-between p-5 pb-0">
            <h3 className="text-sm font-bold text-gray-900">Update Status</h3>
            <button onClick={() => setShowStatusModal(false)}
              className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">
                <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${statusStyles[task.status] || ""}`}>{task.status}</span>
                <span className="mx-2">→</span>
                <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${statusStyles[selectedStatus] || ""}`}>{selectedStatus}</span>
              </p>
              <p className="text-xs font-semibold text-gray-700 truncate">{task.task}</p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                Add Comment <span className="normal-case text-gray-300">(optional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={`e.g. Reason for ${selectedStatus.toLowerCase()}...`}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowStatusModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleStatusConfirm}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition">
                Update
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
