# Troubleshooting del Sistema de Conectividad

Guía de diagnóstico y resolución de problemas comunes en el sistema de conectividad.

## Diagnóstico Rápido

### Indicadores de Problema

| Síntoma | Posible Causa | Verificación |
|---------|---------------|--------------|
| Todos los dispositivos en "offline" | Problema de red o firewall | Verificar conexión a internet y puertos |
| Un dispositivo específico offline | IP incorrecta o dispositivo apagado | Ping directo al dispositivo |
| Errores de timeout frecuentes | Red lenta o dispositivo saturado | Medir latencia promedio |
| Estado no se actualiza | Problema de Realtime o caché | Verificar suscripción en Supabase |
| Verificación manual funciona pero automática no | Cron job mal configurado | Revisar configuración de tareas programadas |

## Problemas Comunes y Soluciones

### 1. Dispositivo Siempre Muestra "Offline"

**Síntoma:**
Un dispositivo específico siempre aparece como offline aunque el dispositivo está encendido y accesible.

**Pasos de Diagnóstico:**

1. **Verificar IP:**
```bash
# Hacer ping directo al dispositivo
ping 192.168.1.100

# Si no responde, verificar configuración de red
arp -a | grep 192.168.1.100
```

2. **Verificar Puerto HTTP:**
```bash
# Probar conexión HTTP directa
curl -v http://192.168.1.100

# Si usa puerto diferente
curl -v http://192.168.1.100:8000
```

3. **Verificar Firewall:**
```bash
# En Linux, verificar reglas de iptables
sudo iptables -L -n | grep 192.168.1.100

# En Mac, verificar firewall
sudo ipfw list
```

**Solución:**
- Si el dispositivo responde a ping pero no a HTTP, verificar que el servicio HTTP esté habilitado en el dispositivo Hikvision
- Si el dispositivo no responde a ping, verificar cables de red y configuración de red del dispositivo
- Verificar que no haya firewall bloqueando las solicitudes HTTP

### 2. Errores de Timeout en Verificaciones

**Síntoma:**
Las verificaciones de conectividad fallan con errores de timeout.

**Causas Posibles:**
- Red lenta o congestionada
- Dispositivo con alta carga
- Timeout demasiado corto
- Firewall o router中间 traduciendo conexiones

**Solución:**

1. **Aumentar Timeout:**
```typescript
// En device-connectivity.ts
const TIMEOUT_MS = 10000 // Aumentar de 5000 a 10000ms
```

2. **Verificar Latencia de Red:**
```bash
# Medir latencia promedio
ping -c 20 192.168.1.100

# Ver estadísticas
ping -c 100 192.168.1.100 | tail -1
```

3. **Optimizar Verificaciones:**
```typescript
// Reducir carga en verificaciones masivas
async function checkAllDevices() {
  const devices = await getDevices()
  const results = []
  
  // Procesar en batches para no sobrecargar red
  const BATCH_SIZE = 3
  for (let i = 0; i < devices.length; i += BATCH_SIZE) {
    const batch = devices.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(d => checkDeviceConnectivity(d.ip_address))
    )
    results.push(...batchResults)
    
    // Pequeña pausa entre batches
    if (i + BATCH_SIZE < devices.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
  
  return results
}
```

### 3. Base de Datos No Se Actualiza

**Síntoma:**
El estado del dispositivo cambia en la verificación pero la base de datos no refleja el cambio.

**Pasos de Diagnóstico:**

1. **Verificar Supabase:**
```bash
# Ver logs de Supabase en dashboard
# Ir a: Supabase Dashboard > Logs
```

2. **Verificar Permisos:**
```sql
-- En SQL Editor de Supabase
SELECT * FROM devices WHERE id = 'tu-device-id';

-- Verificar que la tabla permite updates
-- Ir a: Supabase Dashboard > Table Editor > devices > Policies
```

3. **Verificar Tipo de Usuario:**
```typescript
// En la función updateDeviceStatus, verificar que usa el cliente correcto
const supabase = await createClient() // Cliente autenticado
// vs
const supabase = await createAdminClient() // Cliente admin
```

