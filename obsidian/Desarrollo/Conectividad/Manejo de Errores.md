# Manejo de Errores del Sistema de Conectividad

Documentación técnica del manejo de errores implementado en el sistema de conectividad.

## Visión General

El sistema de conectividad implementa un manejo de errores robusto y estructurado para garantizar que ante cualquier falla, el sistema mantenga un estado consistente y proporcione feedback claro tanto a desarrolladores como a usuarios finales.

## Tipos de Errores

### 1. Errores de Red

Ocurren cuando hay problemas de conectividad entre el sistema y los dispositivos Hikvision.

**Causas Comunes:**
- DNS no resuelve el nombre de host
- Timeout en la solicitud HTTP
- Puerto no accesible o bloqueado por firewall
- Red local inestable o cortada
- Dispositivo apagado o sin conexión

**Ejemplo de Error:**
```typescript
// Error de timeout
{
  status: 'offline',
  error: 'Timeout - Dispositivo no responde',
  timestamp: 2026-04-15T15:30:00.000Z
}
```

**Códigos de Error:**
- `NETWORK_ERROR`: Error genérico de red
- `TIMEOUT`: Dispositivo no respondió en tiempo esperado
- `CONNECTION_REFUSED`: Puerto bloqueado o servicio no disponible
- `HOST_UNREACHABLE`: Red inalcanzable

### 2. Errores HTTP

Ocurren cuando el dispositivo responde pero con códigos de error HTTP.

**Códigos Comunes:**
- `404 Not Found`: IP correcta pero dispositivo no responde en puerto HTTP
- `403 Forbidden`: Autenticación requerida pero no proporcionada
- `500 Internal Server Error`: Error interno del dispositivo
- `503 Service Unavailable`: Servicio temporalmente no disponible

**Ejemplo de Error:**
```typescript
{
  status: 'offline',
  error: 'HTTP 404 - Recurso no encontrado',
  timestamp: 2026-04-15T15:30:00.000Z
}
```

### 3. Errores de Aplicación

Ocurren cuando hay problemas internos en el sistema.

**Causas Comunes:**
- Base de datos no disponible
- Credenciales de Supabase inválidas
- Errores de tipeo en código
- Estados inconsistentes en datos
- Límites derate limiting excedidos

**Ejemplo de Error:**
```typescript
{
  success: false,
  error: 'Error al actualizar el estado: Supabase connection timeout'
}
```

### 4. Errores de Validación

Ocurren cuando los datos de entrada no cumplen con los requisitos.

**Causas Comunes:**
- Dirección IP mal formateada
- UUID de dispositivo no válido
- Parámetros requeridos faltantes
- Tipos de datos incorrectos

**Ejemplo de Error:**
```typescript
{
  success: false,
  error: 'Dirección IP inválida: 192.168.1'
}
```

## Estrategias de Manejo

### 1. Timeout Configurable

```typescript
const TIMEOUT_MS = 5000

export async function checkDeviceConnectivity(ipAddress: string): Promise<HealthCheckResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  
  try {
    const response = await fetch(`http://${ipAddress}`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'no-cors'
    })
    
    clearTimeout(timeoutId)
    
    // Procesar respuesta...
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          status: 'offline',
          error: 'Timeout - Dispositivo no responde',
          timestamp: new Date()
        }
      }
      
      return {
        status: 'offline',
        error: error.message,
        timestamp: new Date()
      }
    }
  }
}
```

### 2. Retry Logic

```typescript
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

