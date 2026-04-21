'use server'

import { checkAllDevices, checkDeviceConnectivity, checkStoredDeviceConnectivity, updateDeviceStatus } from '@/lib/device-connectivity'
import { revalidatePath } from 'next/cache'

/**
 * Verifica la conectividad de un dispositivo específico
 * @param deviceId ID del dispositivo
 * @param ipAddress Dirección IP del dispositivo (fallback legacy)
 */
export async function checkDeviceConnection(deviceId: string, ipAddress?: string) {
  try {
    const storedResult = await checkStoredDeviceConnectivity(deviceId)
    const result = storedResult.status === 'error' && ipAddress
      ? await checkDeviceConnectivity(ipAddress)
      : storedResult

    await updateDeviceStatus(deviceId, result)

    revalidatePath('/dashboard/devices')

    return { success: true, result }
  } catch (error) {
    console.error('Error checking device connection:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar la conexión',
    }
  }
}

/**
 * Verifica la conectividad de todos los dispositivos
 */
export async function checkAllDevicesConnection() {
  try {
    const results = await checkAllDevices()

    revalidatePath('/dashboard/devices')

    return { success: true, results }
  } catch (error) {
    console.error('Error checking all devices connection:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar las conexiones',
    }
  }
}

/**
 * Endpoint para health check programado
 */
export async function scheduledHealthCheck() {
  try {
    const results = await checkAllDevices()

    return {
      success: true,
      message: `Health check completado: ${results.online} online, ${results.offline} offline, ${results.errors} errores`,
    }
  } catch (error) {
    console.error('Error in scheduled health check:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en health check programado',
    }
  }
}
