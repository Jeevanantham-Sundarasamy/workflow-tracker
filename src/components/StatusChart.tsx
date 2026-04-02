"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { Task } from "@/lib/types";
import { STATUSES } from "@/lib/types";

interface StatusChartProps {
  tasks: Task[];
}

const COLORS: Record<string, string> = {
  Pending: "#f59e0b",
  "In Progress": "#3b82f6",
  Done: "#10b981",
  Delayed: "#ef4444",
  "On Hold": "#f97316",
  Cancelled: "#94a3b8",
};

export default function StatusChart({ tasks }: StatusChartProps) {
  const data = STATUSES
    .map((s) => ({ name: s, value: tasks.filter((t) => t.status === s).length }))
    .filter((d) => d.value > 0);

  if (!data.length) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Task Distribution</h3>
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">
          No tasks yet
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4">Task Distribution</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] || "#94a3b8"} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "12px", fontWeight: 600 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2 flex-wrap">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[d.name] || "#94a3b8" }} />
            <span className="font-medium">{d.name}</span>
            <span className="font-bold text-gray-700">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
