# Archive Report — attendance-calculation-system

**Project**: reloj
**Date**: 2026-04-28
**Phase**: archive

---

## Summary

Full attendance calculation system with 4 new database tables, API actions, and UI pages.

---

## What Was Built

### Database — 4 New Tables (014-017)

| Table | Purpose |
|-------|---------|
| `time_templates` | Schedule definitions with JSONB config |
| `schedule_assignments` | Person to template mapping |
| `holidays` | Exception days |
| `attendance_overrides` | Manual corrections audit |

### API Actions

| Action | Purpose |
|--------|---------|
| `schedules.ts` | CRUD for time templates |
| `schedule-assignments.ts` | Assign employees to schedules |
| `holidays.ts` | Manage holidays |
| `attendance.ts` | Calculation engine |

### UI Pages

| Page | Purpose |
|------|---------|
| `/dashboard/schedules` | Time template management |
| `/dashboard/attendance` | Reports with filters and CSV export |

### Components

| Component | Purpose |
|-----------|---------|
| `ScheduleBuilder` | Visual week grid for building schedules |

---

## Key Algorithms

### `calculatePersonDay(personId, date)`

1. Check if holiday
2. Get active schedule assignment for person
3. Get events from access_events for that day
4. Calculate scheduled_hours from scheduleConfig
5. Pair checkIn/checkOut events (handles split shifts)
6. Calculate actual_hours, overtime_hours, tardiness_minutes
7. Determine status (present, absent, late, etc.)

---

## Files Created

```
supabase/migrations/014_time_templates.sql
supabase/migrations/015_schedule_assignments.sql
supabase/migrations/016_holidays.sql
supabase/migrations/017_attendance_overrides.sql
src/types/attendance.types.ts
src/actions/schedules.ts
src/actions/schedule-assignments.ts
src/actions/holidays.ts
src/actions/attendance.ts
src/components/schedules/schedule-builder.tsx
src/app/(dashboard)/dashboard/schedules/page.tsx
src/app/(dashboard)/dashboard/attendance/page.tsx
src/lib/utils.ts (exportToCsv added)
```

---

## Scope Completed

All 4 phases implemented:
- ✅ Migrations (014-017)
- ✅ Type Definitions
- ✅ API Actions
- ✅ UI Pages

---

## Known Limitations

- Schedules are stored in DB only — device cannot be configured via ISAPI (confirmed: TimeSchedule endpoints return notSupport)
- Calculation is on-demand (no pre-computed storage)
- Overnight shifts not fully handled (edge case)

---

## Next Steps

User will do QA manual testing. Iterations may follow based on findings.

---

*Archived by SDD archive phase — MMAX model*