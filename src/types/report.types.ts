/**
 * Report-related types for the reloj system.
 */

import type { Database } from './database.types'

export type EventRecord = Database['public']['Tables']['access_events']['Row']
export type PersonRecord = Database['public']['Tables']['persons']['Row']

/**
 * A single row in the attendance summary report.
 * Represents one employee on one calendar date.
 */
export interface AttendanceSummaryRow {
  /** Calendar date (YYYY-MM-DD, derived from event_time truncated to date) */
  date: string
  /** Employee identifier from access_events */
  employee_id: string | null
  /** Full name from persons table, resolved via LEFT JOIN */
  person_name: string | null
  /** Earliest 'in' event timestamp on this date for this employee */
  first_checkin: string | null
  /** Latest 'out' event timestamp on this date for this employee */
  last_checkout: string | null
  /** Difference in hours between last_checkout and first_checkin */
  total_hours: number | null
  /** Whether the employee is missing a checkout for this date */
  is_incomplete: boolean
}

/**
 * Filters for attendance reports.
 */
export interface ReportFilters {
  /** Start of date range (YYYY-MM-DD) */
  dateFrom: string
  /** End of date range (YYYY-MM-DD) */
  dateTo: string
  /** Optional: filter by specific employee ID */
  employeeId?: string
  /** Optional: filter by department name */
  department?: string
}

/**
 * Result of getAttendanceSummary including data and truncation status.
 */
export interface AttendanceSummaryResult {
  rows: AttendanceSummaryRow[]
  /** True when the 50k row limit was hit — data may be incomplete */
  truncated: boolean
}

/**
 * Supported export formats for reports.
 */
export type ExportFormat = 'excel' | 'pdf'
