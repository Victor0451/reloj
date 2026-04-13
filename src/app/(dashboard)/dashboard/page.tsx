import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, DoorOpen, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get user info
  const { data: { user } } = await supabase.auth.getUser()
  
  // TODO: Fetch real data from Supabase
  const stats = {
    totalPersons: 0,
    todayEvents: 0,
    deviceStatus: 'offline' as string,
    doorStatus: 'closed' as string,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido al sistema de gestión biométrica Hikvision
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Personas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPersons}</div>
            <p className="text-xs text-muted-foreground">
              Registradas en el sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos Hoy</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayEvents}</div>
            <p className="text-xs text-muted-foreground">
              Accesos registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado del Dispositivo</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold capitalize">
                {stats.deviceStatus}
              </span>
              <Badge variant={stats.deviceStatus === 'online' ? 'default' : 'destructive'}>
                {stats.deviceStatus === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de Puerta</CardTitle>
            <DoorOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold capitalize">
                {stats.doorStatus}
              </span>
              <Badge variant={stats.doorStatus === 'open' ? 'destructive' : 'default'}>
                {stats.doorStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for recent events */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos Eventos</CardTitle>
          <CardDescription>
            Los accesos más recientes aparecerán aquí una vez configurado el agente bridge
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Sin eventos registrados aún
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
