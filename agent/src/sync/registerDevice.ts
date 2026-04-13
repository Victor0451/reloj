import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeviceInfo } from "../isapi/methods";
import * as log from "../utils/logger";

export async function registerDevice(
  config: Config,
  supabase: SupabaseClient
): Promise<void> {
  log.info("registerDevice", "Fetching device info...");

  const deviceInfo = await getDeviceInfo(config);

  log.info("registerDevice", `Device found: ${deviceInfo.model} (SN: ${deviceInfo.serialNumber})`, {
    model: deviceInfo.model,
    firmware: deviceInfo.firmwareVersion,
  });

  // Upsert device into devices table
  const { error } = await supabase
    .from("devices")
    .upsert(
      {
        serial_number: deviceInfo.serialNumber,
        name: deviceInfo.deviceName,
        model: deviceInfo.model,
        firmware_version: deviceInfo.firmwareVersion,
        ip_address: config.deviceIp,
        status: "online",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "serial_number" }
    )
    .select()
    .single();

  if (error) {
    log.error("registerDevice", `Failed to register device: ${error.message}`, { err: error });
    throw error;
  }

  log.info("registerDevice", `Device registered: ${deviceInfo.serialNumber}`);
}
