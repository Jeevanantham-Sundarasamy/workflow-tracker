import { supabase } from "./supabase";

export async function logActivity(
  taskId: string | null,
  action: string,
  details: string,
  actor: string = "Admin"
) {
  await supabase.from("activity_log").insert({
    task_id: taskId,
    action,
    details,
    actor,
  });
}

export async function createNotification(
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
  relatedTaskId: string | null = null,
  recipients?: string[]
) {
  await supabase.from("notifications").insert({
    message,
    type,
    related_task_id: relatedTaskId,
  });

  const targets = (recipients ?? []).map((r) => r?.trim()).filter(Boolean) as string[];
  if (targets.length === 0) return;
  const unique = Array.from(new Set(targets));
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userNames: unique,
        title: "WorkFlow Tracker",
        body: message,
        url: relatedTaskId ? `/dashboard/tasks` : "/dashboard",
      }),
    });
  } catch {
    // push is best-effort; DB notification is the source of truth
  }
}
