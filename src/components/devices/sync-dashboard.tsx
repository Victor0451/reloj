'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Wifi, 
  WifiOff,
  Clock,
  Activity,
  Settings,
  Loader2
} from 'lucide-react'
import { getDevices } from '@/actions/devices'
import { runManualSync, type SyncOption } from '@/actions/sync'
import { getRecentSyncLogs, type SyncLog } from '@/actions/sync-logs'
import { diagnoseDevicePersons, type DeviceDiagnosticsResult } from '@/actions/device-diagnostics'
import { runConnectivityCheck, checkInactiveDevices } from '@/actions/connectivity'
import { Device } from '@/types/device.types'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type DeviceWithSync = Device

type SyncStatus = 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'

const SYNC_STATUS_CONFIG: Record<SyncStatus, { color: string; icon: React.ReactNode; label: string }> = {
  disconnected: { color: 'text-muted-foreground', icon: <WifiOff className="h-4 w-4" />, label: 'Desconectado' },
  connecting: { color: 'text-amber-500', icon: <Loader2 className="h-4 w-4 animate-spin" />, label: 'Conectando...' },
  syncing: { color: 'text-blue-500', icon: <Activity className="h-4 w-4 animate-pulse" />, label: 'Sincronizando' },
  synced: { color: 'text-emerald-500', icon: <CheckCircle className="h-4 w-4" />, label: 'Sincronizado' },
  error: { color: 'text-destructive', icon: <XCircle className="h-4 w-4" />, label: 'Error' },
}

const SYNC_LOG_TYPE_LABELS: Record<string, string> = {
  heartbeat: 'Heartbeat',
  events: 'Eventos',
  persons: 'Personas',
  door_status: 'Estado puerta',
}

const SYNC_LOG_STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  success: { className: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5', label: 'Éxito' },
  warning: { className: 'border-amber-500/20 text-amber-500 bg-amber-500/5', label: 'Aviso' },
  error: { className: 'border-destructive/20 text-destructive bg-destructive/5', label: 'Error' },
}

