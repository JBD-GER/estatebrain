import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Server configuration unavailable");
  return createClient<Database>(getSupabaseConfig().url, secret, {auth: {persistSession: false, autoRefreshToken: false}});
}
