'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { HikvisionAdapter } from '../../agent/src/adapters/hikvision.adapter'
import { createSyncLog, updateDeviceSyncStatus } from '@/actions/sync-logs'
import { isapiRequest } from '../../agent/src/isapi/client'
import type { Config } from '../../agent/src/config'
import { decryptDevicePassword } from '@/lib/crypto/device-credentials'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type SyncOption = 'personas' | 'eventos' | 'heartbeat' | 'todas'

export interface SyncResult {
  success: boolean
  option: SyncOption
  devicesProcessed: number
  recordsProcessed: number
  error?: string
  fallbackUsed?: boolean
  details?: {
    successfulOperations: number
    failedOperations: number
  }
}

type SyncDevice = {
  id: string
  ip_address: string | null
  device_username: string | null
  device_password_encrypted: string | null
}

type DeviceSyncOutcome = {
  recordsProcessed: number
  success: boolean
  error?: string
  fallbackUsed?: boolean
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return fallback
}

function createAdapter(device: SyncDevice) {
  if (!device.ip_address) {
    throw new Error('El dispositivo no tiene IP configurada')
  }

  return new HikvisionAdapter({
    ip: device.ip_address,
    port: 443,
    username: device.device_username || 'admin',
    password: decryptDevicePassword(device.device_password_encrypted || ''),
  })
}

async function getDeviceUserCount(device: SyncDevice): Promise<number | null> {
  if (!device.ip_address) return null

  const config: Config = {
    deviceIp: device.ip_address,
    deviceUsername: device.device_username || 'admin',
    devicePassword: decryptDevicePassword(device.device_password_encrypted || ''),
    devicePort: 443,
    supabaseUrl: '',
    supabaseServiceRoleKey: '',
    supabaseAnonKey: '',
    pollIntervalMs: 30000,
    heartbeatIntervalMs: 60000,
    doorPollIntervalMs: 10000,
    commandPollIntervalMs: 2000,
    logLevel: 'info',
  }

  try {
    const response = await isapiRequest<string>(
      config,
      '/ISAPI/AccessControl/UserInfo/Count?format=json',
      'GET',
      undefined,
      'application/json'
    )

    const parsed = JSON.parse(response.rawXml || '{}') as Record<string, unknown>
    const countNode = parsed.UserInfoCount as Record<string, unknown> | undefined
    const userNumber = countNode?.userNumber

    if (typeof userNumber === 'number') return userNumber
    const parsedNumber = Number(userNumber ?? NaN)
    return Number.isFinite(parsedNumber) ? parsedNumber : null
  } catch {
    return null
  }
}

async function getDevices(): Promise<SyncDevice[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('devices')
    .select('id, ip_address, device_username, device_password_encrypted')
    .eq('status', 'online')
    .not('ip_address', 'is', null)

  if (error) throw error
  return (data || []) as SyncDevice[]
}

async function logSyncOutcome(input: {
  deviceId: string
  syncType: 'persons' | 'events' | 'heartbeat'
  startedAt: Date
  completedAt: Date
  recordsProcessed: number
  error?: string
}) {
  await createSyncLog({
    deviceId: input.deviceId,
    syncType: input.syncType,
    status: input.error ? 'error' : 'success',
    eventsProcessed: input.recordsProcessed,
    errorMessage: input.error,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
  })
}

// ─── Sincronización de Personas ───────────────────────────────────────────────

async function syncPersonas(device: SyncDevice): Promise<DeviceSyncOutcome> {
  const startedAt = new Date()
  const adapter = createAdapter(device)

  await updateDeviceSyncStatus(device.id, 'syncing')

  try {
    const users = await adapter.getUsers()
    const supabase = getSupabaseAdmin()

    let synced = 0
    for (const user of users) {
      const { error } = await supabase
        .from('persons')
        .upsert(
          {
            employee_id: user.employeeId || user.id,
            name: user.name,
            card_number: user.cardNumber || null,
            status: 'active',
          },
          { onConflict: 'employee_id' }
        )

      if (!error) synced++
    }

    let fallbackUsed = false

    if (synced === 0) {
      const userCount = await getDeviceUserCount(device)

      if (userCount && userCount > 0) {
        const fallbackName = device.device_username || 'admin'
        const { error } = await supabase
          .from('persons')
          .upsert(
            {
              employee_id: fallbackName,
              name: fallbackName,
              card_number: null,
              status: 'active',
            },
            { onConflict: 'employee_id' }
          )

        if (!error) {
          synced = 1
          fallbackUsed = true
        }
      }
    }

    await updateDeviceSyncStatus(device.id, 'synced')
    await logSyncOutcome({
      deviceId: device.id,
      syncType: 'persons',
      startedAt,
      completedAt: new Date(),
      recordsProcessed: synced,
    })
    revalidatePath('/dashboard/persons')
    revalidatePath('/dashboard/sync-status')

    return { recordsProcessed: synced, success: true, fallbackUsed }
  } catch (error) {
    const message = getErrorMessage(error, 'Error al sincronizar personas')

    await updateDeviceSyncStatus(device.id, 'error', { error: message })
    await logSyncOutcome({
      deviceId: device.id,
      syncType: 'persons',
      startedAt,
      completedAt: new Date(),
      recordsProcessed: 0,
      error: message,
    })
    revalidatePath('/dashboard/sync-status')

    return { recordsProcessed: 0, success: false, error: message }
  } finally {
    await adapter.disconnect()
  }
}

// ─── Sincronización de Eventos ───────────────────────────────────────────────

