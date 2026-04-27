# Componentes Técnicos del Sistema de Conectividad

Descripción detallada de cada componente implementado para el sistema de conectividad.

## Librería de Conectividad (`/src/lib/device-connectivity.ts`)

### Tipos Definidos

```typescript
export type ConnectivityStatus = 'online' | 'offline' | 'checking' | 'error'
export type HealthCheckResult = {
  status: ConnectivityStatus
  latency?: number
  error?: string
  timestamp: Date
}
```

### Funciones Principales

#### `checkDeviceConnectivity(ipAddress: string): Promise<HealthCheckResult>`

Verifica la conectividad con un dispositivo mediante una solicitud HTTP simple.

**Características:**
- Timeout de 5 segundos configurable
- Manejo de errores específico (timeout, red, etc.)
- Medición de latencia
- Respuesta estructurada con información detallada

**Implementación:**
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 5000)

try {
  const response = await fetch(`http://${ipAddress}`, {
    method: 'GET',
    signal: controller.signal,
    mode: 'no-cors'
  })
  // Procesar respuesta...
} catch (error) {
  // Manejar errores...
}
```

#### `updateDeviceStatus(deviceId: string, result: HealthCheckResult): Promise<{ success: boolean; error?: string }>`

Actualiza el estado de conectividad de un dispositivo en la base de datos.

**Características:**
- Actualiza campo `status` según resultado
- Actualiza `last_seen_at` solo si está online
- Manejo de errores con mensajes específicos
- Tipado seguro de parámetros

#### `checkAllDevices(): Promise<{ /* estadísticas */ }>`

Realiza health checks para todos los dispositivos registrados.

**Características:**
- Procesamiento secuencial de dispositivos
- Estadísticas agregadas (online, offline, errores)
- Actualización de estado individual para cada dispositivo
- Manejo de dispositivos sin IP configurada

## Acciones del Servidor (`/src/actions/device-connectivity.ts`)

### `checkDeviceConnection(deviceId: string, ipAddress: string)`

Endpoint server action para verificar conectividad individual.

**Flujo:**
1. Llama a `checkDeviceConnectivity`
2. Actualiza estado en base de datos
3. Invalida caché de ruta `/dashboard/devices`
4. Retorna resultado estructurado

### `checkAllDevicesConnection()`

Endpoint server action para verificación masiva.

**Flujo:**
1. Llama a `checkAllDevices`
2. Invalida caché de ruta `/dashboard/devices`
3. Retorna resumen de resultados

### `scheduledHealthCheck()`

Endpoint para uso en tareas programadas.

**Usos:**
- Cron jobs automáticos
- Webhooks de monitoreo externo
- Verificaciones manuales programadas

## Componentes de Interfaz (`/src/components/devices/`)

### `DeviceCard` - Botón de Verificación Individual

Agregado botón de refresh que permite verificar conectividad individual:

```tsx
<Button 
  variant="ghost" 
  size="icon" 
  onClick={handleCheckConnection}
  disabled={isChecking || !device.ip_address}
>
  <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
</Button>
```

**Características:**
- Solo habilitado si hay IP configurada
- Indicador visual de verificación en progreso
- Feedback mediante toasts
- Actualización automática del estado mostrado

### `ConnectivityCheckButton` - Componente Reutilizable

Botón para verificación masiva reutilizable:

```tsx
export function ConnectivityCheckButton({ className }: ConnectivityCheckButtonProps) {
  const [isChecking, setIsChecking] = useState(false)
  const router = useRouter()

  async function handleCheckAllDevices() {
    setIsChecking(true)
    try {
      const result = await checkAllDevicesConnection()
      if (result.success) {
        toast.success('Verificación de conectividad completada')
        router.refresh()
      }
    } finally {
      setIsChecking(false)
    }
  }
}
```

## Página de Conectividad (`/src/app/(dashboard)/dashboard/connectivity/page.tsx`)

Panel de control dedicado con información completa de conectividad.

### Secciones Principales

1. **Resumen de Conectividad**
   - Total de dispositivos
   - Dispositivos online/offline/desconocidos
   - Indicadores visuales con colores

2. **Controles de Verificación**
   - Botón para verificación manual
   - Timestamp de última verificación
   - Estado de operación en tiempo real

3. **Lista Detallada**
   - Tarjetas individuales por dispositivo
   - Información de IP y serial
   - Estado de última conexión
   - Indicadores visuales de estado

### Características UX

- Animaciones suaves de carga
- Skeletons durante carga inicial
- Estados vacíos con íconos explicativos
- Responsive design para móviles

## Dashboard Mejorado (`/src/app/(dashboard)/dashboard/page.tsx`)

Resumen de conectividad integrado en dashboard principal.

### KPI de Dispositivos

```tsx
<span className="text-2xl font-bold">
  {totalDevices > 0 ? `${onlineDevices}/${totalDevices}` : '0'}
