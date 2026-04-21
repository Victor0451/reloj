import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Users, Clock, DoorOpen, Activity, Shield, Server, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { Suspense } from 'react'

const kpiConfig = [
  {
    title: 'Total Personas',
    description: 'Registradas en el sistema',
    icon: Users,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: 'Eventos Hoy',
    description: 'Accesos registrados',
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  {
    title: 'Dispositivos',
    description: 'Conectividad en tiempo real',
    icon: Server,
  },
  {
    title: 'Puerta',
    description: 'Control remoto',
    icon: DoorOpen,
  },
]

async function KpiCards() {
  const supabase = await createClient()

  // Fetch real counts
  const [{ count: totalPersons }, { count: todayEvents }] = await Promise.all([
    supabase.from('persons').select('*', { count: 'exact', head: true }),
    supabase
      .from('access_events')
      .select('*', { count: 'exact', head: true })
      .gte('event_time', new Date().toISOString().split('T')[0]),
  ])

  // Fetch all devices for connectivity summary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: devices } = await supabase
    .from('devices')
    .select('status') as any

  // Fetch door status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: doorStatus } = await supabase
    .from('door_commands')
    .select('status, action')
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as any

  // Calculate device connectivity stats
  const onlineDevices = devices?.filter((d: any) => d.status === 'online').length || 0
  const offlineDevices = devices?.filter((d: any) => d.status === 'offline').length || 0
  const unknownDevices = devices?.filter((d: any) => d.status === 'unknown').length || 0
  const totalDevices = devices?.length || 0

  const lastDoor = doorStatus as { status: string; action: string } | null
  const doorState = lastDoor?.status === 'completed' && lastDoor?.action === 'open' ? 'open' : 'closed'

  return (
    <>
      {/* Total Personas */}
      <Card className="glass-card transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Total Personas
          </span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10`}>
            <Users className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPersons ?? 0}</div>
          <p className="mt-1 text-xs text-muted-foreground">Registradas en el sistema</p>
        </CardContent>
      </Card>

      {/* Eventos Hoy */}
      <Card className="glass-card transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Eventos Hoy
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{todayEvents ?? 0}</div>
          <p className="mt-1 text-xs text-muted-foreground">Accesos registrados</p>
        </CardContent>
      </Card>

      {/* Estado de Dispositivos */}
      <Card className="glass-card transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Dispositivos
          </span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            onlineDevices === totalDevices ? 'bg-emerald-500/10' : 
            onlineDevices > 0 ? 'bg-amber-500/10' : 'bg-destructive/10'
          }`}>
            <Server className={`h-4 w-4 ${
              onlineDevices === totalDevices ? 'text-emerald-600 dark:text-emerald-400' : 
              onlineDevices > 0 ? 'text-amber-500' : 'text-destructive'
            }`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
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
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Conectividad en tiempo real</p>
        </CardContent>
      </Card>

      {/* Estado de Puerta */}
      <Card className="glass-card transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Puerta
          </span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${doorState === 'open' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
            <DoorOpen className={`h-4 w-4 ${doorState === 'open' ? 'text-amber-600 dark:text-amber-400' : 'text-primary'}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold capitalize">
              {doorState === 'open' ? 'Abierta' : 'Cerrada'}
            </span>
            <Badge variant={doorState === 'open' ? 'warning' : 'info'}>
              {doorState}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Control remoto</p>
        </CardContent>
      </Card>
    </>
  )
}

function KpiCardsSkeleton() {
  return (
    <>
      {kpiConfig.map((kpi) => (
        <Card key={kpi.title} className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton variant="text" className="h-4 w-24" />
            <Skeleton variant="default" className="h-9 w-9 rounded-lg" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton variant="text" className="h-7 w-20" />
            <Skeleton variant="text" className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const eventsResult = await supabase
    .from('access_events')
    .select('*', { count: 'exact', head: true })

  const eventsCount = Array.isArray(eventsResult.data)
    ? eventsResult.count
    : 0

  const hasEvents = (eventsCount ?? 0) > 0

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido al sistema de gestión biométrica Hikvision
        </p>
      </div>

      {/* KPIs */}
      <div className="page-grid animate-in-premium-delay-1">
        <Suspense fallback={<KpiCardsSkeleton />}>
          <KpiCards />
        </Suspense>
      </div>

      {/* Recent Events */}
      <div className="animate-in-premium-delay-2">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="text-lg font-semibold">Últimos Eventos</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Los accesos más recientes aparecerán aquí una vez configurado el agente bridge
            </p>
          </CardHeader>
          <CardContent>
            {hasEvents ? (
              <p className="text-center text-muted-foreground py-8">
                Eventos disponibles — próximamente con tabla
              </p>
            ) : (
              <EmptyState
                icon={Shield}
                title="Sin eventos registrados aún"
                description="Iniciá el agente bridge para comenzar a sincronizar los eventos de acceso del reloj."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}