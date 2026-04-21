import { checkAllDevices } from '@/lib/device-connectivity'
import { createClient } from '@/lib/supabase/server'

// Esta ruta puede ser llamada por un cron job o tarea programada
export async function GET(request: Request) {
  try {
    // Verificar si la solicitud viene de una fuente autorizada (por ejemplo, un cron job)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_AUTH_TOKEN
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    
    // Ejecutar health check de todos los dispositivos
    const results = await checkAllDevices()
    
    // Podríamos enviar notificaciones aquí si hay dispositivos offline
    // o guardar logs de conectividad
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Health check completado: ${results.online} online, ${results.offline} offline, ${results.errors} errores`,
        results: results.results
      }), 
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error in scheduled health check:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido en health check programado' 
      }), 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}