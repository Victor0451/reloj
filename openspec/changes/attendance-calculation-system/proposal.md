# Proposal: Attendance Calculation System

## Intent

The Hikvision device records access events (checkIn/checkOut) but has no schedule configuration via ISAPI and cannot calculate attendance metrics. We need a system that stores schedule definitions, consumes raw events, and computes attendance (hours worked, overtime, tardiness) per person per day.

## Scope

### In Scope
- `time_templates` table — schedule definitions (e.g., "General 9-18", "Noche 14-22")
- `schedule_assignments` table — person → template mapping with effective dates
- `attendance_days` table — calculated daily metrics (stored, not computed on-demand)
- `holidays` table — exception days excluded from calculations
- Calculation engine: hours worked, overtime, tardiness; handle split shifts and missing events
- API actions: CRUD for templates, assignments, holidays; calculateAttendance() and getAttendanceReport()
- UI: schedule management, assignment, attendance reports (daily/weekly/monthly)

### Out of Scope
- Real-time monitoring or automated alerts
- Manual event creation (events only from device)
- Schedule sync to device (device doesn't support it)
- Override system UI (table only for Phase 1)

## Capabilities

### New Capabilities
- `time-templates`: define weekly schedule templates with per-day start/end/break times
- `schedule-assignments`: assign employees to time templates with valid_from/valid_to
- `attendance-calculation`: compute daily metrics by matching events to schedule slots
- `holiday-management`: CRUD for holidays excluded from calculations

### Modified Capabilities
- None (new domain).

## Approach

**Step 1**: Migrations for 4 new tables (time_templates, schedule_assignments, attendance_days, holidays).

**Step 2**: API actions in `src/actions/` — CRUD for templates/assignments/holidays, plus `calculateAttendance(personId, from, to)` that iterates days, matches events to schedule slots, and upserts results into `attendance_days`.

**Step 3**: Calculation engine — greedy slot matching for split shifts, overnight detection, tardiness/overtime computation. Store results; recalculate on demand or when events arrive.

**Step 4**: UI pages under `(dashboard)/schedules/` and `(dashboard)/reports/` — template builder, assignment dialog, attendance table with filters.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | 4 migration files for new tables |
| `src/actions/` | New | `time-templates.ts`, `schedule-assignments.ts`, `holidays.ts`, `attendance.ts` |
| `src/lib/attendance/` | New | Calculation engine (calculation.ts, slot-matching.ts) |
| `src/app/(dashboard)/dashboard/schedules/` | New | Schedule management UI |
| `src/app/(dashboard)/dashboard/reports/attendance/` | New | Attendance reports UI |
| `src/types/` | Modified | Add TimeTemplate, ScheduleAssignment, AttendanceDay, Holiday types |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Timezone handling — event_time is UTC, display must use local TZ | Med | All calculations in UTC; convert at display layer only |
| Split shifts — wrong event pairing | Med | Greedy matching by sequence; document limitation for Phase 1 |
| Performance — 1000 employees × 30 days = 30k calculations | Med | Batch processing; nightly recalc; index on person_id+date |

## Rollback Plan

Drop new tables via migration rollback; remove new action files and types; delete new UI routes. No data migration needed since tables are new.

## Dependencies
- Supabase with existing `persons` and `access_events` tables
- Event sync pipeline already functional (no changes needed to sync)

## Success Criteria
- [ ] Admin can create/edit/delete time templates from UI
- [ ] Admin can assign employees to time templates
- [ ] Attendance report shows: date, person, scheduled_hours, actual_hours, overtime, tardiness
- [ ] Holidays are excluded from absence detection
- [ ] `calculateAttendance` is triggered when new events arrive via existing sync pipeline