async function syncEventos(device: SyncDevice): Promise<DeviceSyncOutcome> {
  const startedAt = new Date()
  const adapter = createAdapter(device)

  await updateDeviceSyncStatus(device.id, 'syncing')

  try {
    const events = await adapter.getEvents({ maxResults: 500 })
    const supabase = getSupabaseAdmin()

    let synced = 0
    for (const event of events) {
      const { error } = await supabase
        .from('access_events')
        .insert({
          device_serial: device.id,
          event_time: event.eventTime?.toISOString() || new Date().toISOString(),
          event_type: event.eventType || 'access',
          employee_id: event.employeeId || null,
          verify_mode: event.verifyMode || null,
          raw_payload: event as any,
        })

      if (!error) synced++
    }

    await updateDeviceSyncStatus(device.id, 'synced', {
      lastEventAt: new Date(),
    })
    await logSyncOutcome({
      deviceId: device.id,
      syncType: 'events',
      startedAt,
      completedAt: new Date(),
      recordsProcessed: synced,
    })
    revalidatePath('/dashboard/sync-status')

    return { recordsProcessed: synced, success: true }
  } catch (error) {
    const message = getErrorMessage(error, 'Error al sincronizar eventos')

    await updateDeviceSyncStatus(device.id, 'error', { error: message })
    await logSyncOutcome({
      deviceId: device.id,
      syncType: 'events',
      startedAt,
      completedAt: new Date(),
      recordsProcessed: 0,
      error: message,
    })
    revalidatePath('/dashboard/sync-status')

    return { recordsProcessed: 0, success: false, error: message }
  } finally {
    await adapter.disconnect()
  }
}

// ─── Heartbeat ──────────────────────────────────────────────────────────────

async function runHeartbeat(device: SyncDevice): Promise<DeviceSyncOutcome> {
  const startedAt = new Date()
  const adapter = createAdapter(device)

  await updateDeviceSyncStatus(device.id, 'connecting')

  try {
    const health = await adapter.healthCheck()

    await updateDeviceSyncStatus(device.id, health.reachable ? 'synced' : 'error', {
      error: health.reachable ? undefined : 'Dispositivo no responde al health check',
    })

    await logSyncOutcome({
      deviceId: device.id,
      syncType: 'heartbeat',
      startedAt,
      completedAt: new Date(),
      recordsProcessed: health.reachable ? 1 : 0,
      error: health.reachable ? undefined : 'Dispositivo no responde al health check',
    })
    revalidatePath('/dashboard/sync-status')

    return {
      recordsProcessed: health.reachable ? 1 : 0,
      success: health.reachable,
      error: health.reachable ? undefined : 'Dispositivo no responde al health check',
    }
  } catch (error) {
    const message = getErrorMessage(error, 'Error en heartbeat')

    await updateDeviceSyncStatus(device.id, 'error', { error: message })
    await logSyncOutcome({
      deviceId: device.id,
      syncType: 'heartbeat',
      startedAt,
      completedAt: new Date(),
      recordsProcessed: 0,
      error: message,
    })
    revalidatePath('/dashboard/sync-status')

    return { recordsProcessed: 0, success: false, error: message }
  } finally {
    await adapter.disconnect()
  }
}

// ─── Server Actions ──────────────────────────────────────────────────────

/**
 * Sincronización manual con elección de tipo
 */
export async function runManualSync(option: SyncOption): Promise<SyncResult> {
  try {
    const devices = await getDevices()

    if (devices.length === 0) {
    return {
      success: false,
      option,
      devicesProcessed: 0,
      recordsProcessed: 0,
      error: 'No hay dispositivos online',
    }
  }

    let totalRecords = 0
    let successfulOperations = 0
    let failedOperations = 0
    const errors: string[] = []

    for (const device of devices) {
      const operations: SyncOption[] =
        option === 'todas' ? ['heartbeat', 'personas', 'eventos'] : [option]

      for (const operation of operations) {
        let result: DeviceSyncOutcome

        switch (operation) {
          case 'personas':
            result = await syncPersonas(device)
            break
          case 'eventos':
            result = await syncEventos(device)
            break
          case 'heartbeat':
            result = await runHeartbeat(device)
            break
          default:
            result = { recordsProcessed: 0, success: false, error: 'Operación no soportada' }
        }

        totalRecords += result.recordsProcessed

        if (result.success) {
          successfulOperations++
        } else {
          failedOperations++
          if (result.error) {
            errors.push(result.error)
          }
        }
      }
    }

    return {
      success: failedOperations === 0,
      option,
      devicesProcessed: devices.length,
      recordsProcessed: totalRecords,
      error: failedOperations > 0 ? errors[0] : undefined,
      details: {
        successfulOperations,
        failedOperations,
      },
    }
  } catch (error) {
    revalidatePath('/dashboard/sync-status')
    return {
      success: false,
      option,
      devicesProcessed: 0,
      recordsProcessed: 0,
      error: getErrorMessage(error, 'Error inesperado en sincronización'),
    }
  }
}

/**
 * Obtener configuración actual del cron
 */
export async function getSyncConfig() {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('sync_config')
    .select('*')
    .limit(1)
    .single()

  return data || { enabled: false, interval_minutes: 5, options: ['eventos'] }
}

/**
 * Actualizar configuración del cron
 */
export async function updateSyncConfig(
  enabled: boolean,
  intervalMinutes: number = 5,
  options: string[] = ['eventos']
) {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('sync_config')
    .upsert(
      {
        id: 1,
        enabled,
        interval_minutes: intervalMinutes,
        options,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) throw error

  return { success: true }
}
