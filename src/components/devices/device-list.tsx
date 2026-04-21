'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DeviceListItem, DeviceStatus } from '@/types/device.types'
import { DeviceCard } from '@/components/devices/device-card'
import { Card, CardContent } from '@/components/ui/card'
import { Monitor } from 'lucide-react'
import { AddDeviceDialog } from '@/components/devices/add-device-dialog'
import { toast } from 'sonner'

interface DeviceListProps {
  initialDevices: DeviceListItem[]
  searchTerm?: string
  statusFilter?: 'all' | DeviceStatus
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

function DeviceCardWithKey({ device }: { device: DeviceListItem }) {
  return <DeviceCard device={device} />
}

type RealtimeDevicePayload = {
  id?: string
  name?: string
  serial_number?: string
  brand?: string | null
  model?: string | null
  ip_address?: string | null
  firmware_version?: string | null
  status?: DeviceStatus
  last_seen_at?: string | null
  location?: string | null
  sync_status?: string | null
  sync_error?: string | null
  sync_last_at?: string | null
  sync_events_count?: number | null
  last_event_synced_at?: string | null
  updated_at?: string | null
}

function mapRealtimeDeviceToListItem(device: RealtimeDevicePayload): DeviceListItem | null {
  if (!device.id || !device.name || !device.serial_number) return null

  return {
    id: device.id,
    name: device.name,
    serial_number: device.serial_number,
    brand: device.brand || 'hikvision',
    model: device.model ?? null,
    ip_address: device.ip_address ?? null,
    firmware_version: device.firmware_version ?? null,
    status: device.status || 'unknown',
    last_seen_at: device.last_seen_at ?? null,
    location: device.location ?? null,
    sync_status: device.sync_status || 'disconnected',
    sync_error: device.sync_error ?? null,
    sync_last_at: device.sync_last_at ?? null,
    sync_events_count: device.sync_events_count ?? 0,
    last_event_synced_at: device.last_event_synced_at ?? null,
    updated_at: device.updated_at ?? new Date().toISOString(),
  }
}

export function DeviceList({
  initialDevices,
  searchTerm = '',
  statusFilter = 'all',
}: DeviceListProps) {
  const [devices, setDevices] = useState<DeviceListItem[]>(initialDevices)
  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  if (supabaseRef.current == null) {
    supabaseRef.current = createClient()
  }

  const filteredDevices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()

    return devices.filter((device) => {
      const matchesStatus = statusFilter === 'all' ? true : device.status === statusFilter
      if (!matchesStatus) return false

      if (!q) return true

      return (
        device.name.toLowerCase().includes(q) ||
        device.serial_number.toLowerCase().includes(q) ||
        (device.ip_address || '').toLowerCase().includes(q) ||
        (device.location || '').toLowerCase().includes(q)
      )
    })
  }, [devices, searchTerm, statusFilter])

  useEffect(() => {
    setDevices(initialDevices)
  }, [initialDevices])

  // Handle Realtime changes
  function handleRealtimeChange(payload: {
    eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | string
    type?: 'INSERT' | 'UPDATE' | 'DELETE' | string
    new?: RealtimeDevicePayload
    old?: RealtimeDevicePayload
  }) {
    const eventType = payload.eventType || payload.type

    if (eventType === 'INSERT') {
      const newDevice = mapRealtimeDeviceToListItem(payload.new || {})
      if (!newDevice) return
      setDevices((prev) => [...prev, newDevice])
      toast.success(`➕ ${newDevice.name} agregado`)
    } else if (eventType === 'UPDATE') {
      const updatedDevice = mapRealtimeDeviceToListItem(payload.new || {})
      if (!updatedDevice) return
      setDevices((prev) => prev.map((d) => (d.id === updatedDevice.id ? updatedDevice : d)))
    } else if (eventType === 'DELETE') {
      const deletedId = payload.old?.id
      if (!deletedId) return
      setDevices((prev) => prev.filter((d) => d.id !== deletedId))
      if (payload.old?.name) {
        toast.success(`❌ ${payload.old.name} eliminado`)
      }
    }
  }

  // Setup Realtime subscription
  useEffect(() => {
    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel('devices-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        handleRealtimeChange
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  if (filteredDevices.length === 0) {
    return (
      <Card className="glass-card border-dashed border-border/50 bg-muted/10 py-16">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/5">
            <Monitor className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="mb-2 text-xl font-bold">
            {devices.length === 0 ? 'No hay relojes registrados' : 'Sin resultados'}
          </h3>
          <p className="mx-auto mb-8 max-w-sm text-muted-foreground">
            {devices.length === 0
              ? 'Registrá tu primer dispositivo Hikvision para comenzar a sincronizar fichajes y controlar accesos.'
              : 'No encontramos relojes que coincidan con los filtros actuales.'}
          </p>
          <AddDeviceDialog />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors",
            isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-amber-500 animate-pulse"
          )} />
          {isConnected ? (
            <span className="text-emerald-500 font-medium">● En vivo</span>
          ) : (
            <span className="text-amber-500">Conectando...</span>
          )}
        </div>
      </div>

      <div className="page-grid animate-in-premium-delay-1">
        {filteredDevices.map((device) => (
          <DeviceCardWithKey 
            key={`${device.id}-${device.updated_at || device.last_seen_at || 'init'}`}
            device={device}
          />
        ))}
      </div>
    </div>
  )
}
