import { createClient } from '@supabase/supabase-js';

// Usar Service Role Key (para evitar problemas de RLS)
const supabase = createClient(
  'https://gpbfwcfvclxdjbjthsiq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3ODk5NywiZXhwIjoyMDkxNjU0OTk3fQ.-FrPczcOvpiGIIEar5Gww2HpUUwe15K7xvJ_3eg_y1Q'
);

async function testRealtime() {
  const { data: devices } = await supabase.from('devices').select('*').limit(1);
  
  if (devices && devices[0]) {
    const d = devices[0];
    console.log('Device:', d.name, d.serial_number);
    console.log('ID:', d.id);
    console.log('Current status:', d.status);
    console.log('---');
    console.log('Making update with Anon Key...');
    
    // Update de prueba
    const newStatus = d.status === 'online' ? 'offline' : 'online';
    const newError = newStatus === 'offline' ? 'Test: Device went offline' : null;
    
    await supabase.from('devices').update({
      status: newStatus,
      sync_status: newStatus === 'online' ? 'synced' : 'error',
      sync_error: newError,
      updated_at: new Date().toISOString(),
    }).eq('id', d.id);
    
    console.log('✅ Updated to status:', newStatus);
    console.log('');
    console.log('=== CHECK THE FRONTEND NOW ===');
    console.log('Did the card update WITHOUT pressing F5?');
    console.log('==========================');
  } else {
    console.log('No devices found');
  }
}

testRealtime();