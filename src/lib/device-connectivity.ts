import { createClient } from '@/lib/supabase/server'
import { HikvisionAdapter } from '../../agent/src/adapters/hikvision.adapter'
import { decryptDevicePassword } from '@/lib/crypto/device-credentials'
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
          rejectUnauthorized: input.allow_self_signed_cert ? false : true,
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

/**
 * Health check for stored devices — uses API route to avoid exposing HikvisionAdapter to client.
 */
export async function checkStoredDeviceConnectivity(deviceId: string): Promise<HealthCheckResult> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/devices/${deviceId}/health`,
      { cache: 'no-store' }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }))
      return {
        status: 'error',
        error: errorData.error || `HTTP ${response.status}`,
        timestamp: new Date(),
      }
    }

    const data = await response.json()
    return {
      status: data.status === 'online' ? 'online' : data.status === 'offline' ? 'offline' : 'error',
      latency: data.latency,
      error: data.error,
      timestamp: new Date(data.timestamp),
    }
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : 'Health check failed',
      timestamp: new Date(),
    }
  }
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

    const rows = (devices || []) as Array<Pick<DeviceRecord, 'id' | 'ip_address' | 'device_username' | 'device_password_encrypted' | 'brand' | 'allow_self_signed_cert'>>
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
          password: decryptDevicePassword(device.device_password_encrypted),
          brand: device.brand || 'hikvision',
          allow_self_signed_cert: device.allow_self_signed_cert ?? false,
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
