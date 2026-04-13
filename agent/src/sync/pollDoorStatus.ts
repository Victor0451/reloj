import type { Config } from "../config";
import { getDoorStatus } from "../isapi/methods";
import * as log from "../utils/logger";
import { withRetry } from "../utils/backoff";

export function startDoorStatusPolling(
  config: Config,
  deviceSerial: string
): () => void {
  let isRunning = true;
  let lastKnownStatus: string | null = null;

  async function pollDoorStatus() {
    if (!isRunning) return;

    try {
      await withRetry(
        async () => {
          const result = await getDoorStatus(config);

          if (result.status !== lastKnownStatus) {
            log.info("doorStatus", `Door status changed: ${lastKnownStatus ?? "initial"} → ${result.status}`, {
              doorNo: result.doorNo,
              serial: deviceSerial,
            });
            lastKnownStatus = result.status;
          }

          log.debug("doorStatus", `Door status: ${result.status}`);
        },
        {
          maxAttempts: 2,
          onRetry: (attempt, delay) => {
            log.warn("doorStatus", `Retry ${attempt} in ${Math.round(delay)}ms`);
          },
        }
      );
    } catch (err) {
      log.error("doorStatus", "Door status polling failed", {
        err: err instanceof Error ? err : undefined,
      });
      // Don't crash — just log and continue
    }
  }

  // Initial poll
  pollDoorStatus();

  // Schedule recurring poll
  const interval = setInterval(pollDoorStatus, config.doorPollIntervalMs);

  // Return cleanup function
  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}
