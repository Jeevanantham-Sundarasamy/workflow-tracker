import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Fall back to hardcoded values used in src/lib/supabase.ts so the API works
// in production even if Vercel doesn't have these env vars set.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://demdzfziqwepowmlefvt.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbWR6ZnppcXdlcG93bWxlZnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTk5NDQsImV4cCI6MjA5MDU5NTk0NH0.g8XGmcUF-7c2fyK3xOS8jcSyQsWoTmu8nKIBPu690MY";
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

export async function POST(req: Request) {
  if (!vapidPublic || !vapidPrivate) {
    return NextResponse.json({ error: "VAPID keys not configured" }, { status: 500 });
  }

  const { userNames, title, body, url } = (await req.json()) as {
    userNames?: string[];
    title?: string;
    body?: string;
    url?: string;
  };

  if (!Array.isArray(userNames) || userNames.length === 0) {
    return NextResponse.json({ error: "userNames required" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, supabaseKey);
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_name", userNames);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = JSON.stringify({
    title: title || "WorkFlow Tracker",
    body: body || "",
    url: url || "/dashboard",
  });

  const results = await Promise.allSettled(
    (subs || []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        return { id: s.id, ok: true };
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err && "statusCode" in err
            ? Number((err as { statusCode: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
        return { id: s.id, ok: false, statusCode };
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
  return NextResponse.json({ sent, total: subs?.length ?? 0 });
}
