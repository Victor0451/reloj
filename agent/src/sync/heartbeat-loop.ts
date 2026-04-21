/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Heartbeat Sync Loop
 * Mantiene el dispositivo "vivo" en la base de datos
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AdapterManager } from "../core/adapter-manager";
import * as log from "../utils/logger";

export interface HeartbeatOptions {
  /** Intervalo en ms (default 60000) */
  intervalMs?: number;
  /** Cantidad de fallos consecutivos antes de marcar offline (default 2) */
  maxConsecutiveFailures?: number;
  /** IP del dispositivo (para single device mode) */
  deviceIp?: string;
  /** Brand del dispositivo (para single device mode) */
  deviceBrand?: string;
  /** Username para autenticación */
  deviceUsername?: string;
  /** Password para autenticación */
  devicePassword?: string;
}

/**
 * Heartbeat Loop para múltiples dispositivos
 * Itera sobre todos los adaptadores activos en el AdapterManager
 */
export function startHeartbeatLoop(
  adapterManager: AdapterManager,
  supabase: SupabaseClient,
  options: HeartbeatOptions = {}
): () => void {
  const {
    intervalMs = 60000,
    maxConsecutiveFailures = 2,
  } = options;

  let isRunning = true;
  const failureCount = new Map<string, number>();

  async function heartbeat() {
    if (!isRunning) return;

    const devices = adapterManager.getActiveDevices();

    for (const deviceId of devices) {
      try {
        const adapter = adapterManager.getExistingAdapter(deviceId);
        if (!adapter) continue;

        // Enviar heartbeat
        await adapter.sendHeartbeat();

        // Actualizar DB
        const { error } = await (supabase as any)
          .from("devices")
          .update({
            last_seen_at: new Date().toISOString(),
            status: "online",
            sync_status: "synced",
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceId);

        if (error) {
          throw new Error(`Supabase update failed: ${error.message}`);
        }

        // Reset failure count
        failureCount.set(deviceId, 0);

        log.debug("heartbeat", `Heartbeat sent to device ${deviceId}`);
      } catch (err) {
        const failures = (failureCount.get(deviceId) || 0) + 1;
        failureCount.set(deviceId, failures);

        log.error("heartbeat", `Heartbeat failed for device ${deviceId}`, {
          consecutiveFailures: failures,
          err: err as Error,
        });

        // Mark offline after max consecutive failures
        if (failures >= maxConsecutiveFailures) {
          await (supabase as any)
            .from("devices")
            .update({
              status: "offline",
              sync_status: "disconnected",
              sync_error: err instanceof Error ? err.message : "Unknown error",
              updated_at: new Date().toISOString(),
            })
            .eq("id", deviceId);

          log.warn("heartbeat", `Device ${deviceId} marked as offline`);
        }
      }
    }
  }

  // Initial heartbeat
  heartbeat();

  // Schedule recurring heartbeat
  const interval = setInterval(heartbeat, intervalMs);

  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}

/**
 * Heartbeat para un dispositivo específico (single device mode)
 */
export function startSingleDeviceHeartbeat(
  adapterManager: AdapterManager,
  deviceId: string,
  deviceSerial: string,
  supabase: SupabaseClient,
  options: HeartbeatOptions = {}
): () => void {
  const {
    intervalMs = 15000, // Reducido a 15s para detectar offline más rápido
    maxConsecutiveFailures = 2,
    deviceIp,
    deviceBrand = "hikvision",
    deviceUsername,
    devicePassword,
  } = options;

  let consecutiveFailures = 0;

  async function heartbeat() {
    const timestamp = new Date().toISOString();

    try {
      // Crear adapter fresco cada vez (no usar cache si está offline)
      const adapter = await adapterManager.getAdapter({
        id: deviceId,
        serialNumber: deviceSerial,
        ip: deviceIp || "192.168.1.175",
        brand: deviceBrand,
        username: deviceUsername,
        password: devicePassword,
      });

      // Hacer healthCheck directo
      const health = await adapter.healthCheck();

      if (!health.reachable) {
        throw new Error(health.error || "Device unreachable");
      }

      // Update with timestamp to trigger Realtime
      const { error } = await (supabase as any)
        .from("devices")
        .update({
          last_seen_at: timestamp,
          status: "online",
          sync_status: "synced",
          sync_error: null,
          updated_at: timestamp,
        })
        .eq("id", deviceId);

      if (error) {
        throw new Error(`DB update failed: ${error.message}`);
      }

      consecutiveFailures = 0;
      log.debug("heartbeat", `Device online: ${deviceSerial}`, { 
        deviceId, 
        brand: deviceBrand,
        latency: health.latency 
      });
    } catch (err) {
      consecutiveFailures++;

      log.warn("heartbeat", `Heartbeat failed (${consecutiveFailures}/${maxConsecutiveFailures})`, {
        deviceId,
        brand: deviceBrand,
        error: (err as Error).message,
      });

      // Limpiar adapter cache para forzar reconnect
      await adapterManager.removeAdapter(deviceId).catch(() => {});

      if (consecutiveFailures >= maxConsecutiveFailures) {
        await (supabase as any)
          .from("devices")
          .update({
            status: "offline",
            sync_status: "disconnected",
            sync_error: (err as Error).message,
            updated_at: timestamp,
          })
          .eq("id", deviceId);

        log.warn("heartbeat", `Device marked OFFLINE: ${deviceSerial}`, { 
          deviceId,
          brand: deviceBrand,
        });
      }
    }
  }

  // Primer heartbeat inmediato
  heartbeat();

  const interval = setInterval(heartbeat, intervalMs);

  log.info("heartbeat", `Heartbeat loop started`, { 
    deviceId, 
    brand: deviceBrand,
    intervalMs,
    maxFailures: maxConsecutiveFailures,
  });

  return () => {
    clearInterval(interval);
    log.info("heartbeat", `Heartbeat loop stopped`, { deviceId });
  };
}
