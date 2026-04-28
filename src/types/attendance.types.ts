/**
 * Attendance calculation system types.
 *
 * Phase 2 of the attendance-calculation-system change.
 */

// Day schedule for a single time range
export type DaySchedule = {
  start: string  // "HH:MM" format, e.g., "09:00"
  end: string    // "HH:MM" format, e.g., "18:00"
}

// Full week schedule configuration
export type ScheduleConfig = {
  mon?: DaySchedule[]
  tue?: DaySchedule[]
  wed?: DaySchedule[]
  thu?: DaySchedule[]
  fri?: DaySchedule[]
  sat?: DaySchedule[]
  sun?: DaySchedule[]
}

// Time template (schedule definition)
export type TimeTemplate = {
  id: string
  name: string
  scheduleConfig: ScheduleConfig
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Assignment linking person to template
export type ScheduleAssignment = {
  id: string
  personId: string
  timeTemplateId: string
  validFrom: string  // Date string YYYY-MM-DD
  validTo: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  timeTemplate?: TimeTemplate  // Joined data
}

// Holiday definition
export type Holiday = {
  id: string
  date: string  // YYYY-MM-DD
  name: string
  createdAt: string
}

// Attendance status enum values
export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'early_exit'
  | 'incomplete'
  | 'holiday'
  | 'unassigned'

// Single day attendance record
export type AttendanceDay = {
  id: string
  personId: string
  date: string
  scheduledHours: number
  actualHours: number
  overtimeHours: number
  tardinessMinutes: number
  status: AttendanceStatus
  notes?: string
}

// Report filters
export type AttendanceFilters = {
  dateFrom: string
  dateTo: string
  personIds?: string[]
  department?: string
  status?: AttendanceStatus
}

// Report totals
export type AttendanceTotals = {
  scheduledHours: number
  actualHours: number
  overtimeHours: number
  tardinessMinutes: number
  presentDays: number
  absentDays: number
  lateDays: number
}

// Full attendance report
export type AttendanceReport = {
  days: AttendanceDay[]
  totals: AttendanceTotals
}

// Manual attendance override
export type AttendanceOverride = {
  id: string
  personId: string
  date: string
  field: string
  oldValue: string | null
  newValue: string
  reason: string | null
  createdBy: string | null
  createdAt: string
}

// Event types from device
export type EventType =
  | 'checkIn'
  | 'checkOut'
  | 'overtimeIn'
  | 'overtimeOut'
  | 'duress_alarm'
  | 'attendance_unknown'

// Person attendance detail (for detail view)
export type PersonAttendanceDetail = {
  person: {
    id: string
    name: string
    employeeId: string | null
    department: string | null
  }
  events: Array<{
    id: string
    eventTime: string
    eventType: EventType
    verifyMode: string | null
  }>
  days: AttendanceDay[]
  schedule: TimeTemplate | null
}

// Create/update input types
export type CreateTimeTemplateInput = {
  name: string
  scheduleConfig: ScheduleConfig
}

export type UpdateTimeTemplateInput = {
  name?: string
  scheduleConfig?: ScheduleConfig
  isActive?: boolean
}

export type AssignScheduleInput = {
  personId: string
  timeTemplateId: string
  validFrom: string
  validTo?: string
}

export type CreateHolidayInput = {
  date: string
  name: string
}
