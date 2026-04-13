import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";

let cleanupFns: Array<() => void> = [];

/**
 * Register a cleanup function for graceful shutdown.
 */
export function registerCleanup(fn: () => void) {
  cleanupFns.push(fn);
}

/**
 * Execute all registered cleanup functions.
 */
export async function gracefulShutdown(
  supabase: SupabaseClient,
  deviceSerial: string
): Promise<void> {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      module: "shutdown",
      msg: "Shutting down agent...",
    })
  );

  // Stop all sync loops
  for (const fn of cleanupFns) {
    try {
      fn();
    } catch (err) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          module: "shutdown",
          msg: "Cleanup function failed",
          err: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }

  cleanupFns = [];

  // Mark device as offline on shutdown
  try {
    await supabase
      .from("devices")
      .update({ status: "offline" })
      .eq("serial_number", deviceSerial);
  } catch {
    // Ignore — agent is shutting down anyway
  }

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      module: "shutdown",
      msg: "Agent stopped.",
    })
  );
}
