import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gpbfwcfvclxdjbjthsiq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3ODk5NywiZXhwIjoyMDkxNjU0OTk3fQ.-FrPczcOvpiGIIEar5Gww2HpUUwe15K7xvJ_3eg_y1Q'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data: devices } = await supabase
    .from('devices')
    .select('*')
    .eq('status', 'online')

  console.log('Dispositivos online:', devices?.length || 0)
  devices?.forEach(d => console.log(' -', d.name, d.ip_address))
}

test()