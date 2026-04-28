'use server'

import { createAdminClient } from '@/lib/supabase/admin'

// ─── Tipos ────────────────────────────────────────────────────────────────────────

import type { EventWithPerson as EventWithPersonBase } from '@/types/event.types'
import type { Database } from '@/types/database.types'

// Re-export for backwards compatibility (used by events-table.tsx)
export type EventWithPerson = EventWithPersonBase

export interface EventFilters {
  dateStart?: string
  dateEnd?: string
  eventType?: string
  employeeId?: string
}

export interface PaginatedEvents {
  events: EventWithPerson[]
  nextCursor: string | null
  hasMore: boolean
  totalCount: number
  error?: string
}

export interface EventCsvRow {
  event_time: string
  employee_id: string | null
  person_name: string | null
  event_type: string
  verify_mode: string | null
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

// ─── Utilidades ────────────────────────────────────────────────────────────────

/**
 * Escape CSV field — wrap in quotes if contains comma, quote, or newline
 */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * List events with cursor-based pagination and LEFT JOIN to persons.
 *
 * Cursor is the event_time of the last item from the previous page (ISO string).
 * Uses page size of 50, ordered by event_time DESC.
 */
export async function listEvents(
  filters: EventFilters = {},
  cursor?: string
): Promise<PaginatedEvents> {
  const admin = createAdminClient()

  // Step 1: Count total matching rows
  let countQuery = admin
    .from('access_events')
    .select('*', { count: 'exact', head: true })

  if (filters.dateStart) {
    countQuery = countQuery.gte('event_time', filters.dateStart)
  }
  if (filters.dateEnd) {
    countQuery = countQuery.lte('event_time', filters.dateEnd)
  }
  if (filters.eventType) {
    countQuery = countQuery.eq('event_type', filters.eventType)
  }
  if (filters.employeeId) {
    countQuery = countQuery.ilike('employee_id', `%${filters.employeeId}%`)
  }

  const { count, error: countError } = await countQuery

  if (countError) {
    console.error('listEvents count error:', countError)
    return { events: [], nextCursor: null, hasMore: false, totalCount: 0, error: countError.message }
  }

  // Step 2: Main query with cursor pagination
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let query: any = admin
    .from('access_events')
    .select(
      `id, device_serial, person_id, employee_id, event_time,
       major, minor, event_type, verify_mode, raw_payload, synced_at`
    )

  if (filters.dateStart) {
    query = query.gte('event_time', filters.dateStart)
  }
  if (filters.dateEnd) {
    query = query.lte('event_time', filters.dateEnd)
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType)
  }
  if (filters.employeeId) {
    query = query.ilike('employee_id', `%${filters.employeeId}%`)
  }

  // Apply compound cursor (event_time < cursor AND id < idCursor)
  if (cursor) {
    const [cursorTime, cursorId] = cursor.split('::')
    if (cursorTime && cursorId) {
      query = query.or(`event_time.lt.${cursorTime},and(event_time.eq.${cursorTime},id.lt.${cursorId})`)
    } else {
      query = query.lt('event_time', cursor)
    }
  }

  query = query
    .order('event_time', { ascending: false })
    .order('id', { ascending: false })
    .limit(PAGE_SIZE + 1)

  const { data, error } = await query

  if (error) {
    console.error('listEvents query error:', error)
    return { events: [], nextCursor: null, hasMore: false, totalCount: 0, error: error.message }
  }

  const rows = (data ?? []) as EventWithPerson[]
  const hasMore = rows.length > PAGE_SIZE
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  // Step 3: Fetch person names for the employee_ids in this page
  const employeeIds = pageRows
    .map((r) => r.employee_id)
    .filter((id): id is string => id !== null && id !== undefined)

  const personNameMap = new Map<string, string | null>()

  if (employeeIds.length > 0) {
    const personsResult = await admin
      .from('persons')
      .select('employee_id, name')
      .in('employee_id', employeeIds) as { data: Array<{ employee_id: string; name: string }>; error: { message: string } | null }

    if (personsResult.data) {
      for (const p of personsResult.data) {
        personNameMap.set(p.employee_id, p.name)
      }
    }
  }