</span>
<Badge 
  variant={
    totalDevices === 0 ? 'secondary' :
    onlineDevices === totalDevices ? 'success' : 
    onlineDevices > 0 ? 'warning' : 'destructive'
  }
>
  {totalDevices === 0 ? 'Sin dispositivos' :
   onlineDevices === totalDevices ? 'Todos online' : 
   onlineDevices > 0 ? `${onlineDevices} online` : 'Todos offline'}
</Badge>
```

## Tareas Programadas (`/src/lib/cron-jobs.ts`)

Funciones para ejecución automatizada.

### `runConnectivityCheck()`

Ejecuta verificación completa de conectividad.

**Casos de Uso:**
- Cron jobs cada X minutos
- Verificación nocturna completa
- Mantenimiento preventivo

### `checkInactiveDevices(minutesWithoutContact: number = 5)`

Marca dispositivos como offline si no se han visto en X tiempo.

**Algoritmo:**
1. Calcula tiempo límite (ahora - minutos)
2. Busca dispositivos online con `last_seen_at` anterior
3. Actualiza su estado a offline
4. Retorna estadísticas

## Scripts de Utilidad (`/scripts/check-connectivity.ts`)

Script ejecutable para tareas programadas fuera del servidor web.

```typescript
#!/usr/bin/env ts-node

async function main() {
  console.log('🚀 Iniciando script de verificación de conectividad...')
  
  try {
    const result = await runConnectivityCheck()
    
    if (result.success) {
      console.log('✅ Verificación completada exitosamente')
      console.log(result.message)
    }
  } catch (error) {
    console.error('❌ Error inesperado:')
    console.error(error)
    process.exit(1)
  }
}
```

## Configuración de Cron Jobs (`/CRON_JOBS.md`)

Documentación detallada de configuración de tareas programadas.

### Métodos Soportados

1. **Crontab (Linux/Mac)**
   ```bash
   */2 * * * * curl -s https://tu-dominio.com/api/check-connectivity
   */5 * * * * cd /ruta/al/proyecto && node scripts/check-inactivity.js
   ```

2. **GitHub Actions**
   ```yaml
   on:
     schedule:
       - cron: '*/2 * * * *'
   jobs:
     connectivity-check:
       runs-on: ubuntu-latest
       steps:
         - name: Call Health Check API
           run: curl -H "Authorization: Bearer ${{ secrets.CRON_AUTH_TOKEN }}" ...
   ```

## Manejo de Errores

### Tipos de Errores Considerados

1. **Red/Conectividad**
   - Timeout configurado (5 segundos)
   - DNS no resuelve
   - Puerto cerrado
   - Firewall bloqueando

2. **HTTP/Servidor**
   - Códigos de error HTTP
   - Respuestas vacías
   - Headers incorrectos

3. **Aplicación**
   - Base de datos no disponible
   - Datos inválidos
   - Estados inconsistentes

### Estrategias de Manejo

- Logging detallado de errores
- Feedback claro al usuario
- Estados fallback razonables
- Reintentos inteligentes

---
**Última actualización:** April 15, 2026