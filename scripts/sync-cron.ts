#!/usr/bin/env npx tsx
/**
 * Sync Cron - Sincronización automática
 * Uso: npx tsx scripts/sync-cron.ts [--once]
 * 
 * Sin --once: corre continuamente cada X minutos (lee de sync_config)
 * Con --once: corre una sola vez y sale
 */

import { createClient } from '@supabase/supabase-js'
import { HikvisionAdapter } from '../agent/src/adapters/hikvision.adapter'
import * as log from '../agent/src/utils/logger'

// ─── Configuración ─────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan credenciales de Supabase')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// ─── Utilidades ───────────────────────────────────────────────────────────────────

async function getDevices() {
  const { data } = await supabase
    .from('devices')
    .select('*')
    .eq('status', 'online')
    .not('ip_address', 'is', null)

  return data || []
}

async function getConfig() {
  const { data } = await supabase
    .from('sync_config')
    .select('*')
    .limit(1)
    .single()

  return data || { enabled: false, interval_minutes: 5 }
}

// ─── Sincronización de Personas ─────────────────────────────────────────

async function syncPersonas(device: any): Promise<number> {
  const adapter = new HikvisionAdapter({
    ip: device.ip_address,
    port: 443,
    username: device.device_username || 'admin',
    password: device.device_password_encrypted || '',
  })

  try {
    const users = await adapter.getUsers()
    let synced = 0

    for (const user of users) {
      const { error } = await supabase
        .from('persons')
        .upsert({
          device_id: device.id,
          external_id: user.employeeId || user.id,
          name: user.name,
          card_number: user.cardNumber || null,
          status: 'active',
        }, { onConflict: 'device_id,external_id' })

      if (!error) synced++
    }

    return synced
  } finally {
    await adapter.disconnect()
  }
}

// ─── Sincronización de Eventos ────────────────────────────────────────────

async function syncEventos(device: any): Promise<number> {
  const adapter = new HikvisionAdapter({
    ip: device.ip_address,
    port: 443,
    username: device.device_username || 'admin',
    password: device.device_password_encrypted || '',
  })

  try {
    const events = await adapter.getEvents({ maxResults: 500 })
    let synced = 0

    for (const event of events) {
      const { error } = await supabase
        .from('events')
        .insert({
          device_id: device.id,
          event_type: event.eventType || 'access',
          timestamp: event.eventTime?.toISOString() || new Date().toISOString(),
          user_id: event.employeeId || null,
          person_name: event.employeeNo || null,
          card_number: event.cardNo || null,
          verify_type: event.verifyMode || null,
        })

      if (!error) synced++
    }

    return synced
  } finally {
    await adapter.disconnect()
  }
}

// ─── Heartbeat ─────────────��───────────────────────────────────────────────

async function runHeartbeat(device: any): Promise<boolean> {
  const adapter = new HikvisionAdapter({
    ip: device.ip_address,
    port: 443,
    username: device.device_username || 'admin',
    password: device.device_password_encrypted || '',
  })

  try {
    const health = await adapter.healthCheck()

    await supabase
      .from('devices')
      .update({
        status: health.reachable ? 'online' : 'offline',
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', device.id)

    return health.reachable
  } catch {
    await supabase
      .from('devices')
      .update({ status: 'offline' })
      .eq('id', device.id)

    return false
  } finally {
    await adapter.disconnect()
  }
}

// ─── Sync Completo ──────────────────────────────────────────────────────

async function runFullSync() {
  const devices = await getDevices()
  const config = await getConfig()

  if (!config.enabled) {
    console.log('Sync automático deshabilitado')
    return
  }

  const options = config.options || ['eventos']
  console.log(`🔄 Sincronizando ${devices.length} dispositivo(s)...`)

  let totalSync = 0

  for (const device of devices) {
    console.log(`  📱 ${device.name} (${device.ip_address})`)

    // Heartbeat siempre
    const online = await runHeartbeat(device)
    console.log(`     ❤️ Heartbeat: ${online ? 'online' : 'offline'}`)

    if (options.includes('personas')) {
      const personas = await syncPersonas(device)
      console.log(`     👥 Personas: ${personas} sincronizadas`)
      totalSync += personas
    }

    if (options.includes('eventos')) {
      const eventos = await syncEventos(device)
      console.log(`     🎫 Eventos: ${eventos} sincronizados`)
      totalSync += eventos
    }
  }

  console.log(`✅ Sync completado: ${totalSync} registros`)
}

// ─── Loop ────────────────────────────────────────────────────────────────

async function runLoop() {
  const runOnce = process.argv.includes('--once')

  if (runOnce) {
    await runFullSync()
    return
  }

  console.log('🔁 Sync Cron iniciado (Ctrl+C para detener)')

  while (true) {
    const config = await getConfig()
    const intervalMs = (config.interval_minutes || 5) * 60 * 1000

    await runFullSync()

    console.log(`⏰ Próxima sincronización en ${config.interval_minutes} minutos...`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

runLoop().catch(err => {
  console.error('Error en sync-cron:', err)
  process.exit(1)
})