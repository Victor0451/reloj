'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DeviceList } from '@/components/devices/device-list'
import { AddDeviceDialog } from '@/components/devices/add-device-dialog'
import { ConnectivityCheckButton } from '@/components/devices/connectivity-check-button'
import { Button } from '@/components/ui/button'
import { DeviceListItem, DeviceStatus } from '@/types/device.types'

interface DevicesPageContentProps {
  initialDevices: DeviceListItem[]
}

const STATUS_FILTERS: Array<{ value: 'all' | DeviceStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'unknown', label: 'Desconocido' },
]

export function DevicesPageContent({ initialDevices }: DevicesPageContentProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DeviceStatus>('all')

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in-premium">
        <div className="page-header">
          <h1 className="text-3xl font-bold tracking-tight">Relojes</h1>
          <p className="text-muted-foreground">
            Gestión centralizada de dispositivos Hikvision y estado de conexión
          </p>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative w-full md:w-[260px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre, serial, IP o ubicación..."
              className="input-outlined pl-12 h-10"
            />
          </div>
          <ConnectivityCheckButton className="btn-secondary" />
          <AddDeviceDialog />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 animate-in-premium-delay-1">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            variant={statusFilter === filter.value ? 'default' : 'outline'}
            className={statusFilter === filter.value ? 'btn-primary h-8' : 'btn-secondary h-8'}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <DeviceList initialDevices={initialDevices} searchTerm={searchTerm} statusFilter={statusFilter} />

      <div className="animate-in-premium-delay-2">
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <Search className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Sincronización en tiempo real</p>
              <p className="text-xs text-muted-foreground">
                El estado se actualiza automáticamente vía Supabase Realtime y verificaciones manuales.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

