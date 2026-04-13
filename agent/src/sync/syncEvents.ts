import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAcsEvents } from "../isapi/methods";
import { EventDeduplicator } from "./dedup";
import * as log from "../utils/logger";
import { withRetry } from "../utils/backoff";

export function startEventSync(
  config: Config,
  supabase: SupabaseClient,
  deviceSerial: string
): () => void {
  let isRunning = true;
  let lastSyncedTime = new Date(Date.now() - 300000); // Start 5 min ago as safety window
  const dedup = new EventDeduplicator();

  async function syncEvents() {
    if (!isRunning) return;

    try {
      await withRetry(
        async () => {
          const now = new Date();

          // Fetch events from last sync
          const events = await getAcsEvents(config, {
            startTime: lastSyncedTime.toISOString(),
            endTime: now.toISOString(),
            maxResults: 200,
          });

          log.debug("syncEvents", `Fetched ${events.length} events from device`);

          let inserted = 0;
          let skipped = 0;

          for (const event of events) {
            // Dedup check
            if (dedup.isDuplicate(event)) {
              skipped++;
              continue;
            }

            // Insert into Supabase
            const { error } = await supabase.from("access_events").insert({
              device_serial: deviceSerial,
              employee_id: event.employeeId,
              event_time: event.eventTime,
              major: event.major,
              minor: event.minor,
              event_type: event.eventType,
              verify_mode: event.verifyMode,
              raw_payload: event.raw,
              synced_at: new Date().toISOString(),
            });

            if (error) {
              log.error("syncEvents", `Failed to insert event: ${error.message}`, {
                event,
                err: error,
              });
              // Don't throw — log and continue with next event
              skipped++;
              continue;
            }

            inserted++;
          }

          // Update cursor only after successful processing
          lastSyncedTime = now;

          if (inserted > 0 || skipped > 0) {
            log.info("syncEvents", `Synced: ${inserted} inserted, ${skipped} skipped (dedup: ${dedup.size} keys tracked)`);
          }
        },
        {
          maxAttempts: 3,
          onRetry: (attempt, delay) => {
            log.warn("syncEvents", `Retry ${attempt} in ${Math.round(delay)}ms`);
          },
        }
      );
    } catch (err) {
      log.error("syncEvents", "Event sync failed after retries", {
        err: err instanceof Error ? err : undefined,
      });
    }
  }

  // Initial sync
  syncEvents();

  // Schedule recurring sync
  const interval = setInterval(syncEvents, config.pollIntervalMs);

  // Return cleanup function
  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}
