/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Event Sync Loop
 * Obtiene eventos de acceso desde el dispositivo y los guarda en la DB
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AdapterManager } from "../core/adapter-manager";
import * as log from "../utils/logger";

export interface EventSyncOptions {
  /** Intervalo en ms (default 30000) */
  intervalMs?: number;
  /** Máxima cantidad de eventos a obtener por sync (default 200) */
  maxResults?: number;
  /** Ventana de tiempo de seguridad en ms (default 300000 = 5 min) */
  safetyWindowMs?: number;
  /** IP del dispositivo (para single device mode) */
  deviceIp?: string;
  /** Brand del dispositivo (para single device mode) */
  deviceBrand?: string;
  /** Username para autenticación */
  deviceUsername?: string;
  /** Password para autenticación */
  devicePassword?: string;
}

interface SyncState {
  lastSyncTime: Date;
  dedupKeys: Set<string>;
}

/**
 * Event Sync para múltiples dispositivos
 */
export function startEventSyncLoop(
  adapterManager: AdapterManager,
  supabase: SupabaseClient,
  options: EventSyncOptions = {}
): () => void {
  const {
    intervalMs = 30000,
    maxResults = 200,
    safetyWindowMs = 300000,
  } = options;

  let isRunning = true;
  const deviceStates = new Map<string, SyncState>();

  async function syncEvents() {
    if (!isRunning) return;

    const devices = adapterManager.getActiveDevices();

    for (const deviceId of devices) {
      try {
        const adapter = adapterManager.getExistingAdapter(deviceId);
        if (!adapter) continue;

        await (supabase as any)
          .from("devices")
          .update({
            sync_status: "syncing",
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceId);

        let state = deviceStates.get(deviceId);
        if (!state) {
          state = {
            lastSyncTime: new Date(Date.now() - safetyWindowMs),
            dedupKeys: new Set<string>(),
          };
          deviceStates.set(deviceId, state);
        }

        const events = await adapter.getEvents({
          startTime: state.lastSyncTime,
          maxResults,
        });

        if (events.length === 0) {
          // No new events - still update sync status
          await (supabase as any)
            .from("devices")
            .update({
              sync_status: "synced",
              sync_last_at: new Date().toISOString(),
              sync_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", deviceId);
          continue;
        }

        log.info("eventSync", `Fetched ${events.length} events from device ${deviceId}`);

        let inserted = 0;
        let skipped = 0;

        for (const event of events) {
          const dedupKey = `${event.employeeId}-${event.eventTime.getTime()}`;
          if (state.dedupKeys.has(dedupKey)) {
            skipped++;
            continue;
          }

          state.dedupKeys.add(dedupKey);

          if (state.dedupKeys.size > 1000) {
            const keysArray = Array.from(state.dedupKeys);
            state.dedupKeys = new Set(keysArray.slice(-500));
          }

          const { error } = await (supabase as any)
            .from("access_events")
            .insert({
              device_serial: deviceId,
              employee_id: event.employeeId,
              event_time: event.eventTime,
              major: event.major,
              minor: event.minor,
              event_type: event.eventType,
              verify_mode: event.verifyMode,
              raw_payload: event.raw,
              synced_at: new Date().toISOString(),
            });

          if (error) {
            log.error("eventSync", `Failed to insert event`, { error: error.message });
            skipped++;
          } else {
            inserted++;
          }
        }

        state.lastSyncTime = new Date();

        if (inserted > 0 || skipped > 0) {
          log.info("eventSync", `Device ${deviceId}: ${inserted} inserted, ${skipped} skipped`);
        }

        await (supabase as any)
          .from("devices")
          .update({
            sync_status: "synced",
            sync_last_at: new Date().toISOString(),
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        
        // Only mark as error for real failures, not "not available"
        const isRealError = !errorMessage.includes("not available");
        
        log.error("eventSync", `Event sync failed for device ${deviceId}`, { err: err as Error });

        if (isRealError) {
          await (supabase as any)
            .from("devices")
            .update({
              sync_status: "error",
              sync_error: errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", deviceId);
        }
      }
    }
  }

  syncEvents();
  const interval = setInterval(syncEvents, intervalMs);

  log.info("eventSync", `Event sync loop started (multi-device mode)`, { intervalMs });

  return () => {
    isRunning = false;
    clearInterval(interval);
    log.info("eventSync", `Event sync loop stopped`);
  };
}

/**
 * Event Sync para un dispositivo específico (single device mode)
 */
export function startSingleDeviceEventSync(
  adapterManager: AdapterManager,
  deviceId: string,
  deviceSerial: string,
  supabase: SupabaseClient,
  options: EventSyncOptions = {}
): () => void {
  const {
    intervalMs = 30000,
    maxResults = 200,
    safetyWindowMs = 300000,
    deviceIp,
    deviceBrand = "hikvision",
    deviceUsername,
    devicePassword,
  } = options;

  let isRunning = true;
  let lastSyncTime = new Date(Date.now() - safetyWindowMs);
  const dedupKeys = new Set<string>();

  async function syncEvents() {
    if (!isRunning) return;

    try {
      await (supabase as any)
        .from("devices")
        .update({
          sync_status: "syncing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", deviceId);

      const adapter = await adapterManager.getAdapter({
        id: deviceId,
        serialNumber: deviceSerial,
        ip: deviceIp || "192.168.1.175",
        brand: deviceBrand,
        username: deviceUsername,
        password: devicePassword,
      });

      const events = await adapter.getEvents({
        startTime: lastSyncTime,
        maxResults,
      });

      if (events.length === 0) {
        // No new events - update status anyway
        await (supabase as any)
          .from("devices")
          .update({
            sync_status: "synced",
            sync_last_at: new Date().toISOString(),
            sync_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceId);
        return;
      }

      log.info("eventSync", `Fetched ${events.length} events`, { deviceId, brand: deviceBrand });

      let inserted = 0;
      let skipped = 0;

      for (const event of events) {
        const dedupKey = `${event.employeeId}-${event.eventTime.getTime()}`;
        if (dedupKeys.has(dedupKey)) {
          skipped++;
          continue;
        }

        dedupKeys.add(dedupKey);

        if (dedupKeys.size > 1000) {
          const keysArray = Array.from(dedupKeys);
          dedupKeys.clear();
          keysArray.slice(-500).forEach((k) => dedupKeys.add(k));
        }

        const { error } = await (supabase as any)
          .from("access_events")
          .insert({
            device_serial: deviceSerial,
            employee_id: event.employeeId,
            event_time: event.eventTime,
            major: event.major,
            minor: event.minor,
            event_type: event.eventType,
            verify_mode: event.verifyMode,
            raw_payload: event.raw,
            synced_at: new Date().toISOString(),
          });

        if (error) {
          log.error("eventSync", "Failed to insert event", { error: error.message });
          skipped++;
        } else {
          inserted++;
        }
      }

      lastSyncTime = new Date();

      if (inserted > 0) {
        log.info("eventSync", `${inserted} events inserted, ${skipped} skipped`, { deviceId });
      }

      await (supabase as any)
        .from("devices")
        .update({
          sync_status: "synced",
          sync_last_at: new Date().toISOString(),
          sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deviceId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      
      // Only mark as error for real failures
      const isRealError = !errorMessage.includes("not available");
      
      log.error("eventSync", "Event sync failed", { deviceId, err: err as Error });

      if (isRealError) {
        await (supabase as any)
          .from("devices")
          .update({
            sync_status: "error",
            sync_error: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deviceId);
      }
    }
  }

  syncEvents();
  const interval = setInterval(syncEvents, intervalMs);

  log.info("eventSync", `Event sync loop started`, { 
    deviceId, 
    brand: deviceBrand, 
    intervalMs,
    maxResults,
    safetyWindowMs 
  });

  return () => {
    isRunning = false;
    clearInterval(interval);
    log.info("eventSync", `Event sync loop stopped`, { deviceId, brand: deviceBrand });
  };
}
