# Proposal: event-driven-person-sync

## Intent

DS-K1T320MFWX (firmware V3.5.0) blocks ISAPI user management — persons cannot be pushed to device. Option C extracts person data from `minor=38` auth events. **Phase 2 adds full attendance control**: per-person schedules, deviation tracking, and attendance status flags.

## Scope

### In Scope
- **Phase 1** (unchanged): Parse `name`/`employeeNo` from `minor=38` events → auto-create/update persons
- **Phase 2**: Schedule columns per person (`schedule_start`, `schedule_end`, `tolerance_minutes`)
- **Phase 2**: Deviation calculation on check-in (first event) and check-out (last event) against schedule
- **Phase 2**: Status flags: `ON_TIME`, `LATE`, `EARLY_LEAVE`, `ABSENT`
- **Phase 2**: Attendance dashboard with visual alerts (green=ON_TIME, red=LATE)
- **Phase 2**: Reports: person weekly/monthly deviations, daily late persons, Excel export

### Out of Scope
- Manual person management UI
- Device-side person creation
- Card/fingerprint enrollment
- Overtime calculations

## Capabilities

### New Capabilities
- `event-person-extraction`: Parse identity from `minor=38` auth events
- `person-auto-create`: Upsert persons from event stream
- `event-person-link`: Associate events with persons via `employee_id`
- `attendance-schedules`: Per-person `schedule_start`, `schedule_end`, `tolerance_minutes` columns
- `deviation-calculation`: Compute `deviation_minutes` and `status` on event insert
- `attendance-reports`: Dashboard filters, person summaries, Excel export

### Modified Capabilities
- None (all new)

## Approach

### Phase 1 — Event-Driven Person Sync
1. **Hikvision Adapter**: Extract `name`/`employeeNoString` from `minor=38` events
2. **Event Sync Loop**: Upsert persons on `minor=38` detection
3. **Dashboard**: Join events with persons → show name or "No identificado"

### Phase 2 — Attendance Control
1. **Schema Migration**:
   - `ALTER TABLE persons ADD COLUMN schedule_start TIME`
   - `ALTER TABLE persons ADD COLUMN schedule_end TIME`
   - `ALTER TABLE persons ADD COLUMN tolerance_minutes INTEGER DEFAULT 5`
   - `ALTER TABLE access_events ADD COLUMN deviation_minutes INTEGER`
   - `ALTER TABLE access_events ADD COLUMN status VARCHAR`

2. **Deviation Calculation** (on event insert):
   - Check-in: first event of day for person → compare `event_time` vs `schedule_start + tolerance`
   - Check-out: last event of day for person → compare `event_time` vs `schedule_end`
   - Update `deviation_minutes` and `status` on the event record

3. **Status Logic**:
   ```
   Check-in time ≤ schedule_start + tolerance → ON_TIME
   Check-in time > schedule_start + tolerance → LATE (deviation = late - schedule_start)
   Check-out time < schedule_end → EARLY_LEAVE
   No events for person on a given day → ABSENT (end-of-day job)
   ```

4. **Dashboard**: Attendance view with filters (person, date, status), color-coded rows
5. **Reports**: Weekly/monthly deviation summary per person, daily late list, Excel export

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/adapters/hikvision.adapter.ts` | Modified | Extract `name`/`employeeNo` from `minor=38` |
| `agent/src/sync/event-sync-loop.ts` | Modified | Upsert persons; deviated events (Phase 2) |
| `agent/src/core/interfaces.ts` | Modified | Add `name`, `deviation_minutes`, `status` fields |
| `supabase/schema.sql` | Modified | Add schedule columns, deviation/status columns, indexes |
| `web/src/app/dashboard/` | Modified | Person name fallback; attendance view with filters |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale name on person upsert | Medium | Only update; create only on new `employeeNo` |
| `minor=38` not fired for all auth methods | Low | Start with this minor only; extend later |
| End-of-day job needed for ABSENT flag | High | Schedule cron job to mark absent persons at day end |
| Tolerance default too strict | Low | Per-person configurable; default 5 min |

## Rollback Plan

1. Disable person upsert in `event-sync-loop.ts` via feature flag
2. Revert Hikvision adapter to previous state
3. Attendance schema columns retained (harmless) — drop in later migration if needed
4. Dashboard falls back to showing "No identificado" for unknown persons

## Dependencies

- Supabase `persons` table with `employee_no` (unique index)
- `access_events.employee_id` column present
- Cron scheduler for end-of-day ABSENT marking job

## Success Criteria

- [ ] `minor=38` events with new `employeeNo` create person in `persons` table
- [ ] Subsequent events update person's `name`
- [ ] Persons have `schedule_start`, `schedule_end`, `tolerance_minutes` columns after Phase 2
- [ ] First daily event for person has `deviation_minutes` and `status` calculated
- [ ] `ON_TIME` when check-in ≤ schedule_start + tolerance
- [ ] `LATE` when check-in > schedule_start + tolerance (deviation = late - schedule)
- [ ] `EARLY_LEAVE` when check-out < schedule_end
- [ ] `ABSENT` set for persons with no events by end of day
- [ ] Dashboard shows attendance with color-coded status
- [ ] Reports show per-person deviation summary and daily late list
