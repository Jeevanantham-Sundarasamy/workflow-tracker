"use client";

import { Search, LogIn, LogOut, Briefcase, User, UserCircle } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/lib/AuthContext";

interface TopbarProps {
  onLoginClick: () => void;
}

export default function Topbar({ onLoginClick }: TopbarProps) {
  const { isManager, isSupervisor, isEmployee, isLoggedIn, userName, department, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
      {/* Search */}
      <div className="relative w-full max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search tasks, supervisors..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-surface-secondary text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
        />
      </div>

      {/* Mobile brand */}
      <span className="text-sm font-bold text-gray-900 sm:hidden">WorkFlow</span>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3 ml-4">
        <NotificationBell />

        {/* Role badge */}
        {isManager && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-primary-50 border-primary-200">
            <Briefcase className="w-3 h-3 text-primary-600" />
            <span className="text-[10px] font-bold text-primary-700">Manager</span>
          </div>
        )}
        {isSupervisor && userName && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-emerald-50 border-emerald-200">
            <User className="w-3 h-3 text-emerald-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-emerald-700 leading-tight">{userName}</span>
              {department && <span className="text-[9px] text-emerald-500 leading-tight">{department}</span>}
            </div>
          </div>
        )}
        {isEmployee && userName && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-blue-50 border-blue-200">
            <UserCircle className="w-3 h-3 text-blue-600" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-blue-700 leading-tight">{userName}</span>
              {department && <span className="text-[9px] text-blue-500 leading-tight">{department}</span>}
            </div>
          </div>
        )}

        {/* Login / Logout */}
        <button
          onClick={isLoggedIn ? () => { logout(); window.location.href = "/"; } : onLoginClick}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition ${
            isLoggedIn
              ? "bg-gray-50 text-gray-600 border border-border hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          {isLoggedIn ? (
            <>
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </>
          ) : (
            <>
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Login</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
