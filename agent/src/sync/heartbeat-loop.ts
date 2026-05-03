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
  /** Permite certificados autofirmados o expirados */
  allowSelfSignedCert?: boolean;
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

// ─── Circuit Breaker Constants ───────────────────────────────────────────────

const PROBE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RESET_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const MAX_CONSECUTIVE_FAILURES = 3; // failures before opening circuit

/**
 * Heartbeat para un dispositivo específico (single device mode)
 * Implements circuit breaker pattern to prevent continuous polling of failing devices
 */
export function startSingleDeviceHeartbeat(
  adapterManager: AdapterManager,
  deviceId: string,
  deviceSerial: string,
  supabase: SupabaseClient,
  options: HeartbeatOptions = {}
): () => void {
  const {
    intervalMs = 15000,
    deviceIp,
    deviceBrand = "hikvision",
    deviceUsername,
    devicePassword,
    allowSelfSignedCert = false,
  } = options;

  async function heartbeat() {
    const timestamp = new Date().toISOString();
    const now = new Date();

    // Get current circuit state
    let circuitState = adapterManager.getCircuitState(deviceId);

    // Initialize circuit state if not exists — read from DB for restart recovery
    if (!circuitState) {
      // Query DB for persisted circuit state
      const { data: deviceData } = await (supabase as any)
        .from("devices")
        .select("circuit_state")
        .eq("id", deviceId)
        .single();

      const persistedState = deviceData?.circuit_state || "closed";
      const nowTime = new Date();

      if (persistedState === "open") {
        // Device was OPEN — probe immediately on restart
        circuitState = {
          state: "half_open",
          failureCount: 0,
          lastFailureTime: nowTime,
          nextProbeTime: nowTime, // probe immediately
        };
        log.info("heartbeat", `Circuit restored from DB - starting as HALF_OPEN: ${deviceSerial}`, { deviceId });
      } else if (persistedState === "half_open") {
        // Device was HALF_OPEN — continue probing
        circuitState = {
          state: "half_open",
          failureCount: 0,
          lastFailureTime: nowTime,
          nextProbeTime: nowTime, // probe immediately
        };
        log.info("heartbeat", `Circuit restored from DB - HALF_OPEN: ${deviceSerial}`, { deviceId });
      } else {
        // Default to CLOSED
        circuitState = {
          state: "closed",
          failureCount: 0,
          lastFailureTime: nowTime,
          nextProbeTime: nowTime,
        };
      }
      adapterManager.setCircuitState(deviceId, circuitState);
    }

    // Auto-reset: if OPEN/HALF_OPEN for more than 30 minutes, force close
    if (
      (circuitState.state === "open" || circuitState.state === "half_open") &&
      now.getTime() - circuitState.lastFailureTime.getTime() > RESET_TIMEOUT_MS
    ) {
      circuitState = {
        state: "closed",
        failureCount: 0,
        lastFailureTime: now,
        nextProbeTime: now,
      };
      adapterManager.setCircuitState(deviceId, circuitState);
      log.warn("heartbeat", `Circuit auto-reset after timeout: ${deviceSerial}`, { deviceId });
    }

    // Skip heartbeat if circuit is OPEN and probe time hasn't arrived
    if (circuitState.state === "open" && now.getTime() < circuitState.nextProbeTime.getTime()) {
      log.debug("heartbeat", `Circuit OPEN - skipping heartbeat until probe time: ${deviceSerial}`, {
        deviceId,
        nextProbeIn: circuitState.nextProbeTime.getTime() - now.getTime(),
      });
      return;
    }

    try {
      // Create adapter fresh each time
      const adapter = await adapterManager.getAdapter({
        id: deviceId,
        serialNumber: deviceSerial,
        ip: deviceIp || "192.168.1.175",
        brand: deviceBrand,
        username: deviceUsername,
        password: devicePassword,
        allowSelfSignedCert,
      });

      // Send heartbeat probe
      const health = await adapter.healthCheck();

      if (!health.reachable) {
        throw new Error(health.error || "Device unreachable");
      }

      // Heartbeat succeeded - update circuit state based on current state
      if (circuitState.state === "half_open") {
        // Probe succeeded in HALF_OPEN → transition to CLOSED
        circuitState = {
          state: "closed",
          failureCount: 0,
          lastFailureTime: now,
          nextProbeTime: now,
        };
        log.info("heartbeat", `Device recovered: ${deviceSerial}`, { deviceId });
      } else if (circuitState.state === "closed") {
        // Normal operation - just reset failure count
        circuitState = {
          state: "closed",
          failureCount: 0,
          lastFailureTime: now,
          nextProbeTime: now,
        };
      }

      adapterManager.setCircuitState(deviceId, circuitState);

      // Update DB with online status and circuit_state
      const { error } = await (supabase as any)
        .from("devices")
        .update({
          last_seen_at: timestamp,
          status: "online",
          sync_status: "synced",
          sync_error: null,
          circuit_state: circuitState.state,
          updated_at: timestamp,
        })
        .eq("id", deviceId);

      if (error) {
        throw new Error(`DB update failed: ${error.message}`);
      }

      log.debug("heartbeat", `Device online: ${deviceSerial}`, {
        deviceId,
        brand: deviceBrand,
        latency: health.latency,
        circuitState: circuitState.state,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;

      // Increment failure count
      circuitState.failureCount++;
      circuitState.lastFailureTime = now;

      // Clean adapter cache to force reconnect
      await adapterManager.removeAdapter(deviceId).catch(() => {});

      if (circuitState.failureCount >= MAX_CONSECUTIVE_FAILURES && circuitState.state === "closed") {
        // Transition to OPEN
        circuitState.state = "open";
        circuitState.nextProbeTime = new Date(now.getTime() + PROBE_INTERVAL_MS);

        log.warn("heartbeat", `Circuit OPEN: ${deviceSerial}`, {
          deviceId,
          brand: deviceBrand,
          nextProbeIn: PROBE_INTERVAL_MS,
        });
      } else if (circuitState.state === "half_open") {
        // Probe failed in HALF_OPEN → back to OPEN
        circuitState.state = "open";
        circuitState.nextProbeTime = new Date(now.getTime() + PROBE_INTERVAL_MS);

        log.warn("heartbeat", `Circuit re-OPENED after probe failure: ${deviceSerial}`, {
          deviceId,
          nextProbeIn: PROBE_INTERVAL_MS,
        });
      } else if (circuitState.state === "open") {
        // Still in OPEN, update next probe time
        circuitState.nextProbeTime = new Date(now.getTime() + PROBE_INTERVAL_MS);

        log.warn("heartbeat", `Circuit still OPEN - will retry: ${deviceSerial}`, {
          deviceId,
          nextProbeIn: PROBE_INTERVAL_MS,
        });
      }

      adapterManager.setCircuitState(deviceId, circuitState);

      // Update DB with error status
      await (supabase as any)
        .from("devices")
        .update({
          status: "offline",
          sync_status: "disconnected",
          sync_error: errorMessage,
          circuit_state: circuitState.state,
          updated_at: timestamp,
        })
        .eq("id", deviceId);

      log.warn("heartbeat", `Heartbeat failed (${circuitState.failureCount}/${MAX_CONSECUTIVE_FAILURES}): ${deviceSerial}`, {
        deviceId,
        brand: deviceBrand,
        error: errorMessage,
        circuitState: circuitState.state,
      });
    }
  }

  // Primer heartbeat inmediato
  heartbeat();

  const interval = setInterval(heartbeat, intervalMs);

  log.info("heartbeat", `Heartbeat loop started with circuit breaker`, {
    deviceId,
    brand: deviceBrand,
    intervalMs,
    maxFailures: MAX_CONSECUTIVE_FAILURES,
    probeIntervalMs: PROBE_INTERVAL_MS,
    resetTimeoutMs: RESET_TIMEOUT_MS,
  });

  return () => {
    clearInterval(interval);
    log.info("heartbeat", `Heartbeat loop stopped`, { deviceId });
  };
}
