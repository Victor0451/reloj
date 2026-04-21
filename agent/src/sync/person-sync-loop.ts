/**
 * Person Sync Loop
 * Sincroniza personas entre la DB y el dispositivo
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { AdapterManager } from "../core/adapter-manager";
import { Person } from "../core/interfaces";
import * as log from "../utils/logger";

export interface PersonSyncOptions {
  /** Intervalo en ms (default 15000) */
  intervalMs?: number;
  /** Cantidad de personas a procesar por ciclo (default 50) */
  batchSize?: number;
  /** IP del dispositivo (para single device mode) */
  deviceIp?: string;
  /** Brand del dispositivo (para single device mode) */
  deviceBrand?: string;
  /** Username para autenticación */
  deviceUsername?: string;
  /** Password para autenticación */
  devicePassword?: string;
}

interface PendingPerson {
  id: string;
  employee_id: string | null;
  name: string;
  department: string | null;
  card_number: string | null;
  face_photo_url: string | null;
  device_employee_no: number | null;
  status: string;
}

export function startPersonSyncLoop(
  adapterManager: AdapterManager,
  supabase: SupabaseClient,
  options: PersonSyncOptions = {}
): () => void {
  const { intervalMs = 15000, batchSize = 50 } = options;

  let isRunning = true;

  async function syncPersons() {
    if (!isRunning) return;

    const devices = adapterManager.getActiveDevices();

    for (const deviceId of devices) {
      try {
        const adapter = adapterManager.getExistingAdapter(deviceId);
        if (!adapter) continue;

        // 1. Sincronizar personas pendientes
        await syncPendingPersons(adapter, supabase, deviceId, batchSize);

        // 2. Limpiar personas inactivas
        await cleanupInactivePersons(adapter, supabase, deviceId);
      } catch (err) {
        log.error("personSync", `Person sync failed for device ${deviceId}`, {
          err: err as Error,
        });
      }
    }
  }

  syncPersons();
  const interval = setInterval(syncPersons, intervalMs);

  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}

async function syncPendingPersons(
  adapter: Awaited<ReturnType<AdapterManager["getAdapter"]>>,
  supabase: SupabaseClient,
  deviceId: string,
  batchSize: number
): Promise<void> {
  const { data: pendingPersons, error } = await (supabase as any)
    .from("persons")
    .select("*")
    .eq("status", "pending_sync")
    .limit(batchSize);

  if (error) {
    log.error("personSync", `Failed to fetch pending persons: ${error.message}`);
    return;
  }

  if (!pendingPersons || pendingPersons.length === 0) {
    return;
  }

  log.info("personSync", `Syncing ${pendingPersons.length} pending person(s) to device ${deviceId}`);

  for (const person of pendingPersons as PendingPerson[]) {
    try {
      await syncSinglePerson(adapter, supabase, person);
    } catch (err) {
      log.error("personSync", `Failed to sync person ${person.id}`, {
        err: err as Error,
        personId: person.id,
      });
    }
  }
}

async function syncSinglePerson(
  adapter: Awaited<ReturnType<AdapterManager["getAdapter"]>>,
  supabase: SupabaseClient,
  person: PendingPerson
): Promise<void> {
  const employeeNo = person.employee_id ?? `AUTO_${person.id.slice(0, 8)}`;

  log.info("personSync", `Syncing person ${person.id} (${person.name})`);

  // Verificar si ya existe en el dispositivo
  const existingPersons = await adapter.getPersons();
  const existsOnDevice = existingPersons.some(
    (p) => p.employeeNo === employeeNo || p.id === employeeNo
  );

  const personData: Person = {
    id: person.id,
    employeeId: person.employee_id ?? undefined,
    employeeNo,
    name: person.name,
    cardNumber: person.card_number ?? undefined,
    facePhotoUrl: person.face_photo_url ?? undefined,
    department: person.department ?? undefined,
    status: person.status as "active" | "inactive" | "pending_sync",
  };

  let success = false;

  if (existsOnDevice) {
    // Actualizar existente
    const result = await adapter.syncPerson(personData);
    success = result.success;

    if (!success) {
      log.warn("personSync", `Update failed for person ${person.id}: ${result.error}`);
    }
  } else {
    // Crear nuevo
    const result = await adapter.syncPerson(personData);
    success = result.success;

    if (!success) {
      log.warn("personSync", `Create failed for person ${person.id}: ${result.error}`);
    }
  }

  if (success) {
    await (supabase as any)
      .from("persons")
      .update({
        status: "active",
        device_employee_no: parseInt(employeeNo, 10) || null,
      })
      .eq("id", person.id);

    log.info("personSync", `Person ${person.id} synced successfully`);
  }
}

