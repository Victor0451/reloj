# Tareas Programadas del Sistema de Conectividad

Documentación técnica de las tareas programadas implementadas para el monitoreo automático de conectividad.

## Visión General

Las tareas programadas permiten la verificación automática y periódica de la conectividad de los dispositivos sin intervención manual. Estas tareas se ejecutan en segundo plano y mantienen actualizado el estado de los dispositivos en tiempo real.

## Tareas Implementadas

### 1. Verificación de Conectividad (`runConnectivityCheck`)

**Frecuencia Recomendada:** Cada 2-5 minutos

**Propósito:** Verificar la conectividad de todos los dispositivos registrados y actualizar sus estados.

**Implementación:**
```typescript
// /src/lib/cron-jobs.ts
export async function runConnectivityCheck() {
  try {
    console.log('Iniciando verificación de conectividad programada...')
    
    // Ejecutar health check de todos los dispositivos
    const results = await checkAllDevices()
    
    console.log(`Verificación completada: ${results.online} online, ${results.offline} offline, ${results.errors} errores`)
    
    return {
      success: true,
      message: `Health check completado: ${results.online} online, ${results.offline} offline, ${results.errors} errores`,
      results
    }
  } catch (error) {
    console.error('Error en verificación de conectividad programada:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en health check programado'
    }
  }
}
```

**Resultados:**
- Actualización automática de estado en base de datos
- Logging detallado de resultados
- Posibilidad de enviar notificaciones

### 2. Verificación de Inactividad (`checkInactiveDevices`)

**Frecuencia Recomendada:** Cada 5 minutos

**Propósito:** Marcar como offline los dispositivos que no han sido vistos en un cierto periodo de tiempo.

**Implementación:**
```typescript
// /src/lib/cron-jobs.ts
export async function checkInactiveDevices(minutesWithoutContact: number = 5) {
  try {
    const supabase = await createClient()
    
    // Calcular el tiempo límite
    const cutoffTime = new Date(Date.now() - minutesWithoutContact * 60 * 1000).toISOString()
    
    // Obtener dispositivos que no han sido vistos desde cutoffTime
    const { data: inactiveDevices, error } = await supabase
      .from('devices')
      .select('id, name, last_seen_at')
      .lt('last_seen_at', cutoffTime)
      .eq('status', 'online')
    
    if (error) {
      throw new Error(`Error al obtener dispositivos inactivos: ${error.message}`)
    }
    
    // Marcar dispositivos inactivos como offline
    let updatedCount = 0
    for (const device of inactiveDevices) {
      const { error: updateError } = await supabase
        .from('devices')
        .update({ status: 'offline' })
        .eq('id', device.id)
      
      if (!updateError) {
        updatedCount++
      }
    }
    
    console.log(`Marcados ${updatedCount} dispositivos como offline por inactividad`)
    
    return {
      success: true,
      inactiveDevices: updatedCount
    }
  } catch (error) {
    console.error('Error al verificar dispositivos inactivos:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar dispositivos inactivos'
    }
  }
}
```

**Lógica:**
- Identifica dispositivos online cuyo `last_seen_at` es anterior al límite
- Actualiza su estado a 'offline'
- Evita falsos positivos por verificaciones recientes

## Configuración de Ejecución

### Método 1: Crontab (Linux/Mac)

**Configuración básica:**
```bash
# Editar crontab
crontab -e

# Agregar tareas
*/2 * * * * curl -s -H "Authorization: Bearer $CRON_AUTH_TOKEN" https://tu-dominio.com/api/check-connectivity >> /var/log/reloj-connectivity.log 2>&1
*/5 * * * * cd /ruta/al/proyecto && NODE_ENV=production node scripts/check-inactivity.js >> /var/log/reloj-inactivity.log 2>&1
```

**Horarios recomendados:**
- Verificación de conectividad: Cada 2 minutos (`*/2 * * * *`)
- Verificación de inactividad: Cada 5 minutos (`*/5 * * * *`)

### Método 2: GitHub Actions

```yaml
name: Health Check

on:
  schedule:
    - cron: '*/2 * * * *'  # Cada 2 minutos
  workflow_dispatch:  # Permitir ejecución manual

jobs:
  connectivity-check:
    runs-on: ubuntu-latest
    steps:
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Call Health Check API
        run: |
          curl -s -H "Authorization: Bearer ${{ secrets.CRON_AUTH_TOKEN }}" \
            https://tu-dominio.com/api/check-connectivity
          
      - name: Log Result
        run: echo "Health check executed at $(date)"
```

