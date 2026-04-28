'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDebouncedCallback } from 'use-debounce'
import { createClient } from '@/lib/supabase/client'
import { listEvents, getEventTypes, type EventFilters } from '@/actions/events'
import type { EventWithPerson } from '@/types/event.types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportEventsCsv } from '@/actions/events'
import { cn } from '@/lib/utils'

interface EventsTableProps {
  initialEvents: EventWithPerson[]
  initialNextCursor: string | null
  initialHasMore: boolean
  initialTotalCount: number
}

// Map event_type to readable labels
const eventTypeLabels: Record<string, string> = {
  '0': 'Entrada',
  '1': 'Salida',
  // New labels from device event types
  'checkIn': 'Entrada',
  'checkOut': 'Salida',
  'overTimeOut': 'Salida ext.',
  'attendance_unknown': 'Evento',
  'duress_alarm': 'Alarma',
  'access_granted': 'Permitido',
  'access_denied': 'Denegado',
}

function getEventTypeVariant(eventType: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (eventType) {
    case '0':
    case 'checkIn':
      return 'success'
    case '1':
    case 'checkOut':
    case 'overTimeOut':
      return 'warning'
    case 'access_denied':
    case 'duress_alarm':
      return 'destructive'
    default:
      return 'secondary'
  }
}

function formatEventType(value: string): string {
  return eventTypeLabels[value] ?? value
}

// Format timestamp for display: "21/04/2026 14:30"
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

