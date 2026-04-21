'use client'

import { useState, useEffect } from 'react'
import { Device } from '@/types/device.types'
import { DoorCommand, DoorAction } from '@/types/door.types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DoorOpen, DoorClosed, Loader2, CheckCircle2, AlertCircle, History } from 'lucide-react'
import { sendDoorCommand, getRecentCommands } from '@/actions/door'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface DoorControlCardProps {
  device: Device
}

export function DoorControlCard({ device }: DoorControlCardProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [recentCommands, setRecentCommands] = useState<DoorCommand[]>([])
  const supabase = createClient()

  // Cargar comandos iniciales
  useEffect(() => {
    async function loadCommands() {
      const commands = await getRecentCommands(device.serial_number)
      setRecentCommands(commands)
    }
    loadCommands()

    // Suscribirse a cambios en door_commands para este dispositivo
    const channel = supabase
      .channel(`door-commands-${device.serial_number}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'door_commands',
          filter: `device_serial=eq.${device.serial_number}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRecentCommands((prev) => [payload.new as DoorCommand, ...prev].slice(0, 5))
            if ((payload.new as DoorCommand).status === 'pending') setIsProcessing(true)
          } else if (payload.eventType === 'UPDATE') {
            setRecentCommands((prev) => 
              prev.map((c) => (c.id === payload.new.id ? (payload.new as DoorCommand) : c))
            )
            const updatedCmd = payload.new as DoorCommand
            if (updatedCmd.status !== 'pending') {
              setIsProcessing(false)
              if (updatedCmd.status === 'done') toast.success(`Puerta de "${device.name}" abierta`)
              if (updatedCmd.status === 'failed') toast.error(`Error: ${updatedCmd.error_message}`)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [device.serial_number, device.name, supabase])

  async function handleAction(action: DoorAction) {
    if (isProcessing) return
    
    setIsProcessing(true)
    const result = await sendDoorCommand(device.serial_number, action)
    
    if (!result.success) {
      setIsProcessing(false)
      toast.error('No se pudo enviar el comando: ' + result.error)
    }
  }

  const isOnline = device.status === 'online'

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2 border-b border-border/10 bg-muted/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
              isOnline ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
              <DoorOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">{device.name}</h3>
              <p className="text-[10px] text-muted-foreground font-medium uppercase">{device.location || 'Local'}</p>
            </div>
          </div>
          <Badge variant={isOnline ? 'success' : 'secondary'} className="text-[9px] h-5">
            {isOnline ? 'CONECTADO' : 'OFFLINE'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        {/* Main Action */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          <div className={cn(
            "relative flex h-24 w-24 items-center justify-center rounded-full border-4 transition-all duration-500",
            isProcessing ? "border-primary border-t-transparent animate-spin" : 
            isOnline ? "border-primary/20 bg-primary/5 shadow-glow" : "border-muted bg-muted/5"
          )}>
            {!isProcessing && (
              <DoorClosed className={cn(
                "h-10 w-10 transition-colors",
                isOnline ? "text-primary" : "text-muted-foreground"
              )} />
            )}
          </div>
          
          <Button
            size="lg"
            disabled={!isOnline || isProcessing}
            onClick={() => handleAction('open')}
            className={cn(
              "btn-primary w-full max-w-[180px] shadow-lg",
              isProcessing && "opacity-80"
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Abriendo...
              </>
            ) : (
              'Abrir Puerta'
            )}
          </Button>
        </div>

        {/* Recent Commands Log */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <History className="h-3.5 w-3.5" /> Historial Reciente
          </div>
          <div className="space-y-2">
            {recentCommands.length > 0 ? (
              recentCommands.map((cmd) => (
                <div key={cmd.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 border border-border/30 text-[11px]">
                  <div className="flex items-center gap-2">
                    {cmd.status === 'done' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : cmd.status === 'failed' ? (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                    )}
                    <span className="font-semibold capitalize">{cmd.action}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(cmd.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-[11px] text-muted-foreground py-2 italic">
                No hay comandos registrados recientemente
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
