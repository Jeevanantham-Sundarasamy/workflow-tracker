"use client";

import { X } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface PinModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => boolean | Promise<boolean>;
}

export default function PinModal({ open, onClose, onSubmit }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(false);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setLoading(true);
    const success = await onSubmit(pin);
    setLoading(false);
    if (!success) setError(true);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-lg font-bold text-gray-900">Login</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-400">Enter your Manager or Supervisor PIN</p>
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
              Enter PIN
            </label>
            <input
              ref={inputRef}
              type="password"
              maxLength={6}
              inputMode="numeric"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
              className="w-full px-4 py-3 rounded-xl border border-border bg-white text-center text-2xl font-bold tracking-[12px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition"
              placeholder="••••"
            />
            {error && (
              <p className="text-xs text-red-500 font-semibold mt-2 text-center">
                Incorrect PIN
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-gray-500 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? "Checking..." : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
