import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config";

let client: SupabaseClient | null = null;

export function getSupabase(config: Config): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return client;
}

export function resetSupabaseClient() {
  client = null;
}
