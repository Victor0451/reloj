/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import "./adapters/hikvision.adapter"; // Side-effect: registers HikvisionAdapter
import { loadConfig } from "./config";
import { getSupabase, getSupabaseRealtime } from "./supabase";
import { getAdapterManager } from "./core/adapter-manager";
import { setupErrorHandlers } from "./utils/errorHandler";
import { registerCleanup } from "./utils/shutdown";
import * as log from "./utils/logger";

// ─── Sync Loops (Refactorizados con Adaptadores) ────────────────────────────

import { startSingleDeviceHeartbeat } from "./sync/heartbeat-loop";
import { startSingleDeviceEventSync } from "./sync/event-sync-loop";
import { startSingleDevicePersonSync } from "./sync/person-sync-loop";
import { startCommandDispatcher } from "./commands/dispatcher";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeviceFromDB {
  id: string;
  serial_number: string;
  name: string;
  brand: string | null;
  ip_address: string | null;
  device_username: string | null;
  device_password_encrypted: string | null;
  status: string;
}

interface DeviceReadiness {
  ready: DeviceFromDB[];
  skipped: Array<{ name: string; id: string; reason: string }>;
}

// ─── Fetch all devices from DB ───────────────────────────────────────────────

async function fetchAllDevices(supabase: any): Promise<DeviceReadiness> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, serial_number, name, brand, ip_address, device_username, device_password_encrypted, status")
    .order("name", { ascending: true });

  if (error) {
    log.error("agent", "Failed to fetch devices", { error: error.message });
    return { ready: [], skipped: [] };
  }

  const rows = (data || []) as DeviceFromDB[];
  const ready: DeviceFromDB[] = [];
  const skipped: Array<{ name: string; id: string; reason: string }> = [];

  for (const device of rows) {
    const missing: string[] = [];
    if (!device.ip_address) missing.push("ip_address");
    if (!device.device_username) missing.push("device_username");
    if (!device.device_password_encrypted) missing.push("device_password_encrypted");

    if (missing.length > 0) {
      skipped.push({
        id: device.id,
        name: device.name,
        reason: `missing ${missing.join(", ")}`,
      });
      continue;
    }

    ready.push(device);
  }

  return { ready, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Set up error handlers
  setupErrorHandlers();

  // Load configuration
  const config = loadConfig();
  log.setLogLevel(config.logLevel);

  log.info("agent", "Starting Agent Bridge (Multi-Device Mode)...", {
    mode: "multi-brand",
  });

  // Initialize Supabase clients
  const supabaseAdmin = getSupabase(config);
  const supabaseRealtime = getSupabaseRealtime(config);

  // Initialize Adapter Manager
  const adapterManager = getAdapterManager();

  // Fetch all online devices from database
  log.info("agent", "Fetching devices from database...");
  const { ready: devices, skipped } = await fetchAllDevices(supabaseAdmin);

  if (devices.length === 0) {
    log.warn("agent", "No ready devices found in database. Waiting...");
    if (skipped.length > 0) {
      log.info("agent", "Some devices were skipped due to incomplete readiness", {
        skipped: skipped.map((s) => `${s.name} (${s.reason})`).join("; "),
      });
    }
    log.info("agent", "Add devices via the frontend or complete device connection settings.");
  } else {
    log.info("agent", `Found ${devices.length} device(s) to manage`, {
      devices: devices.map(d => `${d.name} (${d.ip_address})`).join(", ")
    });
    if (skipped.length > 0) {
      log.info("agent", `Skipped ${skipped.length} device(s) with incomplete config`, {
        skipped: skipped.map((s) => `${s.name} (${s.reason})`).join("; "),
      });
    }
  }

  // Start sync loops for each device
  for (const device of devices) {
    const deviceId = device.id;
    const deviceSerial = device.serial_number;
    const deviceIp = device.ip_address!;
    const deviceUsername = device.device_username || "admin";
    const devicePassword = device.device_password_encrypted || "";
    const deviceBrand = device.brand || "hikvision";

    log.info("agent", `Setting up sync loops for: ${device.name}`, {
      ip: deviceIp,
      brand: deviceBrand,
    });

    // ── Heartbeat Loop ───────────────────────────────────────────────
    const stopHeartbeat = startSingleDeviceHeartbeat(
      adapterManager,
      deviceId,
      deviceSerial,
      supabaseRealtime,
      {
        intervalMs: config.heartbeatIntervalMs,
        deviceIp,
        deviceBrand,
        deviceUsername,
        devicePassword,
      }
    );
    registerCleanup(stopHeartbeat);

    // ── Event Sync Loop ────────────────────────────────────────────
    const stopEventSync = startSingleDeviceEventSync(
      adapterManager,
      deviceId,
      deviceSerial,
      supabaseRealtime,
      {
        intervalMs: config.pollIntervalMs,
        maxResults: 200,
        safetyWindowMs: 300000,
        deviceIp,
        deviceBrand,
        deviceUsername,
        devicePassword,
      }
    );
    registerCleanup(stopEventSync);

    // ── Person Sync Loop ──────────────────────────────────────────
    const stopPersonSync = startSingleDevicePersonSync(
      adapterManager,
      deviceId,
      deviceSerial,
      supabaseAdmin,
      {
        intervalMs: 15000,
        batchSize: 50,
        deviceIp,
        deviceBrand,
        deviceUsername,
        devicePassword,
      }
    );
    registerCleanup(stopPersonSync);

    // ── Command Dispatcher Loop ──────────────────────────────────
    const stopCommandDispatcher = startCommandDispatcher(
      config,
      supabaseRealtime,
      deviceSerial
    );
    registerCleanup(stopCommandDispatcher);
  }

  log.info("agent", "All sync loops started", {
    deviceCount: devices.length,
    heartbeat: config.heartbeatIntervalMs,
    eventSync: config.pollIntervalMs,
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    log.info("shutdown", "Shutting down agent...");
    await adapterManager.disconnectAll();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    log.info("shutdown", "Shutting down agent...");
    await adapterManager.disconnectAll();
    process.exit(0);
  });
}

main().catch((err) => {
  log.error("agent", "Fatal startup error", { err });
  process.exit(1);
});
