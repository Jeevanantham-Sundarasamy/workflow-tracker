"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Palmtree,
  CalendarDays,
  Settings,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

type Access = "all" | "logged_in" | "manager_only" | "not_employee";

const allItems: { label: string; href: string; icon: typeof LayoutDashboard; access: Access }[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard, access: "logged_in" },
  { label: "Tasks", href: "/dashboard/tasks", icon: ClipboardList, access: "all" },
  { label: "Leave", href: "/dashboard/leave", icon: Palmtree, access: "all" },
  { label: "Calendar", href: "/dashboard/calendar", icon: CalendarDays, access: "not_employee" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, access: "manager_only" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { isManager, isSupervisor, isLoggedIn } = useAuth();

  const items = allItems.filter((item) => {
    if (item.access === "all") return true;
    if (item.access === "logged_in") return isLoggedIn;
    if (item.access === "manager_only") return isManager;
    if (item.access === "not_employee") return isManager || isSupervisor;
    return false;
  });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 px-2 pb-safe">
      <div className="flex justify-around">
        {items.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 text-[10px] font-semibold transition ${
                isActive ? "text-primary-600" : "text-gray-400"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
