// Toggle between mock (local) and real Supabase
// Set USE_MOCK = true for local testing, false for Supabase
const USE_MOCK = false;

import { createClient } from "@supabase/supabase-js";
import { mockSupabase } from "./mockData";

const supabaseUrl = "https://zbbywejxdxacoftiqrut.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnl3ZWp4ZHhhY29mdGlxcnV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTg2MTgsImV4cCI6MjA5MDQzNDYxOH0.LSr_71U7kZAfOZf0xWOe_fxaRVNPSgM8JsjkHeszqTk";

const realSupabase = createClient(supabaseUrl, supabaseKey);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = USE_MOCK ? mockSupabase : realSupabase;
