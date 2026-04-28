'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

// ─── Types ────────────────────────────────────────────────────────────────────────

import type { AttendanceSummaryRow, ReportFilters } from '@/types/report.types'

// ─── Constants ────────────────────────────────────────────────────────────────────

const MAX_EVENTS_FOR_SUMMARY = 50_000
const EVENT_TYPE_ENTRADA = '0' // entrada (check-in)
const EVENT_TYPE_SALIDA = '1'  // salida (check-out)

// ─── Server Actions ────────────────────────────────────────────────────────────────

/**
 * Get attendance summary for the given date range.
 *
 * - Queries access_events filtered by date range
 * - Groups by employee_id AND calendar date (derived from event_time, truncated to date)
 * - first_checkin = MIN(event_time) WHERE event_type = '0' (entrada)
 * - last_checkout = MAX(event_time) WHERE event_type = '1' (salida)
 * - total_hours = diff between last_checkout and first_checkin in hours
 * - is_incomplete = true when the last event for that employee+date is a check-in with no subsequent checkout
 */
export async function getAttendanceSummary(
  filters: ReportFilters
): Promise<{ rows: AttendanceSummaryRow[]; truncated: boolean }> {
  const admin = createAdminClient()

  // Build datetime bounds from date strings
  const dateFromIso = `${filters.dateFrom}T00:00:00.000Z`
  const dateToIso = `${filters.dateTo}T23:59:59.999Z`

  // Supabase query builder is built incrementally; type is complex
  let query: any = admin
    .from('access_events')
    .select('employee_id, event_time, event_type')
    .gte('event_time', dateFromIso)
    .lte('event_time', dateToIso)
    .order('event_time', { ascending: true })
    .limit(MAX_EVENTS_FOR_SUMMARY)

  if (filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('getAttendanceSummary query error:', error)
    return { rows: [], truncated: false }
  }

  const rows = (data ?? []) as Array<{
    employee_id: string | null
    event_time: string
    event_type: string
  }>

  const truncated = rows.length === MAX_EVENTS_FOR_SUMMARY

  // Group by employee_id + calendar date
  // Key: `${employee_id || ''}::${YYYY-MM-DD}`
  const grouped = new Map<string, {
    employee_id: string | null
    date: string
    events: Array<{ event_time: string; event_type: string }>
  }>()

  for (const row of rows) {
    if (!row.employee_id) continue

    // Derive calendar date from event_time (UTC)
    const eventDate = row.event_time.substring(0, 10) // 'YYYY-MM-DD'

    const key = `${row.employee_id}::${eventDate}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        employee_id: row.employee_id,
        date: eventDate,
        events: [],
      })
    }
    grouped.get(key)!.events.push({
      event_time: row.event_time,
      event_type: row.event_type,
    })
  }

  // Build summary rows
  const results: AttendanceSummaryRow[] = []

  for (const [, group] of grouped) {
    const entradaEvents = group.events.filter(e => e.event_type === EVENT_TYPE_ENTRADA)
    const salidaEvents = group.events.filter(e => e.event_type === EVENT_TYPE_SALIDA)

    // first_checkin = earliest entrada
    const firstCheckin = entradaEvents.length > 0
      ? entradaEvents.reduce((min, e) => e.event_time < min.event_time ? e : min).event_time
      : null

    // last_checkout = latest salida
    const lastCheckout = salidaEvents.length > 0
      ? salidaEvents.reduce((max, e) => e.event_time > max.event_time ? e : max).event_time
      : null

    // is_incomplete: no salida events, or last event is entrada (still checked in)
    const isIncomplete = entradaEvents.length > 0 && (
      salidaEvents.length === 0 ||
      entradaEvents[entradaEvents.length - 1].event_time > (salidaEvents[salidaEvents.length - 1]?.event_time ?? '')
    )

    // total_hours
    let totalHours: number | null = null
    if (firstCheckin && lastCheckout && !isIncomplete) {
      const diffMs = new Date(lastCheckout).getTime() - new Date(firstCheckin).getTime()
      totalHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100
    }

    results.push({
      date: group.date,
      employee_id: group.employee_id,
      person_name: null, // resolved below
      first_checkin: firstCheckin,
      last_checkout: lastCheckout,
      total_hours: totalHours,
      is_incomplete: isIncomplete,
    })
  }

  // Resolve person names
  const employeeIds = results.map(r => r.employee_id).filter((id): id is string => id !== null)
  if (employeeIds.length > 0) {
    const uniqueIds = [...new Set(employeeIds)]
    const personsResult = await admin
      .from('persons')
      .select('employee_id, name')
      .in('employee_id', uniqueIds) as { data: Array<{ employee_id: string; name: string }>; error: { message: string } | null }

    const nameMap = new Map<string, string>()
    if (personsResult.data) {
      for (const p of personsResult.data) {
        nameMap.set(p.employee_id, p.name)
      }
    }

    for (const row of results) {
      if (row.employee_id) {
        row.person_name = nameMap.get(row.employee_id) ?? null
      }
    }
  }

  // Sort: date DESC, employee_id ASC
  results.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return (a.employee_id ?? '').localeCompare(b.employee_id ?? '')
  })

  return { rows: results, truncated }
}

/**
 * Export attendance summary as an Excel (.xlsx) file.
 *
 * - Calls getAttendanceSummary internally
 * - Uses xlsx to build worksheet "Resumen de Asistencia"
 * - Returns Blob with MIME application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 */
export async function exportAttendanceExcel(
  filters: ReportFilters
): Promise<{ blob: Blob; truncated: boolean }> {
  const { rows: summary, truncated } = await getAttendanceSummary(filters)

  if (summary.length === 0) {
    throw new Error('No hay datos para el rango seleccionado. Verificá las fechas.')
  }

  // Build worksheet data
  // Headers
  const headers = [
    'Fecha',
    'ID Empleado',
    'Nombre',
    'Primer Check-in',
    'Último Check-out',
    'Horas Totales',
    'Estado',
  ]

  const dataRows = summary.map(row => {
    // Format times: 'HH:mm' from ISO string
    const formatTime = (iso: string | null) => {
      if (!iso) return ''
      const d = new Date(iso)
      const hh = String(d.getUTCHours()).padStart(2, '0')
      const mm = String(d.getUTCMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }

    return [
      row.date,                          // Fecha: YYYY-MM-DD
      row.employee_id ?? '',             // ID Empleado
      row.person_name ?? '',             // Nombre
      formatTime(row.first_checkin),     // Primer Check-in
      formatTime(row.last_checkout),     // Último Check-out
      row.total_hours ?? '',             // Horas Totales
      row.is_incomplete ? 'Incompleto' : 'Completo', // Estado
    ]
  })

  // Create workbook
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])

  // Column widths (chars)
  ws['!cols'] = [
    { wch: 12 }, // Fecha
    { wch: 14 }, // ID Empleado
    { wch: 24 }, // Nombre
    { wch: 16 }, // Primer Check-in
    { wch: 16 }, // Último Check-out
    { wch: 14 }, // Horas Totales
    { wch: 12 }, // Estado
  ]

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  XLSX.utils.book_append_sheet(wb, ws, 'Resumen de Asistencia')

  // Write to array buffer
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const uint8 = new Uint8Array(buf)

  return {
    blob: new Blob([uint8], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    truncated,
  }
}

/**
 * Export attendance summary as a PDF file.
 *
 * Requires @react-pdf/renderer to be installed.
 * Returns an error message if the library is not installed.
 */
export async function exportAttendancePDF(
  _filters: ReportFilters
): Promise<Blob> {
   
  let pdfRendererAvailable = false
  try {
    require('@react-pdf/renderer')
    pdfRendererAvailable = true
  } catch {
    pdfRendererAvailable = false
  }

  if (!pdfRendererAvailable) {
    throw new Error(
      'PDF export requires @react-pdf/renderer. Run: npm install @react-pdf/renderer'
    )
  }

  throw new Error(
    'PDF export is not yet implemented. Will be available in a future update.'
  )
}
