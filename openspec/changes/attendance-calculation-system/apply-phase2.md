# SDD Apply Phase 2 — Type Definitions

## Status

**Completed**: 2026-04-28

## Task

Create `src/types/attendance.types.ts` with ALL types for the attendance calculation system.

## Types Created

| Type | Description |
|------|-------------|
| `DaySchedule` | Single time range (start/end in "HH:MM" format) |
| `ScheduleConfig` | Full week schedule with mon-sun optional day arrays |
| `TimeTemplate` | Schedule template with id, name, config, isActive, timestamps |
| `ScheduleAssignment` | Person-to-template assignment with validFrom/validTo |
| `Holiday` | Holiday definition with date and name |
| `AttendanceStatus` | Union type of 7 status values |
| `AttendanceDay` | Single day attendance record |
| `AttendanceFilters` | Report filter parameters |
| `AttendanceTotals` | Aggregated report totals |
| `AttendanceReport` | Full report with days array and totals |
| `AttendanceOverride` | Manual override audit trail |
| `EventType` | Union type of 6 event types from device |
| `PersonAttendanceDetail` | Person attendance detail view |
| `CreateTimeTemplateInput` | Input for creating templates |
| `UpdateTimeTemplateInput` | Input for updating templates |
| `AssignScheduleInput` | Input for assigning schedule to person |
| `CreateHolidayInput` | Input for creating holidays |

## Validation

- TypeScript compilation: ✅ `npx tsc --noEmit` passed with no errors

## Artifacts

- Filesystem: `src/types/attendance.types.ts`
- Engram: `sdd/attendance-calculation-system/apply-phase2`
