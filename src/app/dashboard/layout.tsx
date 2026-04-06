"use client";

import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import PushNotificationProvider from "@/components/PushNotificationProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/AuthContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0">{children}</main>
          <MobileNav />
          <PushNotificationProvider />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
