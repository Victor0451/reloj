'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  AttendanceDay,
  AttendanceReport,
  AttendanceFilters,
  AttendanceTotals,
  ScheduleConfig,
  DaySchedule,
} from '@/types/attendance.types'

// Get day key from date string
function getDayKey(dateStr: string): string {
  const date = new Date(dateStr)
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return days[date.getDay()]
}

// Parse HH:MM string to minutes since midnight
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// Calculate duration in hours between two Date objects
function calcHours(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime()
  return Math.max(0, diffMs / (1000 * 60 * 60))
}

// Calculate minutes late
function calcTardiness(eventTime: Date, scheduledStart: string): number {
  const scheduledMinutes = parseTimeToMinutes(scheduledStart)
  const eventMinutes = eventTime.getHours() * 60 + eventTime.getMinutes()
  return Math.max(0, eventMinutes - scheduledMinutes)
}

// Get start of day in local timezone
function startOfDay(dateStr: string): Date {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  return d
}

// Get end of day in local timezone
function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr)
  d.setHours(23, 59, 59, 999)
  return d
}

export async function calculatePersonDay(
  personId: string,
  dateStr: string
): Promise<AttendanceDay> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // Check if holiday
  const { data: holiday } = await admin
    .from('holidays')
    .select('*')
    .eq('date', dateStr)
    .single()

  if (holiday) {
    return {
      id: `temp-${personId}-${dateStr}`,
      personId,
      date: dateStr,
      scheduledHours: 0,
      actualHours: 0,
      overtimeHours: 0,
      tardinessMinutes: 0,
      status: 'holiday',
    }
  }

  // Get active schedule assignment for person on this date
  const { data: assignment } = await admin
    .from('schedule_assignments')
    .select('*, time_template:time_templates(*)')
    .eq('person_id', personId)
    .eq('is_active', true)
    .lte('valid_from', dateStr)
    .or(`valid_to.is.null,valid_to.gte.${dateStr}`)
    .single()

  if (!assignment || !assignment.time_template) {
    return {
      id: `temp-${personId}-${dateStr}`,
      personId,
      date: dateStr,
      scheduledHours: 0,
      actualHours: 0,
      overtimeHours: 0,
      tardinessMinutes: 0,
      status: 'unassigned',
    }
  }

  const template = assignment.time_template as Record<string, unknown>
  const scheduleConfig = template.schedule_config as ScheduleConfig
  const dayKey = getDayKey(dateStr) as keyof ScheduleConfig
  const daySchedule = scheduleConfig[dayKey] || ([] as DaySchedule[])

  // Calculate scheduled hours
  let scheduledHours = 0
  for (const range of daySchedule) {
    const startMin = parseTimeToMinutes(range.start)
    const endMin = parseTimeToMinutes(range.end)
    scheduledHours += (endMin - startMin) / 60
  }

  // Get events for person on this date
  const dayStart = startOfDay(dateStr)
  const dayEnd = endOfDay(dateStr)

  const { data: events } = await admin
    .from('access_events')
    .select('*')
    .eq('person_id', personId)
    .gte('event_time', dayStart.toISOString())
    .lte('event_time', dayEnd.toISOString())
    .order('event_time', { ascending: true })

  if (!events || events.length === 0) {
    return {
      id: `temp-${personId}-${dateStr}`,
      personId,
      date: dateStr,
      scheduledHours,
      actualHours: 0,
      overtimeHours: 0,
      tardinessMinutes: 0,
      status: 'absent',
    }
  }

  // Pair checkIn/checkOut events
  const checkIns = events.filter(
    (e: Record<string, unknown>) =>
      e.event_type === 'checkIn' ||
      e.event_type === 'in' ||
      e.event_type === 'overtimeIn'
  )
  const checkOuts = events.filter(
    (e: Record<string, unknown>) =>
      e.event_type === 'checkOut' ||
      e.event_type === 'out' ||
      e.event_type === 'overtimeOut'
  )

  // Simple pairing: first checkIn with first checkOut, second with second, etc.
  let actualHours = 0
  let firstCheckIn: Date | null = null
  const pairedCheckOuts = new Set<string>()

  for (const ci of checkIns) {
    const ciTime = new Date(ci.event_time as string)
    if (!firstCheckIn) firstCheckIn = ciTime

    // Find matching checkOut (after checkIn, not already paired)
    const matchingOut = checkOuts.find((co: Record<string, unknown>) => {
      if (pairedCheckOuts.has(co.id as string)) return false
      return new Date(co.event_time as string) > ciTime
    })

    if (matchingOut) {
      pairedCheckOuts.add(matchingOut.id as string)
      actualHours += calcHours(ciTime, new Date(matchingOut.event_time as string))
    }
  }

  // Calculate overtime and tardiness
  const overtimeHours = Math.max(0, actualHours - scheduledHours)

  let tardinessMinutes = 0
  if (firstCheckIn && daySchedule.length > 0) {
    tardinessMinutes = calcTardiness(firstCheckIn, daySchedule[0].start)
  }

  // Determine status
  let status: AttendanceDay['status'] = 'present'
  if (actualHours === 0) status = 'incomplete'
  else if (tardinessMinutes > 5) status = 'late'
  else if (actualHours < scheduledHours * 0.5 && events.length > 0)
    status = 'incomplete'

  return {
    id: `temp-${personId}-${dateStr}`,
    personId,
    date: dateStr,
    scheduledHours: Math.round(scheduledHours * 100) / 100,
    actualHours: Math.round(actualHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    tardinessMinutes,
    status,
  }
}

