"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { requestPushPermission, showPushNotification, isPushSupported, getPushPermission } from "@/lib/pushNotification";
import { subscribeUserToPush } from "@/lib/webPush";
import { Bell } from "lucide-react";

export default function PushNotificationProvider() {
  const { isLoggedIn, userName, role } = useAuth();
  const [showBanner, setShowBanner] = useState(false);

  // Request permission + subscribe to web push after login
  useEffect(() => {
    if (!isLoggedIn || !isPushSupported()) return;
    if (getPushPermission() === "default") {
      // Show banner after 2 seconds
      const timer = setTimeout(() => setShowBanner(true), 2000);
      return () => clearTimeout(timer);
    }
    // Already granted — make sure we're subscribed for this user
    if (getPushPermission() === "granted" && userName) {
      subscribeUserToPush(userName);
    }
  }, [isLoggedIn, userName]);

  const handleAllow = async () => {
    const granted = await requestPushPermission();
    setShowBanner(false);
    if (granted && userName) await subscribeUserToPush(userName);
  };

  // Listen to task changes
  useEffect(() => {
    if (!isLoggedIn) return;

    // Listen for new task assignments (INSERT — covers porter tasks and other direct inserts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskInsertChannel = supabase
      .channel("push-tasks-insert")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const newTask = payload.new as { task: string; assigned_to: string | null; extra_assignees: string[] | null };
          const extras = newTask.extra_assignees ?? [];
          const isAssignedToMe = !!newTask.assigned_to && newTask.assigned_to === userName;
          const isExtraAssignee = !!userName && extras.includes(userName);
          if (isAssignedToMe || isExtraAssignee) {
            showPushNotification("Task Assigned to You", {
              body: `"${newTask.task}" has been assigned to you`,
              tag: `task-new-${payload.new.id}`,
            });
          }
        }
      )
      .subscribe();

    // Listen for task assignment changes and status changes (UPDATE)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taskChannel = supabase
      .channel("push-tasks")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" },
        (payload: any) => {
          const newTask = payload.new as { task: string; status: string; assigned_to: string | null; supervisor: string; extra_assignees: string[] | null };
          const oldTask = payload.old as { status?: string; assigned_to?: string | null; extra_assignees?: string[] | null };

          const newExtras = newTask.extra_assignees ?? [];
          const oldExtras = oldTask.extra_assignees ?? [];
          const iAmPrimaryNow = !!newTask.assigned_to && newTask.assigned_to === userName;
          const iWasPrimaryBefore = oldTask.assigned_to === userName;
          const iAmExtraNow = !!userName && newExtras.includes(userName);
          const iWasExtraBefore = !!userName && oldExtras.includes(userName);
          const newlyAssigned = (iAmPrimaryNow && !iWasPrimaryBefore) || (iAmExtraNow && !iWasExtraBefore);

          // Task assigned to me (primary or extra)
          if (newlyAssigned) {
            showPushNotification("Task Assigned to You", {
              body: `"${newTask.task}" has been assigned to you`,
              tag: `task-assign-${payload.new.id}`,
            });
          }

          // Task status changed — notify supervisor + primary + extras
          if (newTask.status !== oldTask.status) {
            const watchers = [newTask.supervisor, newTask.assigned_to, ...newExtras].filter(Boolean);
            if (userName && watchers.includes(userName)) {
              showPushNotification("Task Status Updated", {
                body: `"${newTask.task}" → ${newTask.status}`,
                tag: `task-status-${payload.new.id}`,
              });
            }
          }
        }
      )
      .subscribe();

    // Listen for leave request changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leaveChannel = supabase
      .channel("push-leaves")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leave_requests" },
        (payload: any) => {
          const leave = payload.new as { employee_name: string; status: string; approval_comment: string | null };
          const oldLeave = payload.old as { status?: string };

          // Leave approved/rejected (notify employee)
          if (leave.status !== oldLeave.status && leave.employee_name === userName) {
            const emoji = leave.status === "Approved" ? "Approved" : "Rejected";
            showPushNotification(`Leave ${emoji}`, {
              body: leave.approval_comment || `Your leave request has been ${leave.status.toLowerCase()}`,
              tag: `leave-${payload.new.id}`,
            });
          }
        }
      )
      .subscribe();

    // Listen for project task changes (QC, assignment, status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectTaskChannel = supabase
      .channel("push-project-tasks")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "project_tasks" },
        (payload: any) => {
          const task = payload.new as { task_name: string; assigned_to: string | null; status: string; qc_status: string | null; department_name: string };
          const oldTask = payload.old as { assigned_to?: string | null; status?: string; qc_status?: string | null };

          // Task assigned to employee
          if (task.assigned_to && task.assigned_to !== oldTask.assigned_to && task.assigned_to === userName) {
            showPushNotification("Production Task Assigned", {
              body: `"${task.task_name}" (${task.department_name}) assigned to you`,
              tag: `pt-assign-${payload.new.id}`,
            });
          }

          // QC result (notify assigned employee)
          if (task.qc_status && task.qc_status !== oldTask.qc_status && task.assigned_to === userName) {
            showPushNotification(`QC ${task.qc_status}`, {
              body: `"${task.task_name}" QC: ${task.qc_status}`,
              tag: `pt-qc-${payload.new.id}`,
            });
          }
        }
      )
      .subscribe();

    // Listen for new notifications (catch-all)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notifChannel = supabase
      .channel("push-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" },
        (payload: any) => {
          const notif = payload.new as { message: string; type: string };
          showPushNotification("WorkFlow Tracker", {
            body: notif.message,
            tag: `notif-${payload.new.id}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(taskInsertChannel);
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(projectTaskChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [isLoggedIn, userName, role]);

  // Permission banner
  if (!showBanner) return null;

  return (
    <div className="fixed top-20 right-4 z-50 bg-white rounded-2xl border border-border shadow-2xl p-4 w-80 animate-fadeIn">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Bell className="w-4 h-4 text-primary-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">Enable Notifications</p>
          <p className="text-xs text-gray-400 mt-0.5">Get notified when tasks are assigned, status changes, or leave is approved.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAllow}
              className="text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-4 py-1.5 rounded-lg transition">
              Allow
            </button>
            <button onClick={() => setShowBanner(false)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-4 py-1.5 rounded-lg transition">
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