export function SyncDashboard() {
  const [devices, setDevices] = useState<DeviceWithSync[]>([])
  const [recentLogs, setRecentLogs] = useState<SyncLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLogsLoading, setIsLogsLoading] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [syncMode, setSyncMode] = useState<SyncOption | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [diagnosticResult, setDiagnosticResult] = useState<DeviceDiagnosticsResult | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (supabaseRef.current == null) {
    supabaseRef.current = createClient()
  }

  const fetchDashboardData = useCallback(async () => {
    try {
      const [fetchedDevices, fetchedLogs] = await Promise.all([
        getDevices(),
        getRecentSyncLogs(10),
      ])

      setDevices(fetchedDevices as DeviceWithSync[])
      setRecentLogs(fetchedLogs)
    } catch (error) {
      toast.error('Error al cargar el estado de sincronización')
      console.error(error)
    } finally {
      setIsLoading(false)
      setIsLogsLoading(false)
    }
  }, [])

  const scheduleDashboardRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = setTimeout(() => {
      void fetchDashboardData()
    }, 300)
  }, [fetchDashboardData])

  useEffect(() => {
    void fetchDashboardData()
  }, [fetchDashboardData])

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel('sync-dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
        },
        () => {
          scheduleDashboardRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_logs',
        },
        () => {
          scheduleDashboardRefresh()
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current)
      }
    }
  }, [scheduleDashboardRefresh])

  useEffect(() => {
    const interval = setInterval(() => {
      scheduleDashboardRefresh()
    }, 30000)

    return () => clearInterval(interval)
  }, [scheduleDashboardRefresh])

  async function handleRefresh() {
    setIsChecking(true)
      try {
        // Run connectivity check
        const result = await runConnectivityCheck()
      
      // Check for inactive devices
      await checkInactiveDevices(5)
      
      if (result.success) {
        toast.success('Verificación completada')
        await fetchDashboardData()
        setLastRefresh(new Date())
      } else {
        toast.error(result.error || 'Error en verificación')
      }
    } catch (error) {
      toast.error('Error al verificar conectividad')
      console.error(error)
    } finally {
      setIsChecking(false)
    }
  }

  async function handleManualSync(option: SyncOption) {
    setIsSyncing(true)
    setSyncMode(option)

    try {
      const result = await runManualSync(option)

      if (result.success) {
        const fallbackSuffix = result.fallbackUsed ? ' (fallback admin)' : ''
        toast.success(`Sync ${option}: ${result.devicesProcessed} relojes, ${result.recordsProcessed} registros${fallbackSuffix}`)
        await fetchDashboardData()
        setLastRefresh(new Date())
      } else {
        toast.error(result.error || 'Error en sincronización manual')
        await fetchDashboardData()
      }
    } catch (error) {
      toast.error('Error al ejecutar la sincronización manual')
      console.error(error)
    } finally {
      setIsSyncing(false)
      setSyncMode(null)
    }
  }

  async function handleRunDiagnostic() {
    if (!selectedDeviceId) {
      toast.error('Seleccioná un reloj para diagnosticar')
      return
    }

    setIsDiagnosing(true)

    try {
      const result = await diagnoseDevicePersons(selectedDeviceId)
      setDiagnosticResult(result)

      if (result.success) {
        toast.success(
          `Diagnóstico listo: ${result.counts.persons} persons / ${result.counts.users} users`
        )
      } else {
        toast.error(result.error || 'No se pudo ejecutar el diagnóstico')
      }
    } catch (error) {
      toast.error('Error al ejecutar el diagnóstico')
      console.error(error)
    } finally {
      setIsDiagnosing(false)
    }
  }

  // Statistics
  const stats = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    synced: devices.filter(d => d.sync_status === 'synced').length,
    errors: devices.filter(d => d.sync_status === 'error').length,
  }

  const deviceNameById = useMemo(() => {
    return new Map(devices.map((device) => [device.id, device.name]))
  }, [devices])

  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].id)
    }
  }, [devices, selectedDeviceId])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Estado de Sincronización</h2>
          <p className="text-muted-foreground">
            Monitoreo en tiempo real del Agent Bridge y sync con relojes
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <div
              className={`h-2 w-2 rounded-full ${
                isRealtimeConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span>{isRealtimeConnected ? 'En vivo' : 'Conectando Realtime...'}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => handleManualSync('personas')}
            disabled={isChecking || isSyncing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing && syncMode === 'personas' ? 'animate-spin' : ''}`} />
            {isSyncing && syncMode === 'personas' ? 'Sync personas...' : 'Sync personas'}
          </Button>
          <Button
            onClick={() => handleManualSync('eventos')}
            disabled={isChecking || isSyncing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing && syncMode === 'eventos' ? 'animate-spin' : ''}`} />
            {isSyncing && syncMode === 'eventos' ? 'Sync eventos...' : 'Sync eventos'}
          </Button>
          <Button
            onClick={() => handleManualSync('todas')}
            disabled={isChecking || isSyncing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing && syncMode === 'todas' ? 'animate-spin' : ''}`} />
            {isSyncing && syncMode === 'todas' ? 'Sync total...' : 'Sync total'}
          </Button>
          <Button 
            onClick={handleRefresh} 
            disabled={isChecking || isSyncing}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Actualizar'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Wifi className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En línea</p>
              <p className="text-2xl font-bold text-emerald-500">{stats.online}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <WifiOff className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Fuera de línea</p>
              <p className="text-2xl font-bold text-destructive">{stats.offline}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sincronizados</p>
              <p className="text-2xl font-bold text-emerald-500">{stats.synced}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Errores</p>
              <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Dispositivos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <WifiOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay dispositivos registrados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((device) => {
                const syncStatus = (device.sync_status || 'disconnected') as SyncStatus
                const config = SYNC_STATUS_CONFIG[syncStatus]
                
                return (
                  <div 
                    key={device.id} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
                  >
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        device.status === 'online' ? 'bg-emerald-500/10' : 'bg-destructive/10'
                      }`}>
                        {device.status === 'online' ? (
                          <Wifi className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      
                      {/* Device Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{device.name}</p>
                          <Badge variant={device.status === 'online' ? 'success' : 'destructive'} className="text-xs">
                            {device.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          {device.ip_address || 'Sin IP'} • {device.serial_number}
                        </p>
                      </div>
                    </div>

                    {/* Sync Status */}
                    <div className="flex items-center gap-6">
                      {/* Sync State */}
                      <div className="text-right">
                        <div className={`flex items-center gap-2 ${config.color}`}>
                          {config.icon}
                          <span className="text-sm font-medium">{config.label}</span>
                        </div>
                        {device.sync_last_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(device.sync_last_at).toLocaleString()}
                          </p>
                        )}
                      </div>

                      {/* Events Count */}
                      {device.sync_events_count !== undefined && (
                        <div className="text-right min-w-[80px]">
                          <p className="text-2xl font-bold">{device.sync_events_count}</p>
                          <p className="text-xs text-muted-foreground">eventos</p>
                        </div>
                      )}

                      {/* Error Message */}
                      {device.sync_error && (
                        <div className="max-w-[200px]">
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Error
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {device.sync_error}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Diagnóstico de personas del reloj
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium">Seleccionar reloj</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Elegí un reloj</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} — {device.ip_address || 'sin IP'}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleRunDiagnostic}
              disabled={isDiagnosing || !selectedDeviceId}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isDiagnosing ? 'animate-spin' : ''}`} />
              {isDiagnosing ? 'Diagnosticando...' : 'Listar personas del reloj'}
            </Button>
          </div>

          {diagnosticResult && (
            <div className="space-y-4 rounded-lg border border-border/60 bg-card/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={diagnosticResult.success ? 'success' : 'destructive'}>
                  {diagnosticResult.success ? 'OK' : 'Error'}
                </Badge>
                <span className="text-sm font-medium">
                  {diagnosticResult.deviceName} {diagnosticResult.ipAddress ? `(${diagnosticResult.ipAddress})` : ''}
                </span>
              </div>

              {diagnosticResult.deviceInfo && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Serial</p>
                    <p className="font-mono text-sm">{diagnosticResult.deviceInfo.serialNumber}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-xs text-muted-foreground">Modelo</p>
                    <p className="text-sm">{diagnosticResult.deviceInfo.model}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 p-3">
                    <p className="text-xs text-muted-foreground">Firmware</p>
                    <p className="text-sm">{diagnosticResult.deviceInfo.firmwareVersion}</p>
                  </div>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">getPersons()</p>
                  <p className="text-2xl font-bold">{diagnosticResult.counts.persons}</p>
                </div>
                <div className="rounded-lg border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">getUsers()</p>
                  <p className="text-2xl font-bold">{diagnosticResult.counts.users}</p>
                </div>
              </div>

              {diagnosticResult.searchProbe && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {diagnosticResult.searchProbe.endpoint}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      HTTP {diagnosticResult.searchProbe.status ?? 'n/a'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {diagnosticResult.searchProbe.matchCount} coincidencias
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {diagnosticResult.searchProbe.notes || 'Search ISAPI respondió correctamente'}
                  </p>
                  {diagnosticResult.searchProbe.matchedPeople.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {diagnosticResult.searchProbe.matchedPeople.map((person) => (
                        <div key={`search-${person.id}-${person.name}`} className="rounded-md border border-border/50 bg-background/80 p-2 text-sm">
                          <p className="font-medium">{person.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {person.employeeNo || 'sin employeeNo'} {person.cardNumber ? `• ${person.cardNumber}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {diagnosticResult.warnings.length > 0 && (
                <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
                  {diagnosticResult.warnings.map((warning) => (
                    <p key={warning} className="text-amber-700 dark:text-amber-400">
                      {warning}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Lista de persons</h4>
                  {diagnosticResult.persons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin resultados</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnosticResult.persons.map((person) => (
                        <div key={`person-${person.id}`} className="rounded-md border border-border/50 p-2 text-sm">
                          <p className="font-medium">{person.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {person.employeeNo || 'sin employeeNo'} {person.cardNumber ? `• ${person.cardNumber}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold">Lista de users</h4>
                  {diagnosticResult.users.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin resultados</p>
                  ) : (
                    <div className="space-y-2">
                      {diagnosticResult.users.map((user) => (
                        <div key={`user-${user.id}`} className="rounded-md border border-border/50 p-2 text-sm">
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.employeeNo || 'sin employeeNo'} {user.cardNumber ? `• ${user.cardNumber}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {diagnosticResult.error && (
                <p className="text-sm text-destructive">{diagnosticResult.error}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Actividad reciente de sync
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {recentLogs.length} eventos
          </Badge>
        </CardHeader>
        <CardContent>
          {isLogsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay actividad de sincronización reciente</p>
              <p className="text-xs mt-2">Cuando ejecutes sync o el agent escriba logs, aparecerán aquí en tiempo real.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => {
                const statusConfig = SYNC_LOG_STATUS_CONFIG[log.status] || SYNC_LOG_STATUS_CONFIG.warning

                return (
                  <div
                    key={log.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {SYNC_LOG_TYPE_LABELS[log.sync_type] || log.sync_type}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${statusConfig.className}`}>
                          {statusConfig.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.events_processed || 0} registros
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {log.duration_ms ? `${log.duration_ms}ms` : 'Sin duración'}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">
                          {deviceNameById.get(log.device_id || '') || log.device_id || 'Dispositivo desconocido'}
                        </span>
                      </div>
                      {log.error_message && (
                        <p className="text-sm text-destructive">{log.error_message}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground md:text-right">
                      <p>Inicio: {new Date(log.started_at).toLocaleString()}</p>
                      {log.completed_at && <p>Fin: {new Date(log.completed_at).toLocaleString()}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Refresh */}
      {lastRefresh && (
        <p className="text-xs text-muted-foreground text-center">
          Última actualización: {lastRefresh.toLocaleString()}
        </p>
      )}
    </div>
  )
}
