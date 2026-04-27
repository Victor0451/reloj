# Tasks: event-driven-person-sync (Phase 1 + Phase 2)

## Phase 1: Event-Driven Person Sync — Identity Extraction

- [x] 1.1 Update `AccessEvent` interface — add `detectedName?: string` and `detectedEmployeeNo?: string` in `agent/src/core/interfaces.ts`
- [x] 1.2 Update Hikvision adapter — in `parseJsonEvents()`, extract `name` and `employeeNoString` when `minor === 38`, set on returned AccessEvent objects (`agent/src/adapters/hikvision.adapter.ts`)
- [x] 1.3 Add `upsertPersonFromEvent(name, employeeNo)` — check exists by `employee_id`, create or update, return person (`agent/src/sync/person-upsert.ts` or `event-sync-loop.ts`)
- [x] 1.4 Modify event sync loop — call `upsertPersonFromEvent` when `detectedName/detectedEmployeeNo` present; lookup person by `employeeNo` and set `person_id` on event save; set `person_id = null` if not found (`agent/src/sync/event-sync-loop.ts`)
- [x] 1.5 Database migration Phase 1 — add `person_id` foreign key to `access_events` linking to `persons` via `employee_id` (`supabase/migrations/`)

## Phase 2: Attendance Control — Deviation & Status Tracking

- [ ] 2.1 Database migration Phase 2 schema — add `schedule_start`, `schedule_end`, `tolerance_minutes` to `persons`; add `deviation_minutes`, `attendance_status` to `access_events`; add indexes (`supabase/migrations/`)
- [ ] 2.2 Implement `calculateDeviation(eventTime, person, eventType)` — returns `{ deviation_minutes, status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' }` (`agent/src/sync/attendance-deviation.ts`)
- [ ] 2.3 Update event sync loop with deviation — after upserting person, calculate deviation and event type (check_in = first of day, check_out = last of day); save deviation/status with event (`agent/src/sync/event-sync-loop.ts`)
- [ ] 2.4 Create ABSENT detection cron job — runs daily 23:59, query persons with no events today, update last event's status to `ABSENT` (`agent/src/sync/absent-detection.ts`)
- [ ] 2.5 Server action `updatePersonSchedule` — update `schedule_start`, `schedule_end`, `tolerance_minutes` for a person (`src/actions/persons.ts`)
- [ ] 2.6 Server action `getAttendanceReport` — query `access_events` joined with `persons`, filter by person/date range, return summary (`src/actions/reports.ts`)
- [ ] 2.7 Dashboard status badges — add badge column with color coding: ON_TIME=green, LATE=red, EARLY_LEAVE=orange, ABSENT=gray (`src/components/events/events-table.tsx`)
- [ ] 2.8 Dashboard deviation display — show `deviation_minutes` column formatted as `+1h 12min` or `-30min` (`src/components/events/events-table.tsx`)
- [ ] 2.9 Reports page attendance report — new report type with filters (person optional, date range), show totals per person: late count, early count, absent count (`src/app/(dashboard)/dashboard/reports/page.tsx`)
- [ ] 2.10 Excel export attendance data — extend existing xlsx export with person_name, date, check_in_time, check_out_time, deviation_minutes, status columns

## Verification Summary

| Task | File | Success Criteria |
|------|------|-------------------|
| 1.1 | `agent/src/core/interfaces.ts` | TypeScript compiles |
| 1.2 | `agent/src/adapters/hikvision.adapter.ts` | `minor=38` event produces `detectedName` and `detectedEmployeeNo` |
| 1.3 | `agent/src/sync/person-upsert.ts` | Duplicate `employeeNo` updates, new `employeeNo` creates |
| 1.4 | `agent/src/sync/event-sync-loop.ts` | Event saved with correct `person_id` FK |
| 1.5 | `supabase/migrations/` | Migration runs, FK constraint established |
| 2.1 | `supabase/migrations/` | Tables have new columns with defaults |
| 2.2 | `agent/src/sync/attendance-deviation.ts` | Unit test: 09:15 check-in with 09:00+5min = LATE 10min |
| 2.3 | `agent/src/sync/event-sync-loop.ts` | Event saved with correct deviation/status |
| 2.4 | `agent/src/sync/absent-detection.ts` | Persons without events get ABSENT status |
| 2.5 | `src/actions/persons.ts` | DB columns updated after action call |
| 2.6 | `src/actions/reports.ts` | Correct attendance data returned |
| 2.7 | `src/components/events/events-table.tsx` | Badge colors match status |
| 2.8 | `src/components/events/events-table.tsx` | Deviation formatted correctly |
| 2.9 | `src/app/(dashboard)/dashboard/reports/page.tsx` | Report displays with correct totals |
| 2.10 | `src/actions/reports.ts` | Excel contains all attendance columns |

## Dependencies

- Phase 1 tasks must complete before Phase 2 tasks that depend on `person_id` and schedule columns
- Task 2.1 (migration) must run before 2.2, 2.3
- Tasks 2.7, 2.8 depend on 2.3 completing (deviation/status available on events)

## Open Questions (from design)

- Does `minor=38` fire for all auth methods (card, face, fingerprint)?
- ABSENT on last event row or separate `attendance_days` table?
- What timezone for schedule columns?
