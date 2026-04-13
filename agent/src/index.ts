import "dotenv/config";
import { loadConfig } from "./config";
import { getSupabase } from "./supabase";
import { registerDevice } from "./sync/registerDevice";
import { startHeartbeat } from "./sync/heartbeat";
import { startEventSync } from "./sync/syncEvents";
import { startDoorStatusPolling } from "./sync/pollDoorStatus";
import { startCommandDispatcher } from "./commands/dispatcher";
import { startPersonSync } from "./sync/persons";
import { setupErrorHandlers } from "./utils/errorHandler";
import { registerCleanup, gracefulShutdown } from "./utils/shutdown";
import * as log from "./utils/logger";

async function main() {
  // Set up global error handlers first
  setupErrorHandlers();

  // Load and validate configuration
  const config = loadConfig();
  log.setLogLevel(config.logLevel);

  log.info("agent", "Starting Agent Bridge...", {
    device: `${config.deviceIp}:${config.devicePort}`,
    logLevel: config.logLevel,
  });

  // Initialize Supabase client
  const supabase = getSupabase(config);

  // Step 1: Register device
  await registerDevice(config, supabase);

  // We need the device serial for subsequent loops
  // Fetch it from Supabase (it was just upserted)
  const { data: deviceRow } = await supabase
    .from("devices")
    .select("serial_number")
    .eq("ip_address", config.deviceIp)
    .single();

  if (!deviceRow) {
    log.error("agent", "Device not found after registration — exiting");
    process.exit(1);
  }

  const deviceSerial = deviceRow.serial_number as string;
  log.info("agent", `Using device: ${deviceSerial}`);

  // Step 2: Start all sync loops
  const stopHeartbeat = startHeartbeat(config, supabase, deviceSerial);
  registerCleanup(stopHeartbeat);

  const stopEventSync = startEventSync(config, supabase, deviceSerial);
  registerCleanup(stopEventSync);

  const stopDoorPoll = startDoorStatusPolling(config, deviceSerial);
  registerCleanup(stopDoorPoll);

  const stopDispatcher = startCommandDispatcher(config, supabase, deviceSerial);
  registerCleanup(stopDispatcher);

  const stopPersonSync = startPersonSync(config, supabase);
  registerCleanup(stopPersonSync);

  log.info("agent", "All modules started");

  // Step 3: Set up graceful shutdown
  process.on("SIGTERM", async () => {
    await gracefulShutdown(supabase, deviceSerial);
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    await gracefulShutdown(supabase, deviceSerial);
    process.exit(0);
  });
}

main().catch((err) => {
  log.error("agent", "Fatal startup error — exiting", { err });
  process.exit(1);
});
