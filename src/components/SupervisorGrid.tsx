"use client";

import type { Task } from "@/lib/types";
import { STATUSES } from "@/lib/types";

interface SupervisorGridProps {
  supervisors: string[];
  tasks: Task[];
}

const dotColor: Record<string, string> = {
  Pending: "bg-amber-400",
  "In Progress": "bg-blue-400",
  Done: "bg-emerald-400",
  Delayed: "bg-red-400",
  "On Hold": "bg-orange-400",
  Cancelled: "bg-gray-400",
};

export default function SupervisorGrid({
  supervisors,
  tasks,
}: SupervisorGridProps) {
  if (!supervisors.length) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          Supervisor Overview
        </h3>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {supervisors.map((sup) => {
          const supTasks = tasks.filter((t) => t.supervisor === sup);
          const initials = sup
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <div
              key={sup}
              className="bg-white rounded-2xl border border-border p-4 hover:shadow-md transition"
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {sup}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {supTasks.length} task{supTasks.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {supTasks.length > 0 ? (
                <div className="space-y-1.5">
                  {STATUSES.filter((s) =>
                    supTasks.some((t) => t.status === s)
                  ).map((s) => (
                    <div
                      key={s}
                      className="flex items-center gap-2 text-xs text-gray-500"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${dotColor[s]}`}
                      />
                      <span>{s}</span>
                      <span className="ml-auto font-bold text-gray-700">
                        {supTasks.filter((t) => t.status === s).length}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-gray-400">No tasks</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
