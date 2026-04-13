import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, DoorOpen, Activity, TrendingUp, Shield, Server } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get user info
  const { data: { user } } = await supabase.auth.getUser()

  // TODO: Fetch real data from Supabase
  const stats = {
    totalPersons: 0,
    todayEvents: 0,
    deviceStatus: 'offline',
    doorStatus: 'closed',
  }

  const kpis = [
    {
      title: 'Total Personas',
      value: stats.totalPersons,
      description: 'Registradas en el sistema',
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      trend: null,
    },
    {
      title: 'Eventos Hoy',
      value: stats.todayEvents,
      description: 'Accesos registrados',
      icon: Clock,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      trend: null,
    },
    {
      title: 'Dispositivo',
      value: stats.deviceStatus === 'online' ? 'Conectado' : 'Sin conexión',
      description: 'Hikvision DS-K1T320MFWX',
      icon: Server,
      color: stats.deviceStatus === 'online' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      bgColor: stats.deviceStatus === 'online' ? 'bg-emerald-500/10' : 'bg-destructive/10',
      trend: null,
    },
    {
      title: 'Puerta',
      value: stats.doorStatus === 'open' ? 'Abierta' : 'Cerrada',
      description: 'Control remoto',
      icon: DoorOpen,
      color: stats.doorStatus === 'open' ? 'text-amber-600 dark:text-amber-400' : 'text-primary',
      bgColor: stats.doorStatus === 'open' ? 'bg-amber-500/10' : 'bg-primary/10',
      trend: null,
    },
  ]

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
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.title} className="glass-card transition-all duration-300 hover:shadow-premium hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </span>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.bgColor}`}>
                  <Icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{kpi.value}</span>
                  {kpi.title === 'Dispositivo' && (
                    <Badge
                      variant={stats.deviceStatus === 'online' ? 'default' : 'destructive'}
                      className={stats.deviceStatus === 'online' ? 'bg-emerald-500 text-white' : ''}
                    >
                      {stats.deviceStatus === 'online' ? 'Online' : 'Offline'}
                    </Badge>
                  )}
                  {kpi.title === 'Puerta' && (
                    <Badge variant={stats.doorStatus === 'open' ? 'destructive' : 'secondary'}>
                      {stats.doorStatus}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {kpi.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Events Placeholder */}
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-muted/20 py-16 text-center">
              <Shield className="mb-3 h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                Sin eventos registrados aún
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Iniciá el agente bridge para comenzar a sincronizar
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
