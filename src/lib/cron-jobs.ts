import { checkAllDevices } from '@/lib/device-connectivity'
import { createClient } from '@/lib/supabase/server'

/**
 * Tarea programada para verificar la conectividad de todos los dispositivos
 * Esta función debería ser llamada periódicamente por un cron job
 */
export async function runConnectivityCheck() {
  try {
    console.log('Iniciando verificación de conectividad programada...')
    
    // Ejecutar health check de todos los dispositivos
    const results = await checkAllDevices()
    
    console.log(`Verificación completada: ${results.online} online, ${results.offline} offline, ${results.errors} errores`)
    
    // Aquí podríamos:
    // 1. Enviar notificaciones por email/slack si hay dispositivos offline
    // 2. Guardar logs de conectividad en una tabla específica
    // 3. Actualizar métricas de monitoreo
    
    return {
      success: true,
      message: `Health check completado: ${results.online} online, ${results.offline} offline, ${results.errors} errores`,
      results
    }
  } catch (error) {
    console.error('Error en verificación de conectividad programada:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en health check programado'
    }
  }
}

/**
 * Verifica dispositivos que no han sido vistos en un cierto periodo
 * @param minutesWithoutContact Número de minutos sin contacto antes de marcar como offline
 */
export async function checkInactiveDevices(minutesWithoutContact: number = 5) {
  try {
    const supabase = await createClient()
    
    // Calcular el tiempo límite (5 minutos atrás por defecto)
    const cutoffTime = new Date(Date.now() - minutesWithoutContact * 60 * 1000).toISOString()
    
    // Obtener dispositivos que no han sido vistos desde cutoffTime
     
    const { data: inactiveDevices, error } = await supabase
      .from('devices')
      .select('id, name, last_seen_at')
      .lt('last_seen_at', cutoffTime)
      .eq('status', 'online') as any
    
    if (error) {
      throw new Error(`Error al obtener dispositivos inactivos: ${error.message}`)
    }
    
    // Marcar dispositivos inactivos como offline
    let updatedCount = 0
    for (const device of inactiveDevices) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('devices')
        .update({ status: 'offline' })
        .eq('id', device.id)
      
      if (!updateError) {
        updatedCount++
      }
    }
    
    console.log(`Marcados ${updatedCount} dispositivos como offline por inactividad`)
    
    return {
      success: true,
      inactiveDevices: updatedCount
    }
  } catch (error) {
    console.error('Error al verificar dispositivos inactivos:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar dispositivos inactivos'
    }
  }
}