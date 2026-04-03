"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Workflow, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "workflow_auth";
const FALLBACK_PIN = "1234";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // If already logged in, redirect
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "admin") {
      router.replace("/dashboard");
    } else if (saved?.startsWith("manager:")) {
      router.replace("/dashboard");
    } else if (saved?.startsWith("supervisor:")) {
      router.replace("/dashboard/tasks");
    } else if (saved?.startsWith("employee:")) {
      router.replace("/dashboard/tasks");
    } else {
      setLoading(false);
    }
  }, [router]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError(false);

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3 && newPin.every((d) => d)) {
      handleLogin(newPin.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    if (e.key === "Enter") {
      const full = pin.join("");
      if (full.length === 4) handleLogin(full);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      const newPin = pasted.split("");
      setPin(newPin);
      inputRefs[3].current?.focus();
      handleLogin(pasted);
    }
  };

  const handleLogin = async (pinStr: string) => {
    setChecking(true);
    setError(false);

    // Check admin PIN
    let adminPin = FALLBACK_PIN;
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "admin_pin")
        .single();
      if (data?.value) adminPin = data.value;
    } catch {}

    if (pinStr === adminPin) {
      localStorage.setItem(STORAGE_KEY, "admin");
      router.replace("/dashboard");
      return;
    }

    // Check manager PIN
    try {
      const { data } = await supabase
        .from("managers")
        .select("name")
        .eq("pin", pinStr);
      if (data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY, `manager:${data[0].name}`);
        router.replace("/dashboard");
        return;
      }
    } catch {}

    // Check supervisor PIN
    try {
      const { data } = await supabase
        .from("supervisors")
        .select("name")
        .eq("pin", pinStr);
      if (data && data.length > 0) {
        localStorage.setItem(STORAGE_KEY, `supervisor:${data[0].name}`);
        router.replace("/dashboard/tasks");
        return;
      }
    } catch {}

    // Check employee PIN
    try {
      const { data } = await supabase
        .from("employees")
        .select("name, supervisor_name")
        .eq("pin", pinStr);
      if (data && data.length > 0) {
        const emp = data[0];
        localStorage.setItem(STORAGE_KEY, `employee:${emp.name}|sup:${emp.supervisor_name || ""}`);
        router.replace("/dashboard/tasks");
        return;
      }
    } catch {}

    // No match
    setError(true);
    setChecking(false);
    setPin(["", "", "", ""]);
    inputRefs[0].current?.focus();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
            <Workflow className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">WorkFlow</h1>
          <p className="text-sm text-gray-400 mt-1">Task Manager</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl border border-border p-8 shadow-xl shadow-gray-100">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-700">Enter your PIN to login</h2>
          </div>

          {/* PIN Input */}
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={inputRefs[i]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
                className={`w-14 h-14 rounded-2xl border-2 text-center text-2xl font-black transition-all focus:outline-none focus:ring-4 ${
                  error
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100 text-red-600 animate-shake"
                    : "border-gray-200 focus:border-primary-400 focus:ring-primary-100 text-gray-900"
                }`}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs font-semibold text-red-500 text-center mb-4 animate-fadeIn">
              Invalid PIN. Please try again.
            </p>
          )}

          {/* Loading */}
          {checking && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-gray-400 font-medium">Verifying...</span>
            </div>
          )}

          {/* Role hints */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider text-center mb-3">Login as</p>
            <div className="flex justify-center gap-2">
              <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 px-3 py-1 rounded-full border border-primary-100">Admin</span>
              <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-3 py-1 rounded-full border border-violet-100">Manager</span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Supervisor</span>
              <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">Employee</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-gray-300 text-center mt-6">WorkFlow Tracker v1.0</p>
      </div>
    </div>
  );
}
