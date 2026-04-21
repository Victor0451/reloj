import { listEvents } from '@/actions/events'
import { EventsTable } from '@/components/events'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export default async function EventsPage() {
  // Initial load: fetch first page of events (no cursor)
  const initialData = await listEvents({}, undefined)

  return (
    <div className="space-y-8">
      <div className="animate-in-premium page-header">
        <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
        <p className="text-muted-foreground">
          Listado de eventos de acceso con filtros y exportación
        </p>
      </div>

      <div className="animate-in-premium-delay-1">
        <EventsTable
          initialEvents={initialData.events}
          initialNextCursor={initialData.nextCursor}
          initialHasMore={initialData.hasMore}
          initialTotalCount={initialData.totalCount}
        />
      </div>
    </div>
  )
}