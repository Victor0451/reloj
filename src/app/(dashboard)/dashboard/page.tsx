import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Users, Clock, DoorOpen, Activity, Shield, Server, ArrowRight } from 'lucide-react'
import { Suspense } from 'react'
import Link from 'next/link'

type EventWithPerson = {
  id: string
  employee_id: string | null
  event_time: string
  event_type: string
  verify_mode: string | null
  person_name: string | null
}

const eventTypeLabels: Record<string, string> = {
  '0': 'Entrada',
  '1': 'Salida',
  '2': 'Alarmas',
  '4': 'Registro',
}

function formatEventType(value: string): string {
  return eventTypeLabels[value] ?? value
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  } catch {
    return isoString
  }
}

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
  // Fetch last 10 events using admin client for broader access
  const admin = createAdminClient()
  const { data: rawEvents } = await admin
    .from('access_events')
    .select('id, employee_id, event_time, event_type, verify_mode')
    .order('event_time', { ascending: false })
    .limit(10)

  // Collect employee_ids for batch lookup
  const employeeIds = (rawEvents ?? [])
    .map((e: { employee_id: string | null }) => e.employee_id)
    .filter((id: string | null): id is string => id !== null && id !== undefined)

  // Fetch person names in batch
  let personNameMap = new Map<string, string | null>()
  if (employeeIds.length > 0) {
    const uniqueIds = [...new Set(employeeIds)]
    const personsResult = await admin
      .from('persons')
      .select('employee_id, name')
      .in('employee_id', uniqueIds) as { data: Array<{ employee_id: string; name: string }>; error: unknown }
    if (personsResult.data) {
      for (const p of personsResult.data) {
        personNameMap.set(p.employee_id, p.name)
      }
    }
  }

  // Attach person_name to events
  const recentEvents: EventWithPerson[] = (rawEvents ?? []).map((e: {
    id: string
    employee_id: string | null
    event_time: string
    event_type: string
    verify_mode: string | null
  }) => ({
    id: e.id,
    employee_id: e.employee_id,
    event_time: e.event_time,
    event_type: e.event_type,
    verify_mode: e.verify_mode,
    person_name: e.employee_id ? personNameMap.get(e.employee_id) ?? null : null,
  }))

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
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">Últimos Eventos</span>
              </div>
              <span className="text-xs text-muted-foreground">{recentEvents.length} eventos</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Resumen de los últimos accesos registrados
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            {recentEvents.length > 0 ? (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/5 px-3 py-2.5 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Event Type Badge */}
                      <Badge
                        variant={event.event_type === '0' ? 'success' : 'secondary'}
                        className="rounded-full px-2 py-0.5 font-bold uppercase text-[10px]"
                      >
                        {formatEventType(event.event_type)}
                      </Badge>
                      {/* Person Info */}
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {event.person_name ?? '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {event.employee_id ?? 'Sin ID'}
                        </span>
                      </div>
                    </div>
                    {/* Timestamp */}
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatTimestamp(event.event_time)}
                      </span>
                      {event.verify_mode && (
                        <span className="text-[10px] text-muted-foreground">
                          {event.verify_mode}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {/* View All Link */}
                <div className="flex justify-center pt-3">
                  <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-primary">
                    <Link href="/dashboard/events">
                      Ver todos
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Shield}
                title="Sin eventos recientes"
                description="Iniciá el agente bridge para comenzar a sincronizar los eventos de acceso del reloj."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}