async function checkWithRetry(ipAddress: string): Promise<HealthCheckResult> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await checkDeviceConnectivity(ipAddress)
      return result
    } catch (error) {
      lastError = error as Error
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
      }
    }
  }
  
  return {
    status: 'error',
    error: `Falló después de ${MAX_RETRIES} intentos: ${lastError?.message}`,
    timestamp: new Date()
  }
}
```

### 3. Estados Fallback

Cuando ocurre un error, el sistema intenta mantener estados consistentes:

```typescript
export async function updateDeviceStatus(
  deviceId: string, 
  result: HealthCheckResult
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    
    const updateData: Record<string, unknown> = {
      // Estado seguro: offline o unknown según el tipo de error
      status: result.status === 'online' ? 'online' : 'offline',
    }
    
    // Solo actualizar last_seen_at si está online
    if (result.status === 'online') {
      updateData.last_seen_at = new Date().toISOString()
    }
    
    const { error } = await supabase
      .from('devices')
      .update(updateData)
      .eq('id', deviceId)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }
  }
}
```

### 4. Logging Detallado

```typescript
export async function checkDeviceConnectivity(ipAddress: string): Promise<HealthCheckResult> {
  const startTime = Date.now()
  const startTimestamp = new Date().toISOString()
  
  console.log(`[${startTimestamp}] INFO  Iniciando verificación de conectividad para ${ipAddress}`)
  
  try {
    // Intentar verificación...
    
    const endTime = Date.now()
    const latency = endTime - startTime
    
    console.log(`[${new Date().toISOString()}] DEBUG HTTP request enviado a ${ipAddress}`)
    console.log(`[${new Date().toISOString()}] INFO  Verificación completada - Status: ${status}, Latencia: ${latency}ms`)
    
    return { status, latency, timestamp: new Date() }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR Error en verificación de ${ipAddress}:`, error)
    
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date()
    }
  }
}
```

## Feedback al Usuario

### 1. Toast Notifications

```typescript
async function handleCheckConnection() {
  if (!device.ip_address) {
    toast.error('El dispositivo no tiene una dirección IP configurada')
    return
  }

  setIsChecking(true)
  try {
    const result = await checkDeviceConnection(device.id, device.ip_address)
    
    if (result.success) {
      toast.success(`Dispositivo ${result.result?.status === 'online' ? 'en línea' : 'fuera de línea'}`)
    } else {
      toast.error('Error al verificar conexión: ' + result.error)
    }
  } catch (error) {
    toast.error('Error al verificar conexión: ' + (error as Error).message)
  } finally {
    setIsChecking(false)
  }
}
```

### 2. Estados Visuales en UI

```typescript
// Badges de estado con colores significativos
<Badge 
  variant={isOnline ? 'success' : device.status === 'offline' ? 'destructive' : 'secondary'}
  className="rounded-full px-2 py-0.5 font-bold uppercase text-[10px]"
>
  {device.status}
</Badge>

// Indicadores visuales de conectividad
{isOnline ? (
  <ShieldCheck className="h-4 w-4 text-emerald-500" />
) : (
  <ShieldAlert className="h-4 w-4 text-amber-500" />
)}
```

### 3. Mensajes de Error Amigables

```typescript
// En lugar de mensajes técnicos internos:
'ECONNREFUSED'
'ETIMEDOUT'
'ENOTFOUND'

// Mostrar mensajes amigables:
'El dispositivo no responde - verifica la conexión de red'
'La dirección IP no es accesible - verifica que el dispositivo esté encendido'
'No se puede conectar al reloj - revisa la configuración de red'
```

## Recuperación de Errores

### 1. Auto-Retry en Server Actions

```typescript
export async function checkDeviceConnection(deviceId: string, ipAddress: string) {
  const MAX_RETRIES = 3
  let attempt = 0
  let lastError: string | null = null
  
  while (attempt < MAX_RETRIES) {
    try {
      const result = await checkDeviceConnectivity(ipAddress)
      await updateDeviceStatus(deviceId, result)
      revalidatePath('/dashboard/devices')
      return { success: true, result }
    } catch (error) {
      attempt++
      lastError = error instanceof Error ? error.message : 'Error desconocido'
      
      if (attempt < MAX_RETRIES) {
        // Esperar antes de reintentar (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500))
      }
    }
  }
  
  return { success: false, error: lastError }
}
```

### 2. Fallback a Estado Offline

```typescript
export async function checkDeviceConnection(deviceId: string, ipAddress: string) {
  try {
    // Intentar verificación real
    const result = await checkDeviceConnectivity(ipAddress)
    await updateDeviceStatus(deviceId, result)
    
    return { success: true, result }
    
  } catch (error) {
    // En caso de error, marcar como offline (estado seguro)
    const fallbackResult: HealthCheckResult = {
      status: 'offline',
      error: error instanceof Error ? error.message : 'Error desconocido',
      timestamp: new Date()
    }
    
    await updateDeviceStatus(deviceId, fallbackResult)
    
    return { success: false, error: fallbackResult.error }
  }
}
```

### 3. Desconexión Progresiva

```typescript
// Si un dispositivo falla múltiples veces, reducir frecuencia de verificación
const deviceFailureCount = new Map<string, number>()
const MAX_FAILURES_BEFORE_SLOW = 3
const SLOW_CHECK_INTERVAL_MS = 60 * 1000 // 1 minuto
const NORMAL_CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 minutos

async function handleDeviceError(deviceId: string) {
  const failures = (deviceFailureCount.get(deviceId) || 0) + 1
  deviceFailureCount.set(deviceId, failures)
  
  if (failures >= MAX_FAILURES_BEFORE_SLOW) {
    // Reducir frecuencia de verificación para este dispositivo
    console.log(`Dispositivo ${deviceId} marcando como inestable - verificando con menor frecuencia`)
  }
}

async function handleDeviceSuccess(deviceId: string) {
  // Resetear contador de fallos
  deviceFailureCount.set(deviceId, 0)
}
```

## Monitoreo de Errores

### 1. Contadores de Errores

```typescript
const errorCounters = {
  networkErrors: 0,
  timeoutErrors: 0,
  httpErrors: 0,
  applicationErrors: 0,
  validationErrors: 0
}

export async function checkDeviceConnectivity(ipAddress: string): Promise<HealthCheckResult> {
  try {
    // Verificación...
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorCounters.timeoutErrors++
      } else if (error.message.includes('ECONNREFUSED')) {
        errorCounters.networkErrors++
      } else {
        errorCounters.networkErrors++
      }
    }
    
    // Retornar error estructurado...
  }
}
```

### 2. Métricas de Error

```typescript
export async function getErrorMetrics(): Promise<{
  totalErrors: number
  errorRate: number
  mostCommonError: string
  errorsByDevice: Record<string, number>
}> {
  return {
    totalErrors: Object.values(errorCounters).reduce((a, b) => a + b, 0),
    errorRate: Object.values(errorCounters).reduce((a, b) => a + b, 0) / totalChecks,
    mostCommonError: Object.entries(errorCounters)
      .sort(([, a], [, b]) => b - a)[0][0],
    errorsByDevice: deviceErrorCount
  }
}
```

### 3. Alertas por Umbrales

```typescript
const ERROR_THRESHOLDS = {
  errorRatePercent: 20,  // Alertar si > 20% de verificaciones fallan
  consecutiveErrors: 5,   // Alertar si 5 errores consecutivos
  errorCountPerHour: 50  // Alertar si > 50 errores en una hora
}

export async function checkThresholds(): Promise<void> {
  const metrics = await getErrorMetrics()
  
  if (metrics.errorRate > ERROR_THRESHOLDS.errorRatePercent) {
    await sendAlert({
      type: 'high_error_rate',
      message: `Tasa de errores elevada: ${metrics.errorRate.toFixed(2)}%`,
      severity: 'warning'
    })
  }
}
```

## Mejores Prácticas

### 1. Nunca Exponer Errores Técnicos al Usuario

```typescript
// ❌ Mal
toast.error('ECONNREFUSED: Connection refused by server at 192.168.1.100:80')

// ✅ Bien
toast.error('No se puede conectar al dispositivo - verifica que esté encendido y conectado a la red')
```

### 2. Siempre Proveer Estados Consistente

```typescript
// ❌ Mal - Retornar null o undefined en caso de error
if (error) return null

// ✅ Bien - Siempre retornar estructura completa
if (error) {
  return {
    success: false,
    error: 'Mensaje amigable',
    result: null
  }
}
```

### 3. Logear Errores para Debugging

```typescript
// Console logging detallado en desarrollo
if (process.env.NODE_ENV === 'development') {
  console.error('Error en checkDeviceConnectivity:', {
    ipAddress,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })
}

// Logging estructurado en producción (usar servicio como Datadog, etc.)
if (process.env.NODE_ENV === 'production') {
  await logErrorToService({
    service: 'connectivity',
    function: 'checkDeviceConnectivity',
    ipAddress,
    error: error.message,
    timestamp: new Date().toISOString()
  })
}
```

### 4. Implementar Circuit Breaker

```typescript
const circuitBreakerState = {
  isOpen: false,
  lastFailureTime: null,
  failureCount: 0,
  threshold: 5,
  timeout: 60 * 1000 // 1 minuto
}

async function checkWithCircuitBreaker(ipAddress: string) {
  const now = Date.now()
  
  // Si el circuit breaker está abierto
  if (circuitBreakerState.isOpen) {
    if (now - circuitBreakerState.lastFailureTime > circuitBreakerState.timeout) {
      // Intentar cerrar el circuit breaker
      circuitBreakerState.isOpen = false
      circuitBreakerState.failureCount = 0
    } else {
      // No intentar verificación, retornar fallback
      return { status: 'error', error: 'Circuit breaker abierto', timestamp: new Date() }
    }
  }
  
  try {
    const result = await checkDeviceConnectivity(ipAddress)
    circuitBreakerState.failureCount = 0
    return result
  } catch (error) {
    circuitBreakerState.failureCount++
    circuitBreakerState.lastFailureTime = now
    
    if (circuitBreakerState.failureCount >= circuitBreakerState.threshold) {
      circuitBreakerState.isOpen = true
      console.log(`Circuit breaker abierto para ${ipAddress} después de ${circuitBreakerState.failureCount} fallos`)
    }
    
    throw error
  }
}
```

---
**Última actualización:** April 15, 2026