**Solución:**
- Verificar que el usuario tiene permisos RLS (Row Level Security) para actualizar la tabla devices
- Agregar política si no existe:
```sql
CREATE POLICY "Allow update for authenticated users"
ON devices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
```

### 4. Realtime No Funciona

**Síntoma:**
Los cambios de estado no se reflejan automáticamente en la UI sin recargar la página.

**Pasos de Diagnóstico:**

1. **Verificar Suscripción:**
```typescript
// En device-list.tsx, verificar que la suscripción está activa
useEffect(() => {
  const channel = supabase
    .channel('devices-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'devices' },
      (payload) => {
        console.log('Realtime event received:', payload)
        // Actualizar estado...
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [supabase])
```

2. **Verificar Realtime en Supabase:**
```bash
# Ir a: Supabase Dashboard > Database > Replication
# Verificar que la tabla 'devices' está habilitada para Realtime
```

3. **Verificar Cliente:**
```typescript
// Crear cliente con Realtime habilitado
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
```

**Solución:**
- Habilitar Realtime para la tabla devices en Supabase Dashboard
- Verificar que el cliente Supabase está configurado correctamente
- Verificar que no hay errores de CORS bloqueando WebSocket

### 5. Tareas Programadas No Se Ejecutan

**Síntoma:**
Las verificaciones automáticas no se ejecutan según lo configurado.

**Pasos de Diagnóstico:**

1. **Verificar Configuración de Cron:**
```bash
# Ver tareas programadas activas
crontab -l

# Ver logs de cron
grep CRON /var/log/syslog
# En Mac
log show --predicate 'subsystem == "com.vix.cron"' --last 1h
```

2. **Verificar Script:**
```bash
# Ejecutar script manualmente para verificar que funciona
cd /ruta/al/proyecto
node scripts/check-connectivity.js

# Verificar permisos de ejecución
chmod +x scripts/check-connectivity.ts
```

3. **Verificar Variables de Entorno:**
```bash
# En el script, verificar que las variables están disponibles
echo $CRON_AUTH_TOKEN
echo $NEXT_PUBLIC_SUPABASE_URL
```

**Solución:**
- Reiniciar servicio de cron:
```bash
# Linux
sudo systemctl restart cron

# Mac
sudo launchctl unload /var/log/reloj/com.example.reloj.plist
sudo launchctl load /var/log/reloj/com.example.reloj.plist
```
- Agregar logging al script para verificar ejecución:
```typescript
// Al inicio del script
console.log(`[${new Date().toISOString()}] INFO  Script iniciado - PID: ${process.pid}`)
console.log(`[${new Date().toISOString()}] INFO  Variables de entorno:`, {
  hasCronToken: !!process.env.CRON_AUTH_TOKEN,
  hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL
})
```

### 6. Alto Uso de Recursos

**Síntoma:**
El servidor o la aplicación muestran alto uso de CPU o memoria.

**Pasos de Diagnóstico:**

1. **Identificar Procesos Pesados:**
```bash
# Ver procesos Node.js
ps aux | grep node | grep -v grep

# Ver uso de memoria
free -h

# Ver I/O de disco
iostat -x 1 5
```

2. **Verificar Verificaciones Concurrentes:**
```typescript
// El problema puede ser demasiadas verificaciones simultáneas
// En lugar de Promise.all para todas, usar queue

import { Queue } from 'bull'

const checkQueue = new Queue('device-checks', {
  redis: { host: 'localhost', port: 6379 },
  concurrency: 5 // Máximo 5 verificaciones simultáneas
})

checkQueue.process(async (job) => {
  const { deviceId, ipAddress } = job.data
  return await checkDeviceConnection(deviceId, ipAddress)
})
```

3. **Optimizar Consultas a Base de Datos:**
```typescript
// En lugar de actualizar cada dispositivo individualmente
// Usar upsert masivo

const updates = results.map(r => ({
  id: r.deviceId,
  status: r.result.status,
  last_seen_at: r.result.status === 'online' ? new Date().toISOString() : null
}))

// Una sola llamada en lugar de N llamadas
await supabase.from('devices').upsert(updates)
```

