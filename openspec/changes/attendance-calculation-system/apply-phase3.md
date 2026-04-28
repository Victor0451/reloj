# Apply Phase 3 — API Actions

**Change**: attendance-calculation-system
**Phase**: 3 of 4 (API Actions)
**Status**: ✅ Complete

## Files Created

| File | Description |
|------|-------------|
| `src/actions/schedules.ts` | Time template CRUD (create, get, update, delete) |
| `src/actions/schedule-assignments.ts` | Schedule assignment CRUD (assign, get, getPersonScheduleForDate, remove) |
| `src/actions/holidays.ts` | Holiday CRUD (create, getHolidays, delete, isHoliday) |
| `src/actions/attendance.ts` | Calculation engine (calculatePersonDay, calculateAttendanceRange, getAttendanceReport) |

## Notes

- Tables `time_templates`, `schedule_assignments`, `holidays` are not in `database.types.ts` — used `any` typing pattern consistent with existing actions in the project
- Admin client used throughout (bypasses RLS for server-side operations)
- Calculation engine implements: holiday detection, schedule lookup, event pairing (check-in/check-out), tardiness calculation, overtime calculation

## Validation

TypeScript compilation: ✅ Passed (`npx tsc --noEmit`)
