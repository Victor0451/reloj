'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Server, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getDevices } from '@/actions/devices'
import { runConnectivityCheck } from '@/actions/connectivity'
import { Device } from '@/types/device.types'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function ConnectivityPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabase = createClient()

  const fetchDevices = useCallback(async () => {
    try {
      const fetchedDevices = await getDevices()
      setDevices(fetchedDevices || [])
    } catch (error) {
      toast.error('Error al cargar dispositivos')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel('connectivity-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          console.log('[Connectivity Realtime] Device update:', payload)

          if (payload.eventType === 'UPDATE') {
            const updatedDevice = payload.new as Device
            setDevices(prev => 
              prev.map(d => d.id === updatedDevice.id ? updatedDevice : d)
            )
          }
        }
      )
      .subscribe((status) => {
        console.log('[Connectivity] Subscription status:', status)
        setIsRealtimeConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [supabase])

  async function handleCheckAllDevices() {
    setIsChecking(true)
    try {
      const result = await runConnectivityCheck()
      if (result.success) {
        toast.success('Verificación completada')
        await fetchDevices()
        setLastChecked(new Date())
      } else {
        toast.error(result.error || 'Error en verificación')
      }
    } catch (error) {
      toast.error('Error al verificar conexiones')
    } finally {
      setIsChecking(false)
    }
  }

  // Stats
  const onlineDevices = devices.filter(d => d.status === 'online').length
  const offlineDevices = devices.filter(d => d.status === 'offline').length
  const unknownDevices = devices.filter(d => d.status === 'unknown').length

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Conectividad</h1>
        <p className="text-muted-foreground">
          Estado de conexión y monitoreo de dispositivos
        </p>
      </div>

      {/* Realtime Status */}
      <div className="flex items-center gap-2 text-sm">
        <div className={cn(
          "w-2 h-2 rounded-full transition-colors",
          isRealtimeConnected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
        )} />
        <span className="text-muted-foreground">
          {isRealtimeConnected 
            ? 'Actualizaciones en tiempo real activas' 
            : 'Conectando a actualizaciones en tiempo real...'}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in-premium-delay-1">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{devices.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Wifi className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">En línea</p>
              <p className="text-2xl font-bold text-emerald-500">{onlineDevices}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <WifiOff className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Fuera de línea</p>
              <p className="text-2xl font-bold text-destructive">{offlineDevices}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Desconocido</p>
              <p className="text-2xl font-bold text-amber-500">{unknownDevices}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in-premium-delay-1">
        <div>
          <h2 className="text-lg font-semibold">Estado de Dispositivos</h2>
          <p className="text-sm text-muted-foreground">
            Verificación de conectividad en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            {lastChecked ? (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Última verificación: {lastChecked.toLocaleTimeString()}
              </span>
            ) : (
              'Aún no se ha realizado ninguna verificación'
            )}
          </div>
          <Button 
            onClick={handleCheckAllDevices} 
            disabled={isChecking || isLoading}
            className="btn-primary"
          >
            <RefreshCw className={isChecking ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            {isChecking ? 'Verificando...' : 'Verificar Todos'}
          </Button>
        </div>
      </div>

      {/* Device List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in-premium-delay-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="glass-card h-40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-20 bg-muted rounded animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : devices.length === 0 ? (
          <Card className="glass-card col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Server className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium mb-1">No hay dispositivos registrados</h3>
              <p className="text-muted-foreground">
                Registra tu primer dispositivo para comenzar a monitorear su conectividad.
              </p>
            </CardContent>
          </Card>
        ) : (
          devices.map((device) => {
            const isOnline = device.status === 'online'
            const isOffline = device.status === 'offline'
            
            return (
              <Card key={device.id} className="glass-card hover:shadow-premium transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        isOnline ? "bg-emerald-500/10" : 
                        isOffline ? "bg-destructive/10" : "bg-amber-500/10"
                      )}>
                        {isOnline ? (
                          <Wifi className="h-5 w-5 text-emerald-500" />
                        ) : isOffline ? (
                          <WifiOff className="h-5 w-5 text-destructive" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium">{device.name}</h3>
                        <p className="text-xs text-muted-foreground font-mono">
                          {device.serial_number}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={isOnline ? 'success' : isOffline ? 'destructive' : 'secondary'}
                      className="rounded-full px-2 py-0.5 font-bold uppercase text-[10px]"
                    >
                      {device.status}
                    </Badge>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">IP:</span>
                      <span className="font-mono">{device.ip_address || 'Sin IP'}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Última conexión:</span>
                      <span>
                        {device.last_seen_at 
                          ? new Date(device.last_seen_at).toLocaleString() 
                          : 'Nunca'}
                      </span>
                    </div>
                    
                    {isOnline && device.last_seen_at && (
                      <div className="flex items-center text-xs text-emerald-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Conectado ahora
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
