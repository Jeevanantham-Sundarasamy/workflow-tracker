"use client";

import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Loader, PauseCircle } from "lucide-react";
import type { Task } from "@/lib/types";

interface StatsCardsProps {
  tasks: Task[];
  activeFilter: string;
  onFilter: (status: string) => void;
}

export default function StatsCards({ tasks, activeFilter, onFilter }: StatsCardsProps) {
  const total = tasks.length;
  const pending = tasks.filter((t) => t.status === "Pending").length;
  const inProgress = tasks.filter((t) => t.status === "In Progress").length;
  const done = tasks.filter((t) => t.status === "Done").length;
  const delayed = tasks.filter((t) => t.status === "Delayed").length;

  const cards = [
    { label: "Total Tasks", count: total, key: "All", icon: ClipboardList, color: "text-primary-600", bg: "bg-primary-50", ring: "ring-primary-200" },
    { label: "Pending", count: pending, key: "Pending", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
    { label: "In Progress", count: inProgress, key: "In Progress", icon: Loader, color: "text-blue-600", bg: "bg-blue-50", ring: "ring-blue-200" },
    { label: "Completed", count: done, key: "Done", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
    { label: "Delayed", count: delayed, key: "Delayed", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-200" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <button
          key={c.key}
          onClick={() => onFilter(activeFilter === c.key ? "All" : c.key)}
          className={`relative bg-white rounded-2xl border p-4 text-left transition-all hover:shadow-md group ${
            activeFilter === c.key
              ? `border-primary-300 ring-2 ${c.ring}`
              : "border-border hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {c.label}
            </span>
            <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center transition group-hover:scale-110`}>
              <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
            </div>
          </div>
          <p className={`text-2xl font-black ${c.color}`}>{c.count}</p>
        </button>
      ))}
    </div>
  );
}
