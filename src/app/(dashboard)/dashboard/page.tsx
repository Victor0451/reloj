import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Users, Clock, DoorOpen, Activity, Shield, Server } from 'lucide-react'
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
    title: 'Dispositivo',
    description: 'Hikvision DS-K1T320MFWX',
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

  const [{ data: devices }, { data: doorStatus }] = await Promise.all([
    supabase.from('devices').select('status').limit(1).single(),
    supabase
      .from('door_commands')
      .select('status, action')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const deviceStatus = (devices as { status: string } | null)?.status ?? 'unknown'
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

      {/* Estado del Dispositivo */}
      <Card className="glass-card transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Dispositivo
          </span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${deviceStatus === 'online' ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
            <Server className={`h-4 w-4 ${deviceStatus === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold capitalize">
              {deviceStatus === 'online' ? 'Conectado' : deviceStatus === 'offline' ? 'Sin conexión' : 'Sin configurar'}
            </span>
            <Badge variant={deviceStatus === 'online' ? 'success' : deviceStatus === 'offline' ? 'destructive' : 'secondary'}>
              {deviceStatus === 'online' ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Hikvision DS-K1T320MFWX</p>
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
