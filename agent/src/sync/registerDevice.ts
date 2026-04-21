/**
 * Device Registration
 * Registra y configura dispositivos con sus adaptadores
 * Funciona en modo "offline" si el dispositivo no está accesible
 */

import type { Config } from "../config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HikvisionAdapter } from "../adapters/hikvision.adapter";
import * as log from "../utils/logger";

export interface DeviceRow {
  id: string;
  serial_number: string;
  name: string;
  model: string | null;
  brand: string;
  ip_address: string | null;
  firmware_version: string | null;
  status: string;
  last_seen_at: string | null;
  device_username: string | null;
  device_password_encrypted: string | null;
}

export async function registerDevice(
  config: Config,
  supabase: SupabaseClient
): Promise<DeviceRow> {
  log.info("registerDevice", "Attempting to connect to device...", {
    ip: config.deviceIp,
  });

  let deviceInfo = null;
  let isOnline = false;

  try {
    // Try to connect and get device info
    const adapter = new HikvisionAdapter({
      ip: config.deviceIp,
      port: config.devicePort,
      username: config.deviceUsername,
      password: config.devicePassword,
    });

    deviceInfo = await adapter.getDeviceInfo();
    isOnline = true;

    log.info("registerDevice", `Device online: ${deviceInfo.model} (SN: ${deviceInfo.serialNumber})`, {
      model: deviceInfo.model,
      firmware: deviceInfo.firmwareVersion,
    });

    await adapter.disconnect();
  } catch (err) {
    log.warn("registerDevice", `Device offline or unreachable: ${config.deviceIp}`, {
      error: (err as Error).message,
    });
    isOnline = false;
  }

  // Determine brand
  const brand = deviceInfo ? detectBrand(deviceInfo) : "hikvision";

  // Prepare device data - usar siempre el mismo serial para evitar duplicados
  const serialNumber = deviceInfo?.serialNumber || `Hik_${config.deviceIp.replace(/\./g, '_')}`;
  
  const deviceData = {
    serial_number: serialNumber,
    name: deviceInfo?.deviceName || `Device at ${config.deviceIp}`,
    model: deviceInfo?.model || null,
    brand: brand,
    firmware_version: deviceInfo?.firmwareVersion || null,
    ip_address: config.deviceIp,
    status: isOnline ? "online" : "offline",
    last_seen_at: isOnline ? new Date().toISOString() : null,
    device_username: config.deviceUsername,
    device_password_encrypted: config.devicePassword,
    sync_status: isOnline ? "synced" : "disconnected",
    updated_at: new Date().toISOString(),
  };

  // Upsert device into devices table
  const { data, error } = await (supabase as any)
    .from("devices")
    .upsert(deviceData, { onConflict: "serial_number" })
    .select()
    .single();

  if (error) {
    log.error("registerDevice", `Failed to register device: ${error.message}`, { err: error });
    throw error;
  }

  log.info("registerDevice", `Device registered: ${data.serial_number}`, {
    brand,
    status: data.status,
  });

  return data as DeviceRow;
}

/**
 * Detecta la marca del dispositivo basado en la información del mismo
 */
function detectBrand(deviceInfo: {
  model: string;
  manufacturer?: string;
}): string {
  const model = deviceInfo.model.toLowerCase();
  const manufacturer = (deviceInfo.manufacturer || "").toLowerCase();

  // Hikvision
  if (
    model.includes("hikvision") ||
    model.includes("ds-k1t") ||
    model.includes("ds-k2") ||
    manufacturer.includes("hikvision") ||
    model.startsWith("ds-")
  ) {
    return "hikvision";
  }

  // ZKTeco
  if (
    model.includes("zkteco") ||
    model.includes("zk") ||
    manufacturer.includes("zkteco")
  ) {
    return "zkteco";
  }

  // Suprema
  if (
    model.includes("suprema") ||
    model.includes("bioentry") ||
    manufacturer.includes("suprema")
  ) {
    return "suprema";
  }

  // Dahua
  if (
    model.includes("dahua") ||
    model.includes("asi") ||
    manufacturer.includes("dahua")
  ) {
    return "dahua";
  }

  // Por defecto, asumimos hikvision si no podemos determinar
  return "hikvision";
}

/**
 * Obtiene todos los dispositivos registrados
 */
export async function getAllDevices(supabase: SupabaseClient): Promise<DeviceRow[]> {
  const { data, error } = await (supabase as any)
    .from("devices")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    log.error("registerDevice", `Failed to fetch devices: ${error.message}`, { err: error });
    throw error;
  }

  return data as DeviceRow[];
}