**Solución:**
- Implementar cola de trabajos para verificaciones
- Reducir frecuencia de verificaciones automáticas
- Implementar caché agresivo para resultados

## Herramientas de Diagnóstico

### 1. Script de Diagnóstico

```typescript
// /scripts/diagnose-connectivity.ts
#!/usr/bin/env ts-node

import { createClient } from '../src/lib/supabase/server'
import { checkDeviceConnectivity } from '../src/lib/device-connectivity'

async function diagnose() {
  const supabase = await createClient()
  
  console.log('🔍 Iniciando diagnóstico de conectividad...\n')
  
  // 1. Obtener todos los dispositivos
  const { data: devices, error: devicesError } = await supabase
    .from('devices')
    .select('*')
  
  if (devicesError) {
    console.error('❌ Error al obtener dispositivos:', devicesError)
    return
  }
  
  console.log(`📊 Total de dispositivos: ${devices.length}\n`)
  
  // 2. Verificar cada dispositivo
  for (const device of devices) {
    console.log(`\n🔎 Verificando: ${device.name} (${device.ip_address})`)
    
    if (!device.ip_address) {
      console.log('   ⚠️  Sin dirección IP configurada')
      continue
    }
    
    try {
      const result = await checkDeviceConnectivity(device.ip_address)
      
      console.log(`   Estado actual en BD: ${device.status}`)
      console.log(`   Estado real: ${result.status}`)
      console.log(`   Última conexión: ${device.last_seen_at || 'Nunca'}`)
      
      if (result.latency) {
        console.log(`   Latencia: ${result.latency}ms`)
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
      
      if (device.status !== result.status) {
        console.log('   ⚠️  INCONSISTENCIA: Estado en BD diferente al real')
      }
    } catch (error) {
      console.log(`   ❌ Error en verificación: ${error}`)
    }
  }
  
  console.log('\n✅ Diagnóstico completado')
}

diagnose()
```

### 2. Dashboard de Estado

Crear una página de diagnóstico en `/dashboard/diagnostics`:

```tsx
// /src/app/(dashboard)/dashboard/diagnostics/page.tsx
'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { getDevices } from '@/actions/devices'
import { checkDeviceConnection } from '@/actions/device-connectivity'

export default function DiagnosticsPage() {
  // ... UI y lógica de diagnóstico
}
```

### 3. Logs de Verificación

Habilitar logging detallado:

```typescript
// En device-connectivity.ts
const DEBUG_MODE = process.env.NODE_ENV === 'development'

function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    console.log(`[${new Date().toISOString()}] DEBUG ${message}`, data || '')
  }
}

export async function checkDeviceConnectivity(ipAddress: string) {
  debugLog(`Iniciando verificación`, { ipAddress })
  
  const startTime = Date.now()
  
  try {
    const response = await fetch(...)
    const latency = Date.now() - startTime
    
    debugLog(`Verificación exitosa`, { 
      ipAddress, 
      latency,
      status: response.ok ? 'online' : 'offline'
    })
    
    return { status: 'online', latency, timestamp: new Date() }
  } catch (error) {
    debugLog(`Verificación fallida`, { 
      ipAddress, 
      error: error.message 
    })
    
    return { status: 'offline', error: error.message, timestamp: new Date() }
  }
}
```

## Contacto y Soporte

Para problemas que no pueden resolverse con esta guía:

1. **Revisar Logs:**
```bash
# En servidor de producción
tail -f /var/log/reloj/error.log
tail -f /var/log/reloj/connectivity.log
```

2. **Verificar Estado de Servicios:**
```bash
# Estado de Supabase
curl -s https://.supabase.co/health

# Estado de la aplicación
curl -s https://tu-dominio.com/api/health
```

3. **Contactar al Equipo:**
- Email: soporte@empresa.com
- Slack: #reloj-support
- Jira: Proyecto RELOJ

---
**Última actualización:** April 15, 2026