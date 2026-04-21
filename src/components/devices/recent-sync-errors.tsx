'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Clock, Loader2 } from 'lucide-react'
import { getRecentSyncErrors } from '@/actions/sync-logs'
import { SyncLog } from '@/actions/sync-logs'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const SYNC_TYPE_LABELS: Record<string, string> = {
  heartbeat: 'Heartbeat',
  events: 'Eventos',
  persons: 'Personas',
  door_status: 'Estado Puerta',
}

export function RecentSyncErrors() {
  const [errors, setErrors] = useState<SyncLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (supabaseRef.current == null) {
    supabaseRef.current = createClient()
  }

  const fetchErrors = useCallback(async () => {
    try {
      const data = await getRecentSyncErrors(20)
      setErrors(data)
    } catch (error) {
      toast.error('Error al cargar errores')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchErrors()
  }, [fetchErrors])

  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }

      refreshTimerRef.current = setTimeout(() => {
        void fetchErrors()
      }, 300)
    }

    const channel = supabase
      .channel('recent-sync-errors-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_logs',
        },
        scheduleRefresh
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
  }, [fetchErrors])

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchErrors()
    }, 45000)

    return () => clearInterval(interval)
  }, [fetchErrors])

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Errores Recientes de Sincronización
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {isRealtimeConnected ? 'En vivo' : 'Conectando...'}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchErrors}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : errors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No hay errores recientes</p>
            <Badge variant="success" className="mt-2">
              ✓ Sistema funcionando correctamente
            </Badge>
          </div>
        ) : (
          <div className="space-y-3">
            {errors.map((error) => (
              <div 
                key={error.id}
                className="flex items-start justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {SYNC_TYPE_LABELS[error.sync_type] || error.sync_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {error.duration_ms ? `${error.duration_ms}ms` : '-'}
                      </span>
                    </div>
                    <p className="text-sm mt-1 max-w-md">
                      {error.error_message || 'Error desconocido'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(error.started_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
