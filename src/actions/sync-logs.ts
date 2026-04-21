'use server'

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type SyncLogType = 'heartbeat' | 'events' | 'persons' | 'door_status'
export type SyncLogStatus = 'success' | 'error' | 'warning'

export interface SyncLog {
  id: string
  device_id: string
  sync_type: SyncLogType
  status: SyncLogStatus
  events_processed: number
  error_message: string | null
  started_at: string
  completed_at: string | null
  duration_ms: number | null
}

/**
 * Registra un log de sincronización
 */
export async function createSyncLog(input: {
  deviceId: string
  syncType: SyncLogType
  status: SyncLogStatus
  eventsProcessed?: number
  errorMessage?: string
  startedAt: Date
  completedAt?: Date
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const admin = createAdminClient()
    const syncLogsAdmin = admin as any

    const durationMs = input.completedAt 
      ? input.completedAt.getTime() - input.startedAt.getTime()
      : null

    const { data, error } = await syncLogsAdmin
      .from('sync_logs')
      .insert({
        device_id: input.deviceId,
        sync_type: input.syncType,
        status: input.status,
        events_processed: input.eventsProcessed ?? 0,
        error_message: input.errorMessage ?? null,
        started_at: input.startedAt.toISOString(),
        completed_at: input.completedAt?.toISOString() ?? null,
        duration_ms: durationMs,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error creating sync log:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data.id }
  } catch (err) {
    console.error('Exception creating sync log:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Obtiene los últimos logs de sincronización para un dispositivo
 */
export async function getSyncLogs(
  deviceId: string, 
  limit: number = 50
): Promise<SyncLog[]> {
  try {
    const admin = createAdminClient()
    const syncLogsAdmin = admin as any

    const { data, error } = await syncLogsAdmin
      .from('sync_logs')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching sync logs:', error)
      return []
    }

    return data as SyncLog[]
  } catch (err) {
    console.error('Exception fetching sync logs:', err)
    return []
  }
}

/**
 * Obtiene logs de error recientes de todos los dispositivos
 */
export async function getRecentSyncErrors(limit: number = 20): Promise<SyncLog[]> {
  try {
    const admin = createAdminClient()
    const syncLogsAdmin = admin as any

    const { data, error } = await syncLogsAdmin
      .from('sync_logs')
      .select('*')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching sync errors:', error)
      return []
    }

    return data as SyncLog[]
  } catch (err) {
    console.error('Exception fetching sync errors:', err)
    return []
  }
}

/**
 * Actualiza el estado de sincronización de un dispositivo
 */
export async function updateDeviceSyncStatus(
  deviceId: string,
  status: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error',
  options?: {
    error?: string
    lastEventAt?: Date
    incrementEvents?: number
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()
    const devicesAdmin = admin as any

    const updateData: Record<string, unknown> = {
      sync_status: status,
    }

    if (status === 'synced') {
      updateData.sync_last_at = new Date().toISOString()
      updateData.sync_error = null
    }

    if (options?.error) {
      updateData.sync_error = options.error
    }

    if (options?.lastEventAt) {
      updateData.last_event_synced_at = options.lastEventAt.toISOString()
    }

    // Note: sync_events_count increment should be handled by the Agent Bridge
    // This is just for status tracking

    const { error } = await devicesAdmin
      .from('devices')
      .update(updateData)
      .eq('id', deviceId)

    if (error) {
      console.error('Error updating device sync status:', error)
      return { success: false, error: error.message }
    }

    revalidatePath('/dashboard/connectivity')
    revalidatePath('/dashboard/devices')

    return { success: true }
  } catch (err) {
    console.error('Exception updating device sync status:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Obtiene estadísticas de sincronización por dispositivo
 */
export async function getSyncStats(deviceId?: string) {
  try {
    const admin = createAdminClient()
    const syncLogsAdmin = admin as any

    let query = syncLogsAdmin.from('sync_logs').select('sync_type, status, count:id.count()')

    if (deviceId) {
      query = query.eq('device_id', deviceId)
    }

    const { data, error } = await query
      .group('sync_type, status')

    if (error) {
      console.error('Error fetching sync stats:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Exception fetching sync stats:', err)
    return null
  }
}

/**
 * Obtiene los logs de sincronización más recientes para el dashboard general
 */
export async function getRecentSyncLogs(limit: number = 12): Promise<SyncLog[]> {
  try {
    const admin = createAdminClient()
    const syncLogsAdmin = admin as any

    const { data, error } = await syncLogsAdmin
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent sync logs:', error)
      return []
    }

    return data as SyncLog[]
  } catch (err) {
    console.error('Exception fetching recent sync logs:', err)
    return []
  }
}
