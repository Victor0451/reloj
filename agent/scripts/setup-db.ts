import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gpbfwcfvclxdjbjthsiq.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3ODk5NywiZXhwIjoyMDkxNjU0OTk3fQ.-FrPczcOvpiGIIEar5Gww2HpUUwe15K7xvJ_3eg_y1Q'
);

async function setup() {
  // Delete all existing devices
  await supabase.from('devices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Create a test device
  const { data, error } = await supabase.from('devices').insert({
    serial_number: 'Hik_192_168_1_175',
    name: 'Test Device',
    model: 'DS-K1T320MFWX',
    brand: 'hikvision',
    ip_address: '192.168.1.175',
    status: 'online',
    sync_status: 'synced',
  }).select().single();
  
  if (error) {
    console.log('Insert error:', error.message);
  } else {
    console.log('Created device ID:', data.id);
    console.log('Serial:', data.serial_number);
  }
}

setup();