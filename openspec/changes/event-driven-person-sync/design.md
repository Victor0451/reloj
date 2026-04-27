# Design: event-driven-person-sync (Phase 1 + Phase 2)

## Technical Approach

Extract person identity from Hikvision `minor=38` auth events to auto-create/update `persons` records, then layer attendance control with per-person schedules and deviation tracking. Events flow: device → adapter (extract name/employeeNo) → event-sync-loop (upsert person, insert event, calculate deviation) → Supabase. Cron job at 23:59 marks `ABSENT` for persons with no events that day.

## Architecture Decisions

### Decision: Extract identity from `minor=38` events only

**Choice**: Parse `name` and `employeeNoString` only from events where `minor === 38` (successful authentication)
**Alternatives considered**: Parse from all events, use ISAPI UserInfo endpoint
**Rationale**: DS-K1T320MFWX firmware V3.5.0 blocks ISAPI user management; `minor=38` is the reliable trigger for successful card/face auth. Starting narrow avoids noise from failed auth events.

### Decision: Person upsert links events via `employee_id`

**Choice**: On `minor=38` event, upsert person by `employee_id`, then insert event with `person_id` linked
**Alternatives considered**: Separate sync job, trigger-based upsert
**Rationale**: Keep event processing atomic within the sync loop. The `employee_id` field already exists on `access_events`; linking to `persons` via `employee_id` (not `device_employee_no`) matches the existing join pattern in `listEvents`.

### Decision: Deviation calculated inline at event insert time

**Choice**: Calculate `deviation_minutes` and `status` in `event-sync-loop.ts` when inserting each event
**Alternatives considered**: Database trigger, async job after insert
**Rationale**: No round-trip needed; the person's schedule columns are already available in the same Supabase query that links `employee_id` to `person_id`. Database triggers add migration complexity; async jobs introduce latency before status is visible.

### Decision: Schedule columns use PostgreSQL `TIME` type

**Choice**: `schedule_start TIME DEFAULT '09:00:00'`, `schedule_end TIME DEFAULT '18:00:00'`, `tolerance_minutes INTEGER DEFAULT 5`
**Alternatives considered**: Store as `INTERVAL` or as string `HH:MM`
**Rationale**: `TIME` type natively represents wall-clock times, enables `timeofday` comparisons in SQL without casting, and has no timezone ambiguity (unlike `TIMESTAMPTZ`). The device events are already in local time.

## Data Flow

```
Hikvision Device (minor=38)
    │
    ▼
parseJsonEvents() ──► AccessEvent { detectedName, detectedEmployeeNo }
    │
    ▼
event-sync-loop.ts
    │
    ├─► upsertPersonFromEvent(name, employeeNo)
    │         │
    │         ▼
    │    Supabase persons table (upsert by employee_id)
    │
    ├─► calculateDeviation(event, person, eventType) → { deviation, status }
    │
    ▼
access_events INSERT { deviation_minutes, status, person_id }
    │
    ▼
Dashboard / Reports ← access_events + persons JOIN

Daily Cron (23:59)
    │
    ▼
absent-detection.ts: mark persons with no today events → ABSENT status
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/core/interfaces.ts` | Modify | Add `detectedName?`, `detectedEmployeeNo?` to `AccessEvent` |
| `agent/src/adapters/hikvision.adapter.ts` | Modify | `parseJsonEvents()` extracts name/employeeNo from `minor=38` events |
| `agent/src/sync/event-sync-loop.ts` | Modify | Upsert persons, calculate deviation, link events to persons |
| `agent/src/sync/absent-detection.ts` | Create | Cron job to mark `ABSENT` persons at end of day |
| `supabase/schema.sql` | Modify | Add schedule columns to `persons`, deviation/status to `access_events` |
| `src/actions/persons.ts` | Modify | Add `updatePersonSchedule` server action |
| `src/actions/reports.ts` | Modify | Add `getAttendanceReport`, enhance Excel export with deviation/status |
| `src/components/events/events-table.tsx` | Modify | Add status badges with color coding |
| `src/components/ui/status-badge.tsx` | Create | Reusable badge component with ON_TIME/LATE/EARLY_LEAVE/ABSENT colors |
| `src/app/(dashboard)/dashboard/reports/page.tsx` | Modify | Add attendance-specific columns to report preview |

## Interfaces / Contracts

### AccessEvent (agent/src/core/interfaces.ts)

```typescript
export interface AccessEvent {
  // ... existing fields ...
  detectedName?: string;
  detectedEmployeeNo?: string;
}
```

### Person Schedule (supabase/schema.sql)

```sql
ALTER TABLE persons ADD COLUMN schedule_start TIME DEFAULT '09:00:00';
ALTER TABLE persons ADD COLUMN schedule_end TIME DEFAULT '18:00:00';
ALTER TABLE persons ADD COLUMN tolerance_minutes INTEGER DEFAULT 5;
```

### Event Deviation (supabase/schema.sql)

```sql
ALTER TABLE access_events ADD COLUMN deviation_minutes INTEGER;
ALTER TABLE access_events ADD COLUMN status VARCHAR(20);
-- Index for status queries
CREATE INDEX idx_access_events_status ON access_events(status);
CREATE INDEX idx_access_events_deviation ON access_events(deviation_minutes);
```

