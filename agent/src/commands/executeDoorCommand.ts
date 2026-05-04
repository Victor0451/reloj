import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { controlDoor, getDoorStatus } from "../isapi/methods";
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

    // Wait for door mechanism to settle
    await new Promise(resolve => setTimeout(resolve, 500));

    // Determine expected state
    const expectedState = command.action === 'open' ? 'open' : 'closed';

    // Verify state
    let doorStatus = await getDoorStatus(config, command.door_no);
    if (doorStatus.status !== expectedState) {
      // Retry once after settle
      await new Promise(resolve => setTimeout(resolve, 500));
      doorStatus = await getDoorStatus(config, command.door_no);
      if (doorStatus.status !== expectedState) {
        log.error("doorCommand", `Door state mismatch: expected ${expectedState}, got ${doorStatus.status}`, {
          commandId: command.id,
        });
        return "failed";
      }
    }

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
