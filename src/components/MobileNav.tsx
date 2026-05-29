"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Palmtree,
  CalendarDays,
  Settings,
  MoreHorizontal,
  X,
  Users,
  UserCheck,
  Building2,
  Workflow,
  BarChart3,
  Truck,
  FileBarChart2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

type Access = "all" | "logged_in" | "admin_only" | "full_access" | "not_employee";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  access: Access;
}

const primaryItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, access: "logged_in" },
  { label: "Tasks", href: "/dashboard/tasks", icon: ClipboardList, access: "all" },
  { label: "Leave", href: "/dashboard/leave", icon: Palmtree, access: "all" },
];

const moreItems: NavItem[] = [
  { label: "Porter", href: "/dashboard/porter", icon: Truck, access: "logged_in" },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays, access: "not_employee" },
  { label: "Team", href: "/dashboard/team", icon: Users, access: "full_access" },
  { label: "Employees", href: "/dashboard/employees", icon: UserCheck, access: "not_employee" },
  { label: "Customers", href: "/dashboard/customers", icon: Building2, access: "not_employee" },
  { label: "Production", href: "/dashboard/production", icon: Workflow, access: "logged_in" },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, access: "not_employee" },
  { label: "Reports", href: "/dashboard/reports", icon: FileBarChart2, access: "not_employee" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, access: "admin_only" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { isAdmin, hasFullAccess, isSupervisor, isLoggedIn } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const canAccess = (access: Access): boolean => {
    if (access === "all") return true;
    if (access === "logged_in") return isLoggedIn;
    if (access === "admin_only") return isAdmin;
    if (access === "full_access") return hasFullAccess;
    if (access === "not_employee") return hasFullAccess || isSupervisor;
    return false;
  };

  const primary = primaryItems.filter((i) => canAccess(i.access));
  const more = moreItems.filter((i) => canAccess(i.access));

  // Close sheet when route changes
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 px-2 pb-safe">
        <div className="flex justify-around">
          {primary.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-semibold transition ${
                  active ? "text-primary-600" : "text-gray-400"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
          {more.length > 0 && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-semibold transition ${
                moreOpen || more.some((m) => isActive(m.href))
                  ? "text-primary-600"
                  : "text-gray-400"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              More
            </button>
          )}
        </div>
      </nav>

      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end"
          onClick={(e) => e.target === e.currentTarget && setMoreOpen(false)}
        >
          <div className="w-full bg-white rounded-t-2xl pb-safe shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-gray-900">More</h3>
              <button
                onClick={() => setMoreOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-4">
              {more.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex flex-col items-center gap-2 py-4 rounded-xl text-[11px] font-semibold transition ${
                      active
                        ? "bg-primary-50 text-primary-700"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <item.icon
                      className={`w-6 h-6 ${active ? "text-primary-600" : "text-gray-500"}`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
