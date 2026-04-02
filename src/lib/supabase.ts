// Toggle between mock (local) and real Supabase
// Set USE_MOCK = true for local testing, false for Supabase
const USE_MOCK = false;

import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "./mockData";

const supabaseUrl = "https://demdzfziqwepowmlefvt.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbWR6ZnppcXdlcG93bWxlZnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTk5NDQsImV4cCI6MjA5MDU5NTk0NH0.g8XGmcUF-7c2fyK3xOS8jcSyQsWoTmu8nKIBPu690MY";

const realSupabase = createClient(supabaseUrl, supabaseKey);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = USE_MOCK ? mockSupabase : realSupabase;
