'use client'

import { useEffect, useState, useRef } from 'react'
import { Device } from '@/types/device.types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Monitor, Server, MapPin, Hash, Trash2, ShieldCheck, ShieldAlert, RefreshCw, Wifi, WifiOff, Clock, Zap, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteDevice } from '@/actions/devices'
import { checkDeviceConnection } from '@/actions/device-connectivity'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DeviceCardProps {
  device: Device
  onUpdate?: (device: Device) => void
}

export function DeviceCard({ device }: DeviceCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)
  const prevDeviceRef = useRef(device)
  const toastShownRef = useRef(false)

  // Detectar cambios del dispositivo (vía Realtime o props)
  useEffect(() => {
    const prev = prevDeviceRef.current
    
    // Comparar campos relevantes
    const hasChanged = 
      device.status !== prev.status ||
      device.last_seen_at !== prev.last_seen_at ||
      device.sync_status !== prev.sync_status ||
      device.sync_error !== prev.sync_error

    if (hasChanged) {
      prevDeviceRef.current = device
      setJustUpdated(true)
      setTimeout(() => setJustUpdated(false), 2000)
      
      // Solo mostrar toast en debug mode
      if (!toastShownRef.current) {
        toastShownRef.current = true
        setTimeout(() => { toastShownRef.current = false }, 5000)
      }
    }
  }, [device])

  const isOnline = device.status === 'online'
  const syncStatus = device.sync_status || 'disconnected'
  
  const syncStatusConfig = {
    connected: { label: 'Conectado', color: 'text-emerald-500', icon: CheckCircle2 },
    connecting: { label: 'Conectando...', color: 'text-amber-500', icon: Loader2 },
    syncing: { label: 'Sincronizando', color: 'text-blue-500', icon: RefreshCw },
    synced: { label: 'Sincronizado', color: 'text-emerald-500', icon: CheckCircle2 },
    error: { label: 'Error', color: 'text-red-500', icon: AlertCircle },
    disconnected: { label: 'Desconectado', color: 'text-muted-foreground', icon: WifiOff },
  }

  const currentSyncConfig = syncStatusConfig[syncStatus as keyof typeof syncStatusConfig] || syncStatusConfig.disconnected
  const SyncIcon = currentSyncConfig.icon

  async function handleDelete() {
    if (confirm(`¿Estás seguro de que querés eliminar el reloj "${device.name}"?`)) {
      const result = await deleteDevice(device.id)
      if (result.success) {
        toast.success('Dispositivo eliminado')
      } else {
        toast.error('Error al eliminar: ' + result.error)
      }
    }
  }

  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      const result = await checkDeviceConnection(device.id, device.ip_address || undefined)
      if (result.success) {
        toast.success('Estado del dispositivo actualizado')
      } else {
        toast.error('No se pudo actualizar: ' + (result.error || 'Error desconocido'))
      }
    } catch (error) {
      console.error('Refresh error:', error)
      toast.error('Error al verificar conectividad')
    } finally {
      setIsRefreshing(false)
    }
  }

  const lastSeenText = device.last_seen_at 
    ? `Último contacto: ${new Date(device.last_seen_at).toLocaleString([], { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      })}`
    : 'Nunca visto'

  return (
    <Card 
      className={cn(
        "glass-card group overflow-hidden transition-all duration-300 hover:shadow-premium hover:-translate-y-1",
        justUpdated && "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-background animate-pulse-once"
      )}
      style={{ animation: justUpdated ? 'pulse-once 0.5s ease-out' : undefined }}
    >
      <CardHeader className="flex flex-col items-start gap-3 pb-2">
        {/* Top row: Icon + Name + Actions */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Status indicator */}
            <div className={cn(
              "relative flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg transition-all",
              isOnline ? "bg-emerald-500/10" : "bg-muted/20"
            )}>
              {isOnline ? (
                <Wifi className="h-4 w-4 text-emerald-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              {/* Pulse ring for online */}
              {isOnline && (
                <span className="absolute inset-0 rounded-lg border border-emerald-500/40 animate-ping" />
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-sm truncate">{device.name}</h3>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate">{device.location || 'Sin ubicación'}</span>
              </div>
            </div>
          </div>
          
          {/* Action buttons - always visible */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
              title="Actualizar"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDelete}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Status badge - below */}
        <Badge 
          variant={isOnline ? 'success' : device.status === 'offline' ? 'destructive' : 'secondary'} 
          className="text-[10px] px-2 py-0.5 font-semibold uppercase"
        >
          {device.status}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4 pt-2">
        {/* Main info grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
              <Hash className="h-3 w-3" /> Serial
            </div>
            <p className="text-sm font-mono font-medium truncate">{device.serial_number}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
              <Server className="h-3 w-3" /> Modelo
            </div>
            <p className="text-sm font-medium truncate">{device.model || 'Hikvision'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
              <Monitor className="h-3 w-3" /> IP
            </div>
            <p className="text-sm font-medium">{device.ip_address || 'Sin IP'}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase">
              <Zap className="h-3 w-3" /> Sync
            </div>
            <div className={cn("flex items-center gap-1 text-sm font-medium", currentSyncConfig.color)}>
              <SyncIcon className={cn("h-3 w-3", syncStatus === 'syncing' && "animate-spin")} />
              {currentSyncConfig.label}
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className={cn(
          "flex items-center justify-between rounded-lg p-3 border transition-all duration-300",
          isOnline 
            ? "bg-emerald-500/5 border-emerald-500/20" 
            : "bg-muted/20 border-border/30"
        )}>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs font-semibold">
              {isOnline ? 'Sistema Activo' : 'Sincronización pendiente'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <Clock className="h-3 w-3" />
            {lastSeenText}
          </div>
        </div>

        {/* Error display */}
        {device.sync_error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 p-3 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-500">Error de sincronización</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{device.sync_error}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
