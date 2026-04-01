import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://demdzfziqwepowmlefvt.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlbWR6ZnppcXdlcG93bWxlZnZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTk5NDQsImV4cCI6MjA5MDU5NTk0NH0.g8XGmcUF-7c2fyK3xOS8jcSyQsWoTmu8nKIBPu690MY";

export const supabase = createClient(supabaseUrl, supabaseKey);
