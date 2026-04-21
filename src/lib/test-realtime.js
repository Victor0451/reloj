/**
 * Test Realtime - Pegá esto en la consola del browser
 * para verificar si el Realtime está funcionando
 */

const supabaseUrl = 'https://gpbfwcfvclxdjbjthsiq.supabase.co';
const supabaseKey = document.querySelector('script[data-supabase-key]')?.getAttribute('data-supabase-key') || localStorage.getItem('sb-access-token');

// Crear cliente de prueba
const testRealtime = async () => {
  console.log('🧪 Testing Supabase Realtime...');
  
  // Obtener el primer dispositivo
  const devicesResp = await fetch(`${supabaseUrl}/rest/v1/devices?select=id,name,status&limit=1`, {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzg5OTcsImV4cCI6MjA5MTY1NDk5N30.4oCJF2BV9okcZWCVIzb9AoDvpfnjGukNENBoMFMy9cg',
      'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzg5OTcsImV4cCI6MjA5MTY1NDk5N30.4oCJF2BV9okcZWCVIzb9AoDvpfnjGukNENBoMFMy9cg`,
    }
  });
  
  const devices = await devicesResp.json();
  
  if (!devices || devices.length === 0) {
    console.error('❌ No hay dispositivos en la base de datos');
    return;
  }
  
  const device = devices[0];
  console.log('📱 Dispositivo encontrado:', device);
  
  // Conectar a Realtime
  const ws = new WebSocket(`wss://gpbfwcfvclxdjbjthsiq.supabase.co/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNzg5OTcsImV4cCI6MjA5MTY1NDk5N30.4oCJF2BV9okcZWCVIzb9AoDvpfnjGukNENBoMFMy9cg&timestamp=1`);
  
  ws.onopen = () => {
    console.log('✅ WebSocket conectado');
    
    // Suscribirse a cambios en devices
    ws.send(JSON.stringify({
      type: 'subscribe',
      topic: 'postgres_changes',
      event: '*',
      schema: 'public',
      table: 'devices',
      filter: `id=eq.${device.id}`,
    }));
    
    console.log('📡 Suscrito a cambios en devices...');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('📬 Mensaje recibido:', data);
    
    if (data.topic === 'postgres_changes') {
      console.log('🎉 CAMBIO DETECTADO EN REALTIME!', data);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ Error de WebSocket:', error);
  };
  
  // Test: hacer un update manual en la DB después de 3 segundos
  setTimeout(async () => {
    console.log('🔄 Intentando hacer un update de prueba...');
    
    const updateResp = await fetch(`${supabaseUrl}/rest/v1/devices?id=eq.${device.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3ODk5NywiZXhwIjoyMDkxNjU0OTk3fQ.-FrPczcOvpiGIIEar5Gww2HpUUwe15K7xvJ_3eg_y1Q',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwYmZ3Y2Z2Y2x4ZGpianRoc2lxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjA3ODk5NywiZXhwIjoyMDkxNjU0OTk3fQ.-FrPczcOvpiGIIEar5Gww2HpUUwe15K7xvJ_3eg_y1Q`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    });
    
    if (updateResp.ok) {
      console.log('✅ Update enviado');
    } else {
      console.error('❌ Error en update:', await updateResp.text());
    }
  }, 3000);
  
  // Cerrar después de 10 segundos
  setTimeout(() => {
    ws.close();
    console.log('🔚 Test completado');
  }, 10000);
};

testRealtime();