export async function calculateAttendanceRange(
  personId: string,
  fromStr: string,
  toStr: string
): Promise<AttendanceDay[]> {
  const results: AttendanceDay[] = []
  const from = new Date(fromStr)
  const to = new Date(toStr)

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const day = await calculatePersonDay(personId, dateStr)
    results.push(day)
  }

  return results
}

export async function getAttendanceReport(
  filters: AttendanceFilters
): Promise<AttendanceReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient()

  // Build date range
  const startDate = filters.dateFrom
  const endDate = filters.dateTo

  // Get all persons (optionally filtered by department)
  let personsQuery = admin
    .from('persons')
    .select('id, name, employee_id, department')
    .eq('status', 'active')

  if (filters.personIds && filters.personIds.length > 0) {
    personsQuery = personsQuery.in('id', filters.personIds)
  }

  const { data: persons } = await personsQuery
  if (!persons || persons.length === 0) {
    return { days: [], totals: createEmptyTotals() }
  }

  // Calculate attendance for each person in date range
  const allDays: AttendanceDay[] = []

  for (const person of persons) {
    const days = await calculateAttendanceRange(
      person.id as string,
      startDate,
      endDate
    )

    // Filter by status if needed
    const filteredDays = filters.status
      ? days.filter((d) => d.status === filters.status)
      : days

    allDays.push(
      ...filteredDays.map((d) => ({
        ...d,
        personId: person.id as string, // Ensure personId is set correctly
      }))
    )
  }

  // Calculate totals
  const totals = calculateTotals(allDays)

  return { days: allDays, totals }
}

function calculateTotals(days: AttendanceDay[]): AttendanceTotals {
  return {
    scheduledHours:
      Math.round(days.reduce((sum, d) => sum + d.scheduledHours, 0) * 100) /
      100,
    actualHours:
      Math.round(days.reduce((sum, d) => sum + d.actualHours, 0) * 100) / 100,
    overtimeHours:
      Math.round(days.reduce((sum, d) => sum + d.overtimeHours, 0) * 100) / 100,
    tardinessMinutes: days.reduce((sum, d) => sum + d.tardinessMinutes, 0),
    presentDays: days.filter(
      (d) => d.status === 'present' || d.status === 'late'
    ).length,
    absentDays: days.filter((d) => d.status === 'absent').length,
    lateDays: days.filter((d) => d.status === 'late').length,
  }
}

function createEmptyTotals(): AttendanceTotals {
  return {
    scheduledHours: 0,
    actualHours: 0,
    overtimeHours: 0,
    tardinessMinutes: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
  }
}
