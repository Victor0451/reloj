# Apply Progress: event-driven-person-sync

**Date**: 2026-04-26
**Phase**: Phase 1 (Identity Extraction)
**Status**: ✅ COMPLETE

## Phase 1 Tasks Completed

| Task | Status | Verification |
|------|--------|--------------|
| 1.1 AccessEvent interface | ✅ DONE | TypeScript compiles |
| 1.2 Hikvision adapter parseJsonEvents | ✅ DONE | `minor=38` extracts `detectedName`/`detectedEmployeeNo` |
| 1.3 upsertPersonFromEvent function | ✅ DONE | Added to `event-sync-loop.ts` |
| 1.4 Event sync loop person linking | ✅ DONE | `person_id` set on event insert |
| 1.5 Database migration | ✅ DONE | Migration `007_add_person_id_to_access_events.sql` created |

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `agent/src/core/interfaces.ts` | Modified | Added `detectedName?` and `detectedEmployeeNo?` to AccessEvent |
| `agent/src/adapters/hikvision.adapter.ts` | Modified | `parseJsonEvents()` extracts name/employeeNo from `minor=38` events |
| `agent/src/sync/event-sync-loop.ts` | Modified | Added `upsertPersonFromEvent()`, modified event loop to link persons |
| `supabase/migrations/007_add_person_id_to_access_events.sql` | Created | Adds `person_id` UUID FK column to `access_events` |

## Implementation Details

### Task 1.1: AccessEvent Interface
Added two optional fields:
```typescript
detectedName?: string;
detectedEmployeeNo?: string;
```

### Task 1.2: Hikvision Adapter
In `parseJsonEvents()`, when `minor === 38`:
```typescript
accessEvent.detectedName = event.name;
accessEvent.detectedEmployeeNo = event.employeeNoString;
```

### Task 1.3: upsertPersonFromEvent
```typescript
export async function upsertPersonFromEvent(
  supabase: SupabaseClient,
  name: string,
  employeeNo: string
): Promise<Person | null>
```
- Checks for existing person by `employee_id`
- Updates name if different
- Creates new person if not found

### Task 1.4: Event Sync Loop
Both `startEventSyncLoop` and `startSingleDeviceEventSync` now:
1. Call `upsertPersonFromEvent` when `detectedName` and `detectedEmployeeNo` present
2. Set `person_id` on `access_events` insert
3. Log person_id for verification

### Task 1.5: Migration
File: `supabase/migrations/007_add_person_id_to_access_events.sql`
- Adds `person_id UUID` column
- Creates `idx_access_events_person_id` index
- Adds FK constraint to `persons(id)`
- Adds `idx_access_events_employee_id` index

## Next Steps

### Phase 2 Tasks (pending):
- 2.1 Database migration Phase 2 schema
- 2.2 calculateDeviation function
- 2.3 Update event sync loop with deviation
- 2.4 ABSENT detection cron job
- 2.5 updatePersonSchedule server action
- 2.6 getAttendanceReport server action
- 2.7 Dashboard status badges
- 2.8 Dashboard deviation display
- 2.9 Reports page attendance report
- 2.10 Excel export attendance data

## Testing

### Real Device Test Command
```bash
cd agent && node --import tsx -e "
import { HikvisionAdapter } from './src/adapters/hikvision.adapter';
async function test() {
  const adapter = new HikvisionAdapter({
    ip: '192.168.100.60',
    port: 443,
    username: 'admin',
    password: 'evol@2601',
    serialNumber: 'test',
    rejectUnauthorized: false,
  });
  
  const events = await adapter.getEvents({ maxResults: 10 });
  console.log('Events with detectedName:');
  events.filter(e => e.detectedName).forEach(e => {
    console.log(JSON.stringify({ name: e.detectedName, empNo: e.detectedEmployeeNo, eventType: e.eventType }));
  });
  
  await adapter.disconnect();
}
test().catch(e => console.error(e.message));
"
```

## Deviations from Design
None — implementation matches design exactly.

## Issues Found
None.

## Engram Topic
`sdd/event-driven-person-sync/apply-progress`