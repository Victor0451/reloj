import { Suspense } from 'react'
import { DoorOpen, ShieldCheck, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getDevices } from '@/actions/devices'
import { DoorControlCard } from '@/components/door/door-control-card'
import { Skeleton } from '@/components/ui/skeleton'

async function DoorControlList() {
  const devices = await getDevices()
  const onlineDevices = devices.filter(d => d.status === 'online')

  if (devices.length === 0) {
    return (
      <Card className="glass-card border-dashed border-border/50 bg-muted/10 py-16">
        <CardContent className="flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/5">
            <DoorOpen className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="mb-2 text-xl font-bold">No hay relojes configurados</h3>
          <p className="mx-auto mb-4 max-w-sm text-muted-foreground">
            Primero debés registrar un reloj en la sección de "Relojes" para poder controlarlo de forma remota.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="page-grid animate-in-premium-delay-1">
      {devices.map((device) => (
        <DoorControlCard key={device.id} device={device} />
      ))}
    </div>
  )
}

function DoorControlSkeleton() {
  return (
    <div className="page-grid animate-in-premium-delay-1">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="glass-card h-[380px]">
          <div className="p-6 space-y-8">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-10 w-40 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function DoorControlPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Control de Puerta</h1>
        <p className="text-muted-foreground">
          Gestión remota de accesos y estado físico de puertas
        </p>
      </div>

      {/* Control Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in-premium-delay-1">
        <Card className="glass-card bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-bold">Conexión Segura</p>
              <p className="text-[11px] text-muted-foreground">Comandos cifrados vía ISAPI</p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card bg-primary/5 border-primary/20 md:col-span-2">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Tiempo de Respuesta</p>
              <p className="text-[11px] text-muted-foreground">Latencia estimada inferior a 3 segundos a través del Agente Bridge local.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control List */}
      <Suspense fallback={<DoorControlSkeleton />}>
        <DoorControlList />
      </Suspense>
    </div>
  )
}