async function cleanupInactivePersons(
  adapter: Awaited<ReturnType<AdapterManager["getAdapter"]>>,
  supabase: SupabaseClient,
  deviceId: string
): Promise<void> {
  const { data: inactivePersons, error } = await (supabase as any)
    .from("persons")
    .select("id, name, device_employee_no")
    .eq("status", "inactive")
    .not("device_employee_no", "is", null)
    .limit(50);

  if (error || !inactivePersons || inactivePersons.length === 0) {
    return;
  }

  log.info("personSync", `Cleaning up ${inactivePersons.length} inactive person(s) from device ${deviceId}`);

  for (const person of inactivePersons) {
    try {
      const empNo = String(person.device_employee_no);

      await adapter.deletePerson(empNo);

      await (supabase as any)
        .from("persons")
        .update({ device_employee_no: null })
        .eq("id", person.id);

      log.info("personSync", `Removed person ${person.id} (${person.name}) from device`);
    } catch (err) {
      log.error("personSync", `Failed to remove person ${person.id} from device`, {
        err: err as Error,
      });
    }
  }
}

/**
 * Person Sync para un dispositivo específico
 */
export function startSingleDevicePersonSync(
  adapterManager: AdapterManager,
  deviceId: string,
  deviceSerial: string,
  supabase: SupabaseClient,
  options: PersonSyncOptions = {}
): () => void {
  const {
    intervalMs = 15000,
    batchSize = 50,
    deviceIp,
    deviceBrand = "hikvision",
    deviceUsername,
    devicePassword,
  } = options;

  let isRunning = true;

  async function syncPersons() {
    if (!isRunning) return;

    try {
      const adapter = await adapterManager.getAdapter({
        id: deviceId,
        serialNumber: deviceSerial,
        ip: deviceIp || "192.168.1.175",
        brand: deviceBrand,
        username: deviceUsername,
        password: devicePassword,
      });

      // Obtener personas pendientes
      const { data: pendingPersons } = await (supabase as any)
        .from("persons")
        .select("*")
        .eq("status", "pending_sync")
        .limit(batchSize);

      if (pendingPersons && pendingPersons.length > 0) {
        log.info("personSync", `Syncing ${pendingPersons.length} pending person(s)`, { deviceId, brand: deviceBrand });

        for (const person of pendingPersons as PendingPerson[]) {
          await syncSinglePerson(adapter, supabase, person);
        }
      }

      // Limpiar inactivos
      const { data: inactivePersons } = await (supabase as any)
        .from("persons")
        .select("id, name, device_employee_no")
        .eq("status", "inactive")
        .not("device_employee_no", "is", null)
        .limit(20);

      if (inactivePersons && inactivePersons.length > 0) {
        for (const person of inactivePersons) {
          try {
            const empNo = String(person.device_employee_no);
            await adapter.deletePerson(empNo);

            await (supabase as any)
              .from("persons")
              .update({ device_employee_no: null })
              .eq("id", person.id);
          } catch {
            // Ignore individual failures
          }
        }
      }
    } catch (err) {
      log.error("personSync", "Person sync failed", {
        deviceId,
        err: err as Error,
      });
    }
  }

  syncPersons();
  const interval = setInterval(syncPersons, intervalMs);

  return () => {
    isRunning = false;
    clearInterval(interval);
  };
}
