import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeDoorCommand } from "./executeDoorCommand";
import * as log from "../utils/logger";

export function startCommandDispatcher(
  config: Config,
  supabase: SupabaseClient,
  deviceSerial: string
): () => void {
  let isRunning = true;

  async function pollCommands() {
    if (!isRunning) return;

    try {
      // Fetch pending commands for this device
      const { data: commands, error } = await supabase
        .from("door_commands")
        .select("*")
        .eq("status", "pending")
        .eq("device_serial", deviceSerial)
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) {
        log.error("dispatcher", `Failed to fetch commands: ${error.message}`);
        return;
      }

      if (!commands || commands.length === 0) {
        return; // No pending commands
      }

      log.info("dispatcher", `Processing ${commands.length} pending command(s)`);

      for (const cmd of commands) {
        if (!isRunning) break;

        const result = await executeDoorCommand(config, cmd);

        // Update command status
        const now = new Date().toISOString();
        const updateData = {
          status: result === "success" ? "completed" : "failed",
          completed_at: now,
          ...(result === "failed" ? { error_message: "ISAPI command failed" } : {}),
        };

        await supabase
          .from("door_commands")
          .update(updateData)
          .eq("id", cmd.id);

        log.info("dispatcher", `Command ${cmd.id} ${result}`, {
          action: cmd.action,
        });
      }
    } catch (err) {
      log.error("dispatcher", "Command polling failed", {
        err: err instanceof Error ? err : undefined,
      });
    }
  }

  // Schedule recurring poll
  const interval = setInterval(pollCommands, config.commandPollIntervalMs);

  // Return cleanup function
  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}
