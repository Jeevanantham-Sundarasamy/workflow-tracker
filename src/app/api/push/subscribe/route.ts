import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://demdzfziqwepowmlefvt.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbWR6ZnppcXdlcG93bWxlZnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTk5NDQsImV4cCI6MjA5MDU5NTk0NH0.g8XGmcUF-7c2fyK3xOS8jcSyQsWoTmu8nKIBPu690MY";

export async function POST(req: Request) {
  const { userName, subscription, userAgent } = (await req.json()) as {
    userName?: string;
    subscription?: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    userAgent?: string;
  };

  if (!userName || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: "userName and subscription required" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, supabaseKey);

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_name: userName,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent || null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "endpoint required" }, { status: 400 });

  const admin = createClient(supabaseUrl, supabaseKey);
  const { error } = await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
