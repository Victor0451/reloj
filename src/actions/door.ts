'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DoorAction } from '@/types/door.types'

/**
 * Envía un comando de control de puerta a un dispositivo específico.
 * El Agente Bridge local procesará este comando.
 */
export async function sendDoorCommand(deviceSerial: string, action: DoorAction) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'No autenticado' }
  }

  // Use admin client to bypass RLS for profile lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any

  if (profileError) {
    return { success: false, error: `Error de perfil: ${profileError.message}` }
  }

  if (!profile || !['admin', 'technician'].includes(profile.role)) {
    return { success: false, error: 'No tienes permisos para realizar esta acción' }
  }

  // Casteamos para evitar el error de inferencia 'never'
  const { data, error } = await (supabase as any)
    .from('door_commands')
    .insert([{
      device_serial: deviceSerial,
      action: action,
      status: 'pending'
    }])
    .select()
    .single()

  if (error) {
    console.error('Error sending door command:', error)
    return { success: false, error: error.message }
  }

  return { success: true, commandId: data.id }
}

/**
 * Obtiene los últimos comandos enviados para un dispositivo.
 */
export async function getRecentCommands(deviceSerial: string, limit = 5) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('door_commands')
    .select('*')
    .eq('device_serial', deviceSerial)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent commands:', error)
    return []
  }

  return data
}