### Método 3: Servicios Externos (Cron-job.org, etc.)

Muchos servicios ofrecen interfaces web para programar solicitudes HTTP:

1. Crear cuenta en servicio de cron externo
2. Configurar URL de destino: `https://tu-dominio.com/api/check-connectivity`
3. Agregar headers:
   ```
   Authorization: Bearer TU_TOKEN_AQUI
   Content-Type: application/json
   ```
4. Establecer frecuencia deseada

## Variables de Entorno

### Requeridas

```bash
# Token de autenticación para endpoints protegidos
CRON_AUTH_TOKEN=tu-token-secreto-aqui

# URL base de la aplicación (para logging)
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# Configuración de Supabase
NEXT_PUBLIC_SUPABASE_URL=tu-url-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### Opcionales

```bash
# Directorio de logs (si se usa logging a archivos)
LOG_DIR=/var/log/reloj

# Nivel de logging
LOG_LEVEL=info

# Timeout para verificaciones individuales (milisegundos)
CONNECTIVITY_TIMEOUT=5000
```

## Scripts Ejecutables

### Script de Verificación de Conectividad

```typescript
// /scripts/check-connectivity.ts
#!/usr/bin/env ts-node

import { runConnectivityCheck } from '../src/lib/cron-jobs'

async function main() {
  console.log('🚀 Iniciando script de verificación de conectividad...')
  
  try {
    const result = await runConnectivityCheck()
    
    if (result.success) {
      console.log('✅ Verificación completada exitosamente')
      console.log(result.message)
    } else {
      console.error('❌ Error en la verificación:')
      console.error(result.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error inesperado:')
    console.error(error)
    process.exit(1)
  }
  
  console.log('👋 Finalizando script de verificación de conectividad')
}

// Solo ejecutar si el script se llama directamente
if (require.main === module) {
  main()
}

export default main
```

### Script de Verificación de Inactividad

```typescript
// /scripts/check-inactivity.ts
#!/usr/bin/env ts-node

import { checkInactiveDevices } from '../src/lib/cron-jobs'

async function main() {
  console.log('🔍 Iniciando script de verificación de inactividad...')
  
  try {
    // Verificar dispositivos inactivos por 5 minutos
    const result = await checkInactiveDevices(5)
    
    if (result.success) {
      console.log(`✅ Verificación completada: ${result.inactiveDevices} dispositivos marcados como offline`)
    } else {
      console.error('❌ Error en la verificación:')
      console.error(result.error)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ Error inesperado:')
    console.error(error)
    process.exit(1)
  }
  
  console.log('👋 Finalizando script de verificación de inactividad')
}

if (require.main === module) {
  main()
}

export default main
```

## Monitoreo y Logging

### Niveles de Logging

1. **INFO**: Operaciones normales y resultados
2. **WARN**: Situaciones que requieren atención
3. **ERROR**: Errores que impiden funcionamiento correcto

### Formato de Logs

```log
[2026-04-15 15:30:00] INFO  🚀 Iniciando script de verificación de conectividad...
[2026-04-15 15:30:01] INFO  Iniciando verificación de conectividad programada...
[2026-04-15 15:30:30] INFO  Verificación completada: 4 online, 1 offline, 0 errores
[2026-04-15 15:30:31] INFO  ✅ Verificación completada exitosamente
[2026-04-15 15:30:31] INFO  👋 Finalizando script de verificación de conectividad
```

### Archivos de Log

Recomendado dividir logs por tipo de tarea:

- `/var/log/reloj/connectivity.log` - Verificaciones de conectividad
- `/var/log/reloj/inactivity.log` - Verificaciones de inactividad
- `/var/log/reloj/error.log` - Errores generales

## Manejo de Errores

### Errores Comunes

1. **Network Errors**
   - DNS no resuelve
   - Timeout en solicitud HTTP
   - Puerto no accesible

2. **Authentication Errors**
   - Token inválido/expirado
   - Headers incorrectos

3. **Database Errors**
   - Conexión fallida
   - Permisos insuficientes
   - Datos inconsistentes

### Estrategias de Recuperación

1. **Retry Logic**: Reintento automático de operaciones fallidas (3 intentos máximo)
2. **Fallback States**: Estados consistentes en caso de errores
3. **Alerting**: Notificaciones por email/slack en errores críticos

## Alertas y Notificaciones

### Configuración de Notificaciones

Posible implementación futura:

```typescript
// En función runConnectivityCheck
if (results.offline > 0 || results.errors > 0) {
  // Enviar notificación de alerta
  
  // Email
  await sendEmail({
    to: 'admin@empresa.com',
    subject: '⚠️ Dispositivos Offline Detectados',
    body: `
      Se han detectado ${results.offline} dispositivos offline:
      ${results.results
        .filter(r => r.result.status === 'offline')
        .map(r => `- ${r.deviceId}: ${r.result.error}`)
        .join('\n')}
    `
  });
  
  // Slack/Webhook
  await sendSlackNotification({
    text: `🚨 ${results.offline} dispositivos offline detectados`,
    attachments: results.results
      .filter(r => r.result.status === 'offline')
      .map(r => ({
        color: 'danger',
        text: `Dispositivo ${r.deviceId} offline: ${r.result.error}`
      }))
  });
}
```

## Métricas y Dashboards

### Métricas Recopiladas

1. **Tiempos de Respuesta**
   - Promedio por dispositivo
   - Percentiles (95th, 99th)
   - Histórico de latencias

2. **Disponibilidad**
   - Uptime por dispositivo (%)
   - Tiempo medio entre fallos (MTBF)
   - Tiempo medio para recuperación (MTTR)

3. **Errores**
   - Tipo de errores más comunes
   - Frecuencia de errores
   - Tendencias de errores

### Visualización

Posible implementación en dashboard:

```sql
-- Query para uptime diario
SELECT 
  DATE(last_seen_at) as dia,
  COUNT(*) as total_dispositivos,
  COUNT(CASE WHEN status = 'online' THEN 1 END) as online,
  ROUND(COUNT(CASE WHEN status = 'online' THEN 1 END) * 100.0 / COUNT(*), 2) as porcentaje_online
FROM devices 
WHERE last_seen_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(last_seen_at)
ORDER BY dia DESC;
```

## Pruebas de Tareas Programadas

### Pruebas Unitarias

```typescript
// __tests__/cron-jobs.test.ts
describe('Tareas Programadas', () => {
  test('runConnectivityCheck debería retornar resultados válidos', async () => {
    const result = await runConnectivityCheck();
    
    expect(result.success).toBe(true);
    expect(result.results).toHaveProperty('total');
    expect(result.results).toHaveProperty('online');
    expect(result.results).toHaveProperty('offline');
  });

  test('checkInactiveDevices debería identificar dispositivos inactivos', async () => {
    const result = await checkInactiveDevices(5); // 5 minutos
    
    expect(result.success).toBe(true);
    expect(typeof result.inactiveDevices).toBe('number');
  });
});
```

### Pruebas de Integración

- Ejecución completa de tareas programadas
- Verificación de actualización en base de datos
- Prueba de notificaciones (mockeadas)
- Manejo de estados concurrentes

## Mejoras Futuras

### 1. Distribución de Cargas

Para muchos dispositivos, distribuir verificaciones:

```typescript
// Verificar subconjuntos de dispositivos en turnos diferentes
const batchSize = 10;
const batchNumber = Math.floor(Date.now() / (2 * 60 * 1000)) % Math.ceil(totalDevices / batchSize);

const devicesToCheck = allDevices.slice(batchNumber * batchSize, (batchNumber + 1) * batchSize);
```

### 2. Priorización de Dispositivos

Verificar dispositivos críticos con mayor frecuencia:

```typescript
// En configuración de dispositivo
{
  id: 'critial-door-01',
  name: 'Puerta Principal',
  priority: 'high', // high, medium, low
  checkInterval: 1  // minutos
}
```

### 3. Verificación Avanzada

Implementar métodos de verificación más sofisticados:

- Puerto específico (80, 443, 8000)
- Servicios específicos
- Certificados SSL
- SNMP checks

### 4. Self-Healing

Intentar reconexión automática:

```typescript
// Si un dispositivo está offline, intentar reconnectarlo
if (device.status === 'offline' && device.reconnectionAttempts < 3) {
  // Enviar comando de reinicio al dispositivo
  await sendRebootCommand(device);
  
  // Incrementar contador de intentos
  device.reconnectionAttempts++;
}
```

---
**Última actualización:** April 15, 2026