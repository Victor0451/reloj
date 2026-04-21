import type { Config } from '../config'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createPersonOnDevice,
  updatePersonOnDevice,
  deletePersonFromDevice,
  searchPersonOnDevice,
  uploadFaceData,
} from '../isapi/person-methods'
import * as log from '../utils/logger'
import { withRetry } from '../utils/backoff'

interface PendingPerson {
  id: string
  employee_id: string | null
  name: string
  department: string | null
  card_number: string | null
  face_photo_url: string | null
  device_employee_no: number | null
  status: string
}

export function startPersonSync(
  config: Config,
  supabase: SupabaseClient
): () => void {
  let isRunning = true

  async function syncPersons() {
    if (!isRunning) return

    try {
      await syncPendingPersons(supabase, config)
      await cleanupInactivePersons(supabase, config)
    } catch (err) {
      log.error('personSync', 'Sync loop failed (will retry next cycle)', {
        err: err instanceof Error ? err : undefined,
      })
    }
  }

  // Initial sync
  syncPersons()

  // Sync every 15 seconds
  const interval = setInterval(syncPersons, 15000)

  return () => {
    isRunning = false
    clearInterval(interval)
  }
}

async function syncPendingPersons(
  supabase: SupabaseClient,
  config: Config
): Promise<void> {
  // Fetch pending persons
  const { data: pendingPersons, error } = await supabase
    .from('persons')
    .select('*')
    .eq('status', 'pending_sync')
    .limit(100)

  if (error) {
    log.error('personSync', `Failed to fetch pending persons: ${error.message}`)
    return
  }

  if (!pendingPersons || pendingPersons.length === 0) {
    return
  }

  log.info('personSync', `Syncing ${pendingPersons.length} pending person(s)`)

  for (const person of pendingPersons as PendingPerson[]) {
    try {
      await syncSinglePerson(supabase, config, person)
    } catch (err) {
      log.error('personSync', `Failed to sync person ${person.id}`, {
        err: err instanceof Error ? err : undefined,
        personId: person.id,
      })
    }
  }
}

async function syncSinglePerson(
  supabase: SupabaseClient,
  config: Config,
  person: PendingPerson
): Promise<void> {
  const employeeNo = person.employee_id ?? `AUTO_${person.id.slice(0, 8)}`

  log.info('personSync', `Syncing person ${person.id} (${person.name}) to device`)

  // Check if already exists on device
  const existing = await withRetry(
    () => searchPersonOnDevice(config, employeeNo),
    { maxAttempts: 2 }
  )

  let success = false

  if (existing) {
    // Update existing
    const result = await withRetry(
      () =>
        updatePersonOnDevice(config, {
          employeeNo,
          name: person.name,
          department: person.department ?? undefined,
          cardNo: person.card_number ?? undefined,
        }),
      { maxAttempts: 2 }
    )
    success = result.success
  } else {
    // Create new
    const result = await withRetry(
      () =>
        createPersonOnDevice(config, {
          employeeNo,
          name: person.name,
          department: person.department ?? undefined,
          cardNo: person.card_number ?? undefined,
        }),
      { maxAttempts: 2 }
    )
    success = result.success
  }

  if (success) {
    // Update status to active
    await supabase
      .from('persons')
      .update({
        status: 'active',
        device_employee_no: parseInt(employeeNo, 10) || null,
      })
      .eq('id', person.id)

    log.info('personSync', `Person ${person.id} synced successfully`)

    // Upload face photo if available
    if (person.face_photo_url) {
      try {
        await uploadFacePhotoByUrl(config, employeeNo, person.face_photo_url)
      } catch {
        log.warn('personSync', `Face photo upload failed for person ${person.id} (non-blocking)`)
      }
    }
  } else {
    log.warn('personSync', `Person ${person.id} sync failed — will retry next cycle`)
  }
}

async function cleanupInactivePersons(
  supabase: SupabaseClient,
  config: Config
): Promise<void> {
  // Fetch inactive persons that still have device_employee_no
  const { data: inactivePersons, error } = await supabase
    .from('persons')
    .select('id, name, device_employee_no')
    .eq('status', 'inactive')
    .not('device_employee_no', 'is', null)
    .limit(50)

  if (error || !inactivePersons || inactivePersons.length === 0) {
    return
  }

  log.info('personSync', `Cleaning up ${inactivePersons.length} inactive person(s) from device`)

  for (const person of inactivePersons) {
    try {
      const empNo = String(person.device_employee_no)

      await withRetry(
        () => deletePersonFromDevice(config, empNo),
        { maxAttempts: 2 }
      )

      // Clear device_employee_no after deletion
      await supabase
        .from('persons')
        .update({ device_employee_no: null })
        .eq('id', person.id)

      log.info('personSync', `Removed person ${person.id} (${person.name}) from device`)
    } catch (err) {
      log.error('personSync', `Failed to remove person ${person.id} from device`, {
        err: err instanceof Error ? err : undefined,
      })
    }
  }
}

/**
 * Download photo from Supabase Storage and upload to device face database.
 */
async function uploadFacePhotoByUrl(
  config: Config,
  employeeNo: string,
  photoUrl: string
): Promise<void> {
  // Download the image
  const response = await fetch(photoUrl)
  if (!response.ok) {
    throw new Error(`Failed to download photo: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const base64 = buffer.toString('base64')

  await uploadFaceData(config, employeeNo, base64)
}
