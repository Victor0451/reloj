import { createClient } from '@/lib/supabase/server'
import { HikvisionAdapter } from '../../agent/src/adapters/hikvision.adapter'
import {
  DeviceConnectionCheckResult,
  DeviceConnectionInput,
  DeviceRecord,
} from '@/types/device.types'

export type ConnectivityStatus = 'online' | 'offline' | 'checking' | 'error'
export type HealthCheckResult = {
  status: ConnectivityStatus
  latency?: number
  error?: string
  timestamp: Date
}

function normalizeDeviceStatus(status: ConnectivityStatus): 'online' | 'offline' | 'unknown' {
  if (status === 'online') return 'online'
  if (status === 'checking') return 'unknown'
  return 'offline'
}

function toHealthCheckResult(result: DeviceConnectionCheckResult): HealthCheckResult {
  return {
    status: result.status === 'unknown' ? 'checking' : result.status,
    latency: result.latency,
    error: result.error,
    timestamp: new Date(result.timestamp),
  }
}

function getDefaultPort(brand?: string): number {
  switch ((brand || 'hikvision').toLowerCase()) {
    case 'hikvision':
    default:
      return 443
  }
}

export async function performDeviceConnectionCheck(
  input: DeviceConnectionInput
): Promise<DeviceConnectionCheckResult> {
  const startedAt = Date.now()
  const brand = (input.brand || 'hikvision').toLowerCase()

  try {
    switch (brand) {
      case 'hikvision': {
        const adapter = new HikvisionAdapter({
          ip: input.ip_address,
          port: input.port ?? getDefaultPort(brand),
          username: input.username,
          password: input.password,
        })

        try {
          const health = await adapter.healthCheck()

          return {
            reachable: health.reachable,
            status: health.reachable ? 'online' : 'offline',
            latency: health.latency,
            error: health.error,
            timestamp: health.timestamp.toISOString(),
          }
        } finally {
          await adapter.disconnect()
        }
      }
      default:
        return {
          reachable: false,
          status: 'offline',
          error: `Marca no soportada para health check: ${brand}`,
          timestamp: new Date().toISOString(),
          latency: Date.now() - startedAt,
        }
    }
  } catch (error) {
    return {
      reachable: false,
      status: 'offline',
      error: error instanceof Error ? error.message : 'Error desconocido al verificar conectividad',
      timestamp: new Date().toISOString(),
      latency: Date.now() - startedAt,
    }
  }
}

/**
 * Backward-compatible wrapper. Prefer `performDeviceConnectionCheck` when credentials are available.
 */
export async function checkDeviceConnectivity(
  input: string | DeviceConnectionInput
): Promise<HealthCheckResult> {
  if (typeof input === 'string') {
    return toHealthCheckResult(
      await performDeviceConnectionCheck({
        ip_address: input,
        username: 'admin',
        password: '',
        brand: 'hikvision',
      })
    )
  }

  return toHealthCheckResult(await performDeviceConnectionCheck(input))
}

async function getStoredDeviceConnectionInput(deviceId: string): Promise<DeviceConnectionInput | null> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('devices')
    .select('ip_address, device_username, device_password_encrypted, brand')
    .eq('id', deviceId)
    .single()

  if (error || !data?.ip_address || !data?.device_username || !data?.device_password_encrypted) {
    return null
  }

  return {
    ip_address: data.ip_address,
    username: data.device_username,
    password: data.device_password_encrypted,
    brand: data.brand || 'hikvision',
  }
}

/**
 * Actualiza el estado de conectividad de un dispositivo en la base de datos
 */
export async function updateDeviceStatus(
  deviceId: string,
  result: HealthCheckResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    const nowIso = new Date().toISOString()
    const normalizedStatus = normalizeDeviceStatus(result.status)
    const updateData: Record<string, unknown> = {
      status: normalizedStatus,
      sync_error: result.status === 'online' ? null : result.error ?? null,
      updated_at: nowIso,
    }

    if (result.status === 'online') {
      updateData.last_seen_at = nowIso
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('devices')
      .update(updateData)
      .eq('id', deviceId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al actualizar el estado',
    }
  }
}

export async function checkStoredDeviceConnectivity(deviceId: string): Promise<HealthCheckResult> {
  const connectionInput = await getStoredDeviceConnectionInput(deviceId)

  if (!connectionInput) {
    return {
      status: 'error',
      error: 'El dispositivo no tiene configuración de conexión completa',
      timestamp: new Date(),
    }
  }

  return checkDeviceConnectivity(connectionInput)
}

/**
 * Realiza health checks para todos los dispositivos con la misma estrategia canónica.
 */
export async function checkAllDevices(): Promise<{
  total: number
  online: number
  offline: number
  errors: number
  results: Array<{ deviceId: string; result: HealthCheckResult }>
}> {
  try {
    const supabase = await createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: devices, error } = await (supabase as any)
      .from('devices')
      .select('id, ip_address, device_username, device_password_encrypted, brand')

    if (error) {
      throw new Error(`Error al obtener dispositivos: ${error.message}`)
    }

    const rows = (devices || []) as Array<Pick<DeviceRecord, 'id' | 'ip_address' | 'device_username' | 'device_password_encrypted' | 'brand'>>
    const results: Array<{ deviceId: string; result: HealthCheckResult }> = []
    let onlineCount = 0
    let offlineCount = 0
    let errorCount = 0

    for (const device of rows) {
      let result: HealthCheckResult

      if (!device.ip_address || !device.device_username || !device.device_password_encrypted) {
        result = {
          status: 'error',
          error: 'Configuración incompleta del dispositivo',
          timestamp: new Date(),
        }
      } else {
        result = await checkDeviceConnectivity({
          ip_address: device.ip_address,
          username: device.device_username,
          password: device.device_password_encrypted,
          brand: device.brand || 'hikvision',
        })
      }

      results.push({ deviceId: device.id, result })

      switch (result.status) {
        case 'online':
          onlineCount++
          break
        case 'offline':
          offlineCount++
          break
        case 'error':
          errorCount++
          break
      }

      await updateDeviceStatus(device.id, result)
    }

    return {
      total: rows.length,
      online: onlineCount,
      offline: offlineCount,
      errors: errorCount,
      results,
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Error desconocido al verificar dispositivos')
  }
}
