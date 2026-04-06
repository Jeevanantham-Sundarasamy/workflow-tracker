"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Palmtree,
  CalendarDays,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

type Access = "all" | "logged_in" | "admin_only" | "full_access" | "not_employee";

const allNavItems: { label: string; href: string; icon: typeof LayoutDashboard; access: Access }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, access: "logged_in" },
  { label: "Tasks", href: "/dashboard/tasks", icon: ClipboardList, access: "all" },
  { label: "Team", href: "/dashboard/team", icon: Users, access: "full_access" },
  { label: "Production", href: "/dashboard/production", icon: Workflow, access: "logged_in" },
  { label: "Leave", href: "/dashboard/leave", icon: Palmtree, access: "all" },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays, access: "not_employee" },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, access: "not_employee" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, access: "admin_only" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin, hasFullAccess, isSupervisor, isLoggedIn } = useAuth();

  const navItems = allNavItems.filter((item) => {
    if (item.access === "all") return true;
    if (item.access === "logged_in") return isLoggedIn;
    if (item.access === "admin_only") return isAdmin;
    if (item.access === "full_access") return hasFullAccess;
    if (item.access === "not_employee") return hasFullAccess || isSupervisor;
    return false;
  });

  return (
    <aside
      className={`${
        collapsed ? "w-[72px]" : "w-[250px]"
      } transition-sidebar h-screen bg-white border-r border-border flex flex-col sticky top-0 z-40 max-md:hidden`}
    >
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
          <Workflow className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-[15px] font-bold text-gray-900 leading-tight">
              WorkFlow
            </h1>
            <p className="text-[10px] text-gray-400 font-medium">
              Task Manager
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                isActive
                  ? "bg-primary-50 text-primary-700 font-semibold"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              <item.icon
                className={`w-[18px] h-[18px] flex-shrink-0 ${
                  isActive ? "text-primary-600" : ""
                }`}
              />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 pb-3 space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 w-full transition-all"
        >
          {collapsed ? (
            <ChevronRight className="w-[18px] h-[18px]" />
          ) : (
            <>
              <ChevronLeft className="w-[18px] h-[18px]" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