  // Step 4: Attach person_name to each event
  const eventsWithPerson: EventWithPerson[] = pageRows.map((row) => ({
    ...row,
    person_name: personNameMap.get(row.employee_id ?? '') ?? null,
  }))

  const nextCursor =
    hasMore && pageRows.length > 0
      ? `${pageRows[pageRows.length - 1].event_time}::${pageRows[pageRows.length - 1].id}`
      : null

  return {
    events: eventsWithPerson,
    nextCursor,
    hasMore,
    totalCount: count ?? 0,
  }
}

/**
 * Count events matching filters
 */
export async function countEvents(filters: EventFilters = {}): Promise<number> {
  const admin = createAdminClient()

   
  let query: any = admin
    .from('access_events')
    .select('*', { count: 'exact', head: true })

  if (filters.dateStart) {
    query = query.gte('event_time', filters.dateStart)
  }
  if (filters.dateEnd) {
    query = query.lte('event_time', filters.dateEnd)
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType)
  }
  if (filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId)
  }

  const { count, error } = await query

  if (error) {
    console.error('countEvents error:', error)
    return 0
  }

  return count ?? 0
}

/**
 * Export events to CSV string
 */
export async function exportEventsCsv(
  filters: EventFilters = {}
): Promise<string> {
  const admin = createAdminClient()

   
  let query: any = admin
    .from('access_events')
    .select(
      `event_time, employee_id, event_type, verify_mode`
    )

  if (filters.dateStart) {
    query = query.gte('event_time', filters.dateStart)
  }
  if (filters.dateEnd) {
    query = query.lte('event_time', filters.dateEnd)
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType)
  }
  if (filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId)
  }

  query = query
    .order('event_time', { ascending: false })
    .limit(10000)

  const { data, error } = await query

  if (error) {
    console.error('exportEventsCsv query error:', error)
    return ''
  }

  const rows = (data ?? []) as EventCsvRow[]

  // Collect all employee_ids for batch lookup
  const employeeIds = rows
    .map((r) => r.employee_id)
    .filter((id): id is string => id !== null && id !== undefined)

  const personNameMap = new Map<string, string | null>()

  if (employeeIds.length > 0) {
    const uniqueIds = [...new Set(employeeIds)]
    const personsResult = await admin
      .from('persons')
      .select('employee_id, name')
      .in('employee_id', uniqueIds) as { data: Array<{ employee_id: string; name: string }>; error: { message: string } | null }

    if (personsResult.data) {
      for (const p of personsResult.data) {
        personNameMap.set(p.employee_id, p.name)
      }
    }
  }

  // Build CSV
  const headers = ['event_time', 'employee_id', 'person_name', 'event_type', 'verify_mode']
  const csvLines = [headers.join(',')]

  for (const row of rows) {
    const fields = [
      row.event_time,
      row.employee_id,
      personNameMap.get(row.employee_id ?? '') ?? '',
      row.event_type,
      row.verify_mode,
    ].map(escapeCsvField)
    csvLines.push(fields.join(','))
  }

  return csvLines.join('\n')
}

/**
 * Get distinct event types from access_events
 */
export async function getEventTypes(): Promise<string[]> {
  const admin = createAdminClient()

  const result = await admin
    .from('access_events')
    .select('event_type')
    .limit(1000) as { data: Array<{ event_type: string }>; error: { message: string } | null }

  if (result.error) {
    console.error('getEventTypes error:', result.error)
    return []
  }

  const typeSet = new Set<string>()
  for (const row of result.data ?? []) {
    if (row.event_type) typeSet.add(row.event_type)
  }

  const types = Array.from(typeSet).sort()
  if (typeSet.size >= 1000) {
    console.warn('getEventTypes: reached 1000 row limit, results may be incomplete')
  }
  return types
}
