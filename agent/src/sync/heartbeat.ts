import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isapiRequest } from "../isapi/client";
import * as log from "../utils/logger";
import { withRetry } from "../utils/backoff";

export function startHeartbeat(
  config: Config,
  supabase: SupabaseClient,
  deviceSerial: string
): () => void {
  let isRunning = true;
  let consecutiveFailures = 0;

  async function heartbeat() {
    if (!isRunning) return;

    try {
      await withRetry(
        async () => {
          // Lightweight check: just hit the device info endpoint
          await isapiRequest(config, "/ISAPI/System/deviceInfo", "GET");

          // Update last_seen_at and status in Supabase
          const { error } = await supabase
            .from("devices")
            .update({
              last_seen_at: new Date().toISOString(),
              status: "online",
            })
            .eq("serial_number", deviceSerial);

          if (error) {
            throw new Error(`Supabase update failed: ${error.message}`);
          }

          consecutiveFailures = 0;
        },
        {
          maxAttempts: 3,
          onRetry: (attempt, delay) => {
            log.warn("heartbeat", `Retry ${attempt} in ${Math.round(delay)}ms`);
          },
        }
      );
    } catch (err) {
      consecutiveFailures++;
      log.error("heartbeat", `Heartbeat failed (${consecutiveFailures} consecutive failures)`, {
        err: err instanceof Error ? err : undefined,
      });

      // Mark offline after 2 consecutive failures (>120s)
      if (consecutiveFailures >= 2) {
        await supabase
          .from("devices")
          .update({ status: "offline" })
          .eq("serial_number", deviceSerial);
        log.warn("heartbeat", "Device marked as offline");
      }
    }
  }

  // Initial heartbeat
  heartbeat();

  // Schedule recurring heartbeat
  const interval = setInterval(heartbeat, config.heartbeatIntervalMs);

  // Return cleanup function
  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}
