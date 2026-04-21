import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Config } from "./config";

let client: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Cliente con Service Role - para operaciones administrativas
 */
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

/**
 * Cliente con Anon Key - para operaciones que DEBEN disparar Realtime
 */
export function getSupabaseRealtime(config: Config): SupabaseClient {
  if (!anonClient) {
    anonClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anonClient;
}

export function resetSupabaseClient() {
  client = null;
  anonClient = null;
}
