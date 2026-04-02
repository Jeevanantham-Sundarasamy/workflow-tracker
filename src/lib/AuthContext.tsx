"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import type { Role } from "./types";

const FALLBACK_PIN = "1234";
const STORAGE_KEY = "workflow_auth";

interface AuthContextType {
  role: Role;
  isManager: boolean;
  isSupervisor: boolean;
  isEmployee: boolean;
  isLoggedIn: boolean;
  userName: string | null;
  supervisorName: string | null; // For employees: their supervisor. For supervisors: their own name.
  department: string | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  refreshPin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  role: "guest",
  isManager: false,
  isSupervisor: false,
  isEmployee: false,
  isLoggedIn: false,
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
    if (saved === "manager") {
      setRole("manager");
      setUserName("Manager");
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
    // Check manager PIN first
    const currentPin = dbPin || FALLBACK_PIN;
    if (pin === currentPin) {
      setRole("manager");
      setUserName("Manager");
      setSupervisorName(null);
      setDepartment(null);
      localStorage.setItem(STORAGE_KEY, "manager");
      return true;
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

  const isManager = role === "manager";
  const isSupervisor = role === "supervisor";
  const isEmployee = role === "employee";
  const isLoggedIn = role !== "guest";

  return (
    <AuthContext.Provider value={{ role, isManager, isSupervisor, isEmployee, isLoggedIn, userName, supervisorName, department, login, logout, refreshPin: loadPin }}>
      {children}
    </AuthContext.Provider>
  );
}
