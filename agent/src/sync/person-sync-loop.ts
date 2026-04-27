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
  /** Permite certificados autofirmados o expirados */
  allowSelfSignedCert?: boolean;
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
    .or("status.eq.pending_sync,status.eq.sync_failed")
    .limit(batchSize);

  if (error) {
    log.error("personSync", `Failed to fetch pending persons: ${error.message}`);
    return;
  }

  if (!pendingPersons || pendingPersons.length === 0) {
    return;
  }

  log.info("personSync", `Syncing ${pendingPersons.length} pending person(s) to device ${deviceId}`);

  // Fetch ALL device persons ONCE per cycle to avoid N+1 queries
  const existingPersons = await adapter.getPersons();
  const existingEmployeeNos = new Set(
    existingPersons.map((p) => p.employeeNo).filter((no): no is string => !!no)
  );

  for (const person of pendingPersons as PendingPerson[]) {
    try {
      await syncSinglePerson(adapter, supabase, person, existingEmployeeNos);
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
  person: PendingPerson,
  existingEmployeeNos?: Set<string>
): Promise<void> {
  const hasEmployeeId = !!person.employee_id;
  const employeeNo = person.employee_id ?? `AUTO_${person.id.slice(0, 8)}`;

  log.info("personSync", `Syncing person ${person.id} (${person.name})`);

  // Use pre-fetched set if provided, otherwise fetch (N+1 fallback)
  const existsOnDevice = existingEmployeeNos
    ? existingEmployeeNos.has(employeeNo)
    : hasEmployeeId
      ? (await adapter.getPersons()).some(
          (p) => p.employeeNo === employeeNo || p.id === employeeNo
        )
      : false; // Can't check if no employee_id — will try create

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
  let assignedEmployeeNo: string | null = null;
  let lastError: string | undefined;

  if (existsOnDevice) {
    // Actualizar existente
    const result = await adapter.syncPerson(personData);
    success = result.success;
    lastError = result.error;

    if (!success) {
      log.warn("personSync", `Update failed for person ${person.id}: ${result.error}`);
    }
  } else {
    // Crear nuevo — usar createPerson si existe el método, si no fallback a syncPerson
    if (hasEmployeeId) {
      // We know the employeeNo — try syncPerson (PUT) as update/create
      const result = await adapter.syncPerson(personData);
      success = result.success;
      lastError = result.error;

      if (!success) {
        log.warn("personSync", `Create failed for person ${person.id}: ${result.error}`);
      }
    } else {
      // No employee_id — use createPersonOnDevice (JSON POST), device assigns employeeNo
      const result = await adapter.createPersonOnDevice(personData);
      success = result.success;
      lastError = result.error;
      assignedEmployeeNo = result.employeeNo ?? null;

      if (!success) {
        log.warn("personSync", `Create failed for person ${person.id}: ${result.error}`);
      }
    }
  }

  if (success) {
    // Use assigned employeeNo from createPerson, or the original one
    const finalEmployeeNo = assignedEmployeeNo ?? employeeNo;

    // Validate device-assigned number before DB update
    if (!finalEmployeeNo || finalEmployeeNo.startsWith('AUTO_')) {
      log.error("personSync", `Invalid employeeNo for ${person.id}`, { finalEmployeeNo });
      return; // Don't update DB, don't assign card
    }

    await (supabase as any)
      .from("persons")
      .update({
        status: "active",
        sync_attempts: 0,
        sync_error: null,
        device_employee_no: parseInt(finalEmployeeNo, 10) || null,
        employee_id: finalEmployeeNo !== employeeNo ? finalEmployeeNo : person.employee_id,
      })
      .eq("id", person.id);

    // T10: Assign card if person has card_number and sync succeeded
    if (person.card_number && (adapter as any).assignCardToDevice) {
      const cardResult = await (adapter as any).assignCardToDevice(finalEmployeeNo, person.card_number);
      if (cardResult.success) {
        log.info("personSync", `Card assigned to person ${person.id}`, {
          employeeNo: finalEmployeeNo,
          cardNumber: person.card_number,
        });
      } else {
        log.warn("personSync", `Card assign failed for person ${person.id}`, {
          error: cardResult.error,
        });
      }
    }

    log.info("personSync", `Person ${person.id} synced successfully`);
  } else {
    // Increment retry count
    const newAttempts = (person as any).sync_attempts + 1 || 1;

    if (newAttempts >= 3) {
      // Move to dead-letter — no more automatic retries
      await (supabase as any)
        .from("persons")
        .update({
          status: "sync_dead_letter",
          sync_attempts: newAttempts,
          sync_error: lastError,
        })
        .eq("id", person.id);

      log.error("personSync", `Dead-letter person ${person.id} after ${newAttempts} attempts`, {
        error: lastError,
      });
    } else {
      // Keep as sync_failed for retry
      await (supabase as any)
        .from("persons")
        .update({
          status: "sync_failed",
          sync_attempts: newAttempts,
          sync_error: lastError,
        })
        .eq("id", person.id);

      log.warn("personSync", `Sync failed for person ${person.id}, attempt ${newAttempts}/3`, {
        error: lastError,
      });
    }
  }
}

/**
 * Sync persons FROM device TO DB.
 * Reads all persons from Hikvision via getPersons(),
 * upserts to DB with employee_id = device.employeeNo.
 *
 * This enables importing persons that were created directly on the device.
 */
export async function syncPersonsFromDevice(
  adapterManager: AdapterManager,
  supabase: SupabaseClient,
  deviceId: string,
  deviceSerial: string,
  deviceBrand: string,
  deviceIp: string,
  deviceUsername: string,
  devicePassword: string,
  allowSelfSignedCert: boolean = false
): Promise<{ imported: number; updated: number; skipped: number }> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  try {
    // Get adapter for this device
    const adapter = await adapterManager.getAdapter({
      id: deviceId,
      serialNumber: deviceSerial,
      ip: deviceIp,
      brand: deviceBrand,
      username: deviceUsername,
      password: devicePassword,
      allowSelfSignedCert,
    });

    // Fetch all persons from device
    const devicePersons = await adapter.getPersons();
    log.info("personSync", `Device has ${devicePersons.length} persons`, { deviceId });

    for (const person of devicePersons) {
      const employeeNo = person.employeeNo || person.id;
      if (!employeeNo) {
        log.warn("personSync", "Device person without employeeNo, skipping", { name: person.name });
        skipped++;
        continue;
      }

      // Check if person already exists in DB
      const { data: existing } = await (supabase as any)
        .from("persons")
        .select("id, name, employee_id")
        .eq("employee_id", employeeNo)
        .single();

      if (existing) {
        // Update if name is different
        if (existing.name !== person.name) {
          await (supabase as any)
            .from("persons")
            .update({
              name: person.name,
              card_number: person.cardNumber || null,
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          updated++;
          log.info("personSync", `Updated person from device`, { employeeNo, name: person.name });
        }
      } else {
        // Create new person from device data
        const { error } = await (supabase as any)
          .from("persons")
          .insert({
            employee_id: employeeNo,
            device_employee_no: parseInt(employeeNo, 10) || null,
            name: person.name,
            card_number: person.cardNumber || null,
            status: "active",
          });

        if (error) {
          // Check if it's a unique constraint violation (conflict)
          if (error.code === "23505") {
            log.warn("personSync", "Employee ID conflict, skipping", { employeeNo });
            skipped++;
          } else {
            log.error("personSync", "Failed to import person from device", {
              employeeNo,
              error: error.message,
            });
            skipped++;
          }
        } else {
          imported++;
          log.info("personSync", `Imported person from device`, { employeeNo, name: person.name });
        }
      }
    }
  } catch (err) {
    log.error("personSync", "syncPersonsFromDevice failed", {
      deviceId,
      error: (err as Error).message,
    });
  }

  return { imported, updated, skipped };
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
    allowSelfSignedCert = false,
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
        allowSelfSignedCert,
      });

      // Obtener personas pendientes
      const { data: pendingPersons } = await (supabase as any)
        .from("persons")
        .select("*")
        .or("status.eq.pending_sync,status.eq.sync_failed")
        .limit(batchSize);

      if (pendingPersons && pendingPersons.length > 0) {
        log.info("personSync", `Syncing ${pendingPersons.length} pending person(s)`, { deviceId, brand: deviceBrand });

        // Fetch ALL device persons ONCE per cycle to avoid N+1 queries
        const existingPersons = await adapter.getPersons();
        const existingEmployeeNos = new Set(
          existingPersons.map((p) => p.employeeNo).filter((no): no is string => !!no)
        );

        for (const person of pendingPersons as PendingPerson[]) {
          await syncSinglePerson(adapter, supabase, person, existingEmployeeNos);
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

      // Device -> DB sync (import persons from device to DB)
      try {
        await syncPersonsFromDevice(
          adapterManager,
          supabase,
          deviceId,
          deviceSerial,
          deviceBrand,
          deviceIp || "192.168.1.175",
          deviceUsername || "",
          devicePassword || "",
          allowSelfSignedCert
        );
      } catch (err) {
        log.warn("personSync", `Device->DB sync failed for ${deviceId}`, { error: (err as Error).message });
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
