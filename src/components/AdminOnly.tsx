"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/");
    } else if (!isAdmin) {
      router.replace("/dashboard/tasks");
    }
  }, [isAdmin, isLoggedIn, router]);

  if (!isAdmin) return null;

  return <>{children}</>;
}
