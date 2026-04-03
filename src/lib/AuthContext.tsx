"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Role } from "./types";

const FALLBACK_PIN = "1234";
const STORAGE_KEY = "workflow_auth";

interface AuthContextType {
  role: Role;
  isAdmin: boolean;
  isManager: boolean;
  isSupervisor: boolean;
  isEmployee: boolean;
  isLoggedIn: boolean;
  /** Admin or Manager — has full access */
  hasFullAccess: boolean;
  userName: string | null;
  supervisorName: string | null;
  department: string | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  refreshPin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  role: "guest",
  isAdmin: false,
  isManager: false,
  isSupervisor: false,
  isEmployee: false,
  isLoggedIn: false,
  hasFullAccess: false,
  userName: null,
  supervisorName: null,
  department: null,
  login: async () => false,
  logout: () => {},
  refreshPin: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("guest");
  const [userName, setUserName] = useState<string | null>(null);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dbPin, setDbPin] = useState<string | null>(null);

  const loadPin = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "admin_pin")
        .single();
      if (!error && data) {
        setDbPin(data.value);
      }
    } catch {
      // settings table may not exist yet
    }
  }, []);

  useEffect(() => {
    loadPin();
  }, [loadPin]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "admin") {
      setRole("admin");
      setUserName("Admin");
    } else if (saved?.startsWith("manager:")) {
      const parts = saved.replace("manager:", "").split("|dept:");
      setRole("manager");
      setUserName(parts[0]);
      setDepartment(parts[1] || null);
    } else if (saved?.startsWith("supervisor:")) {
      const parts = saved.replace("supervisor:", "").split("|dept:");
      setRole("supervisor");
      setUserName(parts[0]);
      setSupervisorName(parts[0]);
      setDepartment(parts[1] || null);
    } else if (saved?.startsWith("employee:")) {
      const parts = saved.replace("employee:", "").split("|sup:");
      const supParts = (parts[1] || "").split("|dept:");
      setRole("employee");
      setUserName(parts[0]);
      setSupervisorName(supParts[0] || null);
      setDepartment(supParts[1] || null);
    }
    setLoaded(true);
  }, []);

  const login = async (pin: string): Promise<boolean> => {
    // Check admin PIN first
    const currentPin = dbPin || FALLBACK_PIN;
    if (pin === currentPin) {
      setRole("admin");
      setUserName("Admin");
      setSupervisorName(null);
      setDepartment(null);
      localStorage.setItem(STORAGE_KEY, "admin");
      return true;
    }

    // Check manager PINs
    try {
      const { data: mgrData, error: mgrError } = await supabase
        .from("managers")
        .select("name, department")
        .eq("pin", pin);
      if (!mgrError && mgrData && mgrData.length > 0) {
        const mgr = mgrData[0];
        setRole("manager");
        setUserName(mgr.name);
        setSupervisorName(null);
        setDepartment(mgr.department || null);
        localStorage.setItem(STORAGE_KEY, `manager:${mgr.name}|dept:${mgr.department || ""}`);
        return true;
      }
    } catch {
      // No managers table yet
    }

    // Check supervisor PINs
    try {
      const { data: supData, error: supError } = await supabase
        .from("supervisors")
        .select("name, department")
        .eq("pin", pin);
      if (!supError && supData && supData.length > 0) {
        const sup = supData[0];
        setRole("supervisor");
        setUserName(sup.name);
        setSupervisorName(sup.name);
        setDepartment(sup.department || null);
        localStorage.setItem(STORAGE_KEY, `supervisor:${sup.name}|dept:${sup.department || ""}`);
        return true;
      }
    } catch {
      // No matching supervisor PIN
    }

    // Check employee PINs
    try {
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("name, supervisor_name, department")
        .eq("pin", pin);
      if (!empError && empData && empData.length > 0) {
        const emp = empData[0];
        setRole("employee");
        setUserName(emp.name);
        setSupervisorName(emp.supervisor_name);
        setDepartment(emp.department || null);
        localStorage.setItem(STORAGE_KEY, `employee:${emp.name}|sup:${emp.supervisor_name || ""}|dept:${emp.department || ""}`);
        return true;
      }
    } catch {
      // No matching employee PIN
    }

    return false;
  };

  const logout = () => {
    setRole("guest");
    setUserName(null);
    setSupervisorName(null);
    setDepartment(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!loaded) return null;

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isSupervisor = role === "supervisor";
  const isEmployee = role === "employee";
  const isLoggedIn = role !== "guest";
  const hasFullAccess = isAdmin || isManager;

  return (
    <AuthContext.Provider value={{ role, isAdmin, isManager, isSupervisor, isEmployee, isLoggedIn, hasFullAccess, userName, supervisorName, department, login, logout, refreshPin: loadPin }}>
      {children}
    </AuthContext.Provider>
  );
}
