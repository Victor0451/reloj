'use server'

import { revalidatePath } from 'next/cache'
import { checkAllDevices } from '@/lib/device-connectivity'
import { createClient } from '@/lib/supabase/server'

/**
 * Ejecuta verificación de conectividad para todos los dispositivos
 * usando la estrategia canónica del módulo de dispositivos.
 */
export async function runConnectivityCheck() {
  try {
    const results = await checkAllDevices()

    revalidatePath('/dashboard/devices')
    revalidatePath('/dashboard/connectivity')

    return {
      success: true,
      message: `Verificados: ${results.online} online, ${results.offline} offline, ${results.errors} errores`,
      results,
    }
  } catch (error) {
    console.error('Connectivity check error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Marca como offline los dispositivos que no han sido vistos en X minutos
 */
export async function checkInactiveDevices(minutesWithoutContact: number = 5) {
  try {
    const supabase = await createClient()

    const cutoffTime = new Date(Date.now() - minutesWithoutContact * 60 * 1000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inactiveDevices, error } = await (supabase as any)
      .from('devices')
      .select('id')
      .lt('last_seen_at', cutoffTime)
      .eq('status', 'online')

    if (error) {
      return { success: false, error: error.message }
    }

    let updatedCount = 0

    for (const device of inactiveDevices || []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('devices')
        .update({ status: 'offline', sync_error: 'Sin contacto reciente con el dispositivo' })
        .eq('id', device.id)

      if (!updateError) updatedCount++
    }

    if (updatedCount > 0) {
      revalidatePath('/dashboard/devices')
      revalidatePath('/dashboard/connectivity')
    }

    return { success: true, inactiveDevices: updatedCount }
  } catch (error) {
    console.error('Inactive devices check error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