export default function EventsTable({
  initialEvents,
  initialNextCursor,
  initialHasMore,
  initialTotalCount,
}: EventsTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Filter state from URL params
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '')
  const [eventType, setEventType] = useState(searchParams.get('eventType') ?? '')
  const [employeeSearch, setEmployeeSearch] = useState(searchParams.get('employee') ?? '')

  // Data state
  const [events, setEvents] = useState<EventWithPerson[]>(initialEvents)
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [totalCount, setTotalCount] = useState(initialTotalCount)

  // Pagination state (for prev navigation)
  const [prevCursor, setPrevCursor] = useState<string | null>(null)
  const [cursorHistory, setCursorHistory] = useState<string[]>([])

  // Loading and available event types
  const [loading, setLoading] = useState(false)
  const [eventTypes, setEventTypes] = useState<string[]>([])

  // Realtime state
  const [isConnected, setIsConnected] = useState(false)
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Load event types on mount
  useEffect(() => {
    getEventTypes().then(setEventTypes).catch(console.error)
  }, [])

  // Setup Supabase Realtime subscription
  useEffect(() => {
    // Initialize Supabase client
    if (supabaseRef.current == null) {
      supabaseRef.current = createClient()
    }
    const supabase = supabaseRef.current
    if (!supabase) return

    // Throttle: ignore events within 1 second of each other
    function shouldProcessEvent(): boolean {
      const now = Date.now()
      if (now - lastUpdateRef.current < 1000) {
        return false
      }
      lastUpdateRef.current = now
      return true
    }

    // Handle realtime INSERT events
    async function handleRealtimeInsert(payload: {
      eventType?: string
      new?: {
        id?: string
        event_time?: string
        employee_id?: string | null
        person_id?: string | null
        person_name?: string | null
        event_type?: string
        verify_mode?: string | null
      }
    }) {
      if (!shouldProcessEvent()) return

      const newEvent = payload.new
      if (!newEvent?.id || !newEvent?.event_time) return

      // Resolve person_name from person_id or employee_id
      let resolvedName: string | null = newEvent.person_name ?? null
      if (!resolvedName && (newEvent.person_id || newEvent.employee_id)) {
        try {
          const supabase = supabaseRef.current!
          let personQuery = supabase.from('persons').select('name')
          
          if (newEvent.person_id) {
            personQuery = personQuery.eq('id', newEvent.person_id).limit(1)
          } else if (newEvent.employee_id) {
            personQuery = personQuery.eq('employee_id', newEvent.employee_id).limit(1)
          }
          
          const { data: personData } = await personQuery.single()
          if (personData && 'name' in personData) {
            resolvedName = (personData as { name: string }).name
          }
        } catch (err) {
          console.warn('Failed to resolve person name from realtime event:', err)
        }
      }

      const event: EventWithPerson = {
        id: newEvent.id,
        event_time: newEvent.event_time,
        employee_id: newEvent.employee_id ?? null,
        person_name: resolvedName,
        event_type: newEvent.event_type ?? '0',
        verify_mode: newEvent.verify_mode ?? null,
        device_serial: null,
        person_id: newEvent.person_id ?? null,
        major: null,
        minor: null,
        synced_at: new Date().toISOString(),
        raw_payload: null,
      }

      // Add new event to top of list
      setEvents((prev) => [event, ...prev])

      // Highlight the new event row
      setHighlightedEventId(event.id)
      setTimeout(() => setHighlightedEventId(null), 2500)
    }

    const channel = supabase
      .channel('events-realtime-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'access_events'
        },
        handleRealtimeInsert
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

  // Build current filters from state
  function getFilters(): EventFilters {
    return {
      dateStart: dateFrom || undefined,
      dateEnd: dateTo || undefined,
      eventType: eventType || undefined,
      employeeId: employeeSearch || undefined,
    }
  }

  // Fetch data helper
  const fetchData = useCallback(
    async (cursor?: string) => {
      setLoading(true)
      try {
        const filters = getFilters()
        const result = await listEvents(filters, cursor)

        setEvents(result.events)
        setNextCursor(result.nextCursor)
        setHasMore(result.hasMore)
        setTotalCount(result.totalCount)

        // Update URL params
        const params = new URLSearchParams()
        if (dateFrom) params.set('dateFrom', dateFrom)
        if (dateTo) params.set('dateTo', dateTo)
        if (eventType) params.set('eventType', eventType)
        if (employeeSearch) params.set('employee', employeeSearch)
        if (cursor) params.set('cursor', cursor)

        router.replace(`?${params.toString()}`, { scroll: false })
      } catch (error) {
        console.error('Error fetching events:', error)
        toast.error('Error al cargar eventos')
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateFrom, dateTo, eventType, employeeSearch, router]
  )

  // Fetch with explicit filters (avoids stale state closure)
  const fetchDataWithFilters = useCallback(
    async (filters: EventFilters, cursor?: string) => {
      setLoading(true)
      try {
        const result = await listEvents(filters, cursor)

        setEvents(result.events)
        setNextCursor(result.nextCursor)
        setHasMore(result.hasMore)
        setTotalCount(result.totalCount)

        // Update URL params
        const params = new URLSearchParams()
        if (filters.dateStart) params.set('dateFrom', filters.dateStart)
        if (filters.dateEnd) params.set('dateTo', filters.dateEnd)
        if (filters.eventType) params.set('eventType', filters.eventType)
        if (filters.employeeId) params.set('employee', filters.employeeId)
        if (cursor) params.set('cursor', cursor)

        router.replace(`?${params.toString()}`, { scroll: false })
      } catch (error) {
        console.error('Error fetching events:', error)
        toast.error('Error al cargar eventos')
      } finally {
        setLoading(false)
      }
    },
    [router]
  )

  // Debounced employee search
  const debouncedFetch = useDebouncedCallback(() => {
    // Validate date range
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error('Rango de fechas inválido')
      return
    }
    // Reset pagination on filter change
    setCursorHistory([])
    setPrevCursor(null)
    fetchData()
  }, 300)

  function handleDateFromChange(value: string) {
    setDateFrom(value)
    debouncedFetch()
  }

  function handleDateToChange(value: string) {
    setDateTo(value)
    debouncedFetch()
  }

  function handleEventTypeChange(value: string) {
    setEventType(value)
    setCursorHistory([])
    setPrevCursor(null)

    // Pass filters directly instead of relying on state (setEventType is async)
    const filters: EventFilters = {
      dateStart: dateFrom || undefined,
      dateEnd: dateTo || undefined,
      eventType: value || undefined,
      employeeId: employeeSearch || undefined,
    }
    fetchDataWithFilters(filters)
  }

  function handleEmployeeSearchChange(value: string) {
    setEmployeeSearch(value)
    debouncedFetch()
  }

  // Pagination handlers
  function handleNextPage() {
    if (!hasMore || !nextCursor) return

    // Save current cursor for prev navigation
    const currentCursor = cursorHistory.length > 0
      ? cursorHistory[cursorHistory.length - 1]
      : null

    setCursorHistory([...cursorHistory, currentCursor ?? ''])
    setPrevCursor(currentCursor)

    fetchData(nextCursor)
  }

  function handlePrevPage() {
    if (cursorHistory.length === 0) return

    const newHistory = [...cursorHistory]
    newHistory.pop()
    const prev = newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined

    setCursorHistory(newHistory)
    setPrevCursor(prev ?? null)

    // Fetch with previous cursor
    fetchData(prev)
  }

  // Clear filters
  function handleClearFilters() {
    setDateFrom('')
    setDateTo('')
    setEventType('')
    setEmployeeSearch('')
    setCursorHistory([])
    setPrevCursor(null)
    fetchDataWithFilters({})
  }

  // Export CSV
  async function handleExportCsv() {
    try {
      const filters = getFilters()
      const csv = await exportEventsCsv(filters)

      if (!csv) {
        toast.error('No hay eventos para exportar')
        return
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `eventos-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success('CSV exportado correctamente')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Error al exportar CSV')
    }
  }

  // Check if any filters are active
  const hasActiveFilters = dateFrom || dateTo || eventType || employeeSearch

  // Calculate showing range
  const startItem = totalCount > 0 ? cursorHistory.length * 50 + 1 : 0
  const showingFrom = startItem
  const showingTo = cursorHistory.length * 50 + events.length

  return (
    <div className="space-y-6">
      {/* Toolbar / Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4 animate-in-premium">
        {/* Realtime Status */}
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

        {/* Date From */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Desde</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="h-10 w-auto"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Hasta</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="h-10 w-auto"
          />
        </div>

        {/* Event Type Select */}
        <select
          value={eventType}
          onChange={(e) => handleEventTypeChange(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium outline-none transition-all focus:border-primary focus:ring-3 focus:ring-primary/15"
        >
          <option value="">Todos los tipos</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {formatEventType(type)}
            </option>
          ))}
        </select>

        {/* Employee Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="ID de empleado..."
            value={employeeSearch}
            onChange={(e) => handleEmployeeSearchChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="btn-secondary h-10 px-4"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}

        {/* Export CSV */}
        <Button
          variant="outline"
          onClick={handleExportCsv}
          className="btn-secondary h-10 px-4 ml-auto"
        >
          <Download className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Exportar CSV</span>
        </Button>
      </div>

      {/* Table Container */}
      <Card className="glass-card overflow-hidden border-border/50 animate-in-premium-delay-1">
        {loading ? (
          <div className="p-1">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-muted/5">
                  {['Fecha/Hora', 'ID Empleado', 'Nombre', 'Tipo', 'Modo'].map((h) => (
                    <TableHead key={h} className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-border/30">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <Skeleton className="h-5 w-full rounded-md" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : events.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50 bg-muted/5">
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                    Fecha/Hora
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                    ID Empleado
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                    Nombre
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                    Tipo
                  </TableHead>
                  <TableHead className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground h-11">
                    Modo
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    className={cn(
                      "border-border/30 hover:bg-muted/10 transition-colors",
                      event.id === highlightedEventId && "bg-emerald-500/10 ring-2 ring-emerald-500/50 animate-pulse-once"
                    )}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatTimestamp(event.event_time)}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-medium text-xs">
                      {event.employee_id ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {event.person_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getEventTypeVariant(event.event_type)}
                        className="rounded-full px-2 py-0.5 font-bold uppercase text-[9px]"
                      >
                        {formatEventType(event.event_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {event.verify_mode ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              icon={Clock}
              title={hasActiveFilters ? 'Sin resultados' : 'Sin eventos registrados'}
              description={
                hasActiveFilters
                  ? 'No se encontraron eventos con los filtros seleccionados'
                  : 'Una vez configurado el agente bridge, los eventos de acceso se sincronizarán cada 30 segundos.'
              }
            />
          </div>
        )}
      </Card>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 animate-in-premium-delay-2">
        <p className="text-xs font-medium text-muted-foreground">
          Mostrando {showingFrom}-{showingTo} de {totalCount} eventos
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={cursorHistory.length === 0}
            className="btn-secondary h-8 px-3"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!hasMore}
            className="btn-secondary h-8 px-3"
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}