### upsertPersonFromEvent (agent/src/sync/event-sync-loop.ts)

```typescript
async function upsertPersonFromEvent(
  supabase: SupabaseClient,
  name: string,
  employeeNo: string
): Promise<{ id: string; name: string } | null> {
  // Check if person exists with employee_id = employeeNo
  const { data: existing } = await supabase
    .from('persons')
    .select('id, name')
    .eq('employee_id', employeeNo)
    .single();

  if (existing) {
    // Update name only if different
    if (existing.name !== name) {
      await supabase.from('persons').update({ name }).eq('id', existing.id);
    }
    return existing;
  }

  // Create new person
  const { data: created } = await supabase
    .from('persons')
    .insert({ name, employee_id: employeeNo, status: 'active' })
    .select('id, name')
    .single();

  return created;
}
```

### calculateDeviation (agent/src/sync/event-sync-loop.ts)

```typescript
function calculateDeviation(
  eventTime: Date,
  person: { schedule_start: string; schedule_end: string; tolerance_minutes: number },
  eventType: 'check_in' | 'check_out'
): { deviation: number; status: 'ON_TIME' | 'LATE' | 'EARLY_LEAVE' } {
  if (eventType === 'check_in') {
    const [schedHour, schedMin] = person.schedule_start.split(':').map(Number);
    const expectedMinutes = schedHour * 60 + schedMin + person.tolerance_minutes;
    const eventMinutes = eventTime.getHours() * 60 + eventTime.getMinutes();
    const deviation = eventMinutes - expectedMinutes;
    return { deviation, status: deviation > 0 ? 'LATE' : 'ON_TIME' };
  } else {
    // check_out
    const [schedHour, schedMin] = person.schedule_end.split(':').map(Number);
    const expectedMinutes = schedHour * 60 + schedMin;
    const eventMinutes = eventTime.getHours() * 60 + eventTime.getMinutes();
    const deviation = expectedMinutes - eventMinutes;
    return { deviation, status: deviation < 0 ? 'EARLY_LEAVE' : 'ON_TIME' };
  }
}
```

### updatePersonSchedule (src/actions/persons.ts)

```typescript
export async function updatePersonSchedule(
  personId: string,
  schedule: { start: string; end: string; tolerance: number }
): Promise<ActionResult> {
  const roleCheck = await checkRole(['admin', 'hr_operator']);
  if (!roleCheck.success) return roleCheck;

  const admin = createAdminClient();
  const { error } = await admin
    .from('persons')
    .update({
      schedule_start: schedule.start,
      schedule_end: schedule.end,
      tolerance_minutes: schedule.tolerance,
    })
    .eq('id', personId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `parseJsonEvents` extraction | Mock JSON events with/without `minor=38`, verify `detectedName` populated |
| Unit | `upsertPersonFromEvent` | Mock Supabase — verify insert vs update branch |
| Unit | `calculateDeviation` | Hardcoded schedule, test ON_TIME/LATE/EARLY_LEAVE edge cases |
| Integration | Event sync loop with real Supabase | Insert event → verify person created/updated → verify event has deviation/status |
| Integration | ABSENT cron job | Insert persons with no events for today → run job → verify status |
| E2E | Dashboard shows status badges | Login → trigger events → verify badge colors |

## Migration / Rollback

### Migration (additive — no data loss)

```sql
-- Schedule columns on persons
ALTER TABLE persons ADD COLUMN schedule_start TIME DEFAULT '09:00:00';
ALTER TABLE persons ADD COLUMN schedule_end TIME DEFAULT '18:00:00';
ALTER TABLE persons ADD COLUMN tolerance_minutes INTEGER DEFAULT 5;

-- Deviation/status on access_events
ALTER TABLE access_events ADD COLUMN deviation_minutes INTEGER;
ALTER TABLE access_events ADD COLUMN status VARCHAR(20);

-- Indexes
CREATE INDEX idx_access_events_status ON access_events(status);
CREATE INDEX idx_access_events_deviation ON access_events(deviation_minutes);
CREATE INDEX idx_persons_employee_id ON persons(employee_id);
```

### Rollback Plan

All changes are additive (new columns, new functions). Rollback:

1. Remove `detectedName`/`detectedEmployeeNo` from `AccessEvent` interface
2. Revert `parseJsonEvents()` to previous state (remove name extraction)
3. Comment out `upsertPersonFromEvent` call and deviation calculation in sync loop
4. Delete `absent-detection.ts`
5. Attendance columns remain in schema (harmless) — drop in a future migration if needed

## Open Questions

- [ ] Does the Hikvision device emit `minor=38` for **all** successful auth methods (card, face, fingerprint), or only specific ones? If only card, Phase 1 scope may need adjustment.
- [ ] Should ABSENT be a status on `access_events` (last event of absent day) or a separate `attendance_days` table? Current spec says "update last event status" but a separate table may be cleaner for reporting.
- [ ] What timezone should `schedule_start`/`schedule_end` be interpreted as? The device events arrive in local time; if users span timezones, schedule interpretation may be ambiguous.