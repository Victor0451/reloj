import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { controlDoor } from "../isapi/methods";
import * as log from "../utils/logger";
import { withRetry } from "../utils/backoff";

export interface DoorCommand {
  id: string;
  device_id: string;
  door_no: number;
  action: "open" | "close" | "alwaysopen" | "alwaysclose";
  status: "pending" | "completed" | "failed";
  error_message?: string;
}

/**
 * Execute a single door command via ISAPI.
 */
export async function executeDoorCommand(
  config: Config,
  command: DoorCommand
): Promise<"success" | "failed"> {
  const action = command.action;

  log.info("doorCommand", `Executing ${action} on door ${command.door_no}`, {
    commandId: command.id,
  });

  try {
    await withRetry(
      async () => {
        await controlDoor(config, command.door_no, action);
      },
      {
        maxAttempts: 2,
        onRetry: (attempt, delay) => {
          log.warn("doorCommand", `Retry ${attempt} in ${Math.round(delay)}ms`);
        },
      }
    );

    log.info("doorCommand", `Command completed: ${action}`);
    return "success";
  } catch (err) {
    log.error("doorCommand", `Command failed: ${action}`, {
      err: err instanceof Error ? err : undefined,
      commandId: command.id,
    });
    return "failed";
  }
}
