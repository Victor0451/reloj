import { createClient } from '@supabase/supabase-js'
import { HikvisionAdapter } from '../agent/src/adapters/hikvision.adapter'

const supabaseUrl = 'https://gpbfwcfvclxdjbjthsiq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3ODk5NywiZXhwIjoyMDkxNjU0OTk3fQ.-FrPczcOvpiGIIEar5Gww2HpUUwe15K7xvJ_3eg_y1Q'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSync() {
  // Get device
  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('status', 'online')
    .limit(1)
    .single()

  if (!devices) {
    console.log('No hay dispositivos')
    return
  }

  console.log('Sincronizando eventos de:', devices.name, devices.ip_address)

  const adapter = new HikvisionAdapter({
    ip: devices.ip_address,
    port: 443,
    username: devices.device_username || 'admin',
    password: devices.device_password_encrypted || '',
  })

  try {
    const events = await adapter.getEvents({ maxResults: 100 })

    console.log('Eventos obtenidos:', events.length)

    // Save to DB
    let saved = 0
    for (const event of events) {
      const { error } = await supabase
        .from('events')
        .insert({
          device_id: devices.id,
          event_type: event.eventType || 'access',
          timestamp: event.eventTime?.toISOString() || new Date().toISOString(),
          user_id: event.employeeId || null,
          person_name: event.employeeNo || null,
          card_number: event.cardNo || null,
          verify_type: event.verifyMode || null,
        })

      if (!error) saved++
    }

    console.log('Eventos guardados:', saved)
  } finally {
    await adapter.disconnect()
  }
}

testSync()