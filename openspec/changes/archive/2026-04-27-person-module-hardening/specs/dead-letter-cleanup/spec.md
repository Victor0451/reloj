# Spec: Dead-Letter Management - Cleanup

## Overview

Provides a proper cleanup mechanism for dead-letter persons. When a dead-letter person is discarded/deleted, the system must first remove them from the biometric device if they have a `device_employee_no`. Only after successful device deletion is the person marked as deleted in the DB.

## Current Behavior

**Before this change:**
- `deletePerson` only sets `status = 'inactive'` (soft delete)
- The sync loop's `cleanupInactivePersons` only processes `status = 'inactive'`
- Persons in `sync_dead_letter` with `device_employee_no` are NEVER deleted from the device
- This leaves orphaned entries on the device consuming resources
- If the device has a card assigned to that employeeNo, it remains active

## Expected Behavior

**After this change:**
- When a dead-letter person is discarded/deleted:
  1. If `device_employee_no` is set → agent calls `adapter.deletePerson(employeeNo)` on device
  2. Only AFTER successful device deletion → set `device_employee_no` to null in DB
  3. Then perform soft delete: `status = 'inactive'` OR hard delete per business rules
- The sync loop is extended to include `sync_dead_letter` persons in cleanup
- Cleanup respects the same 15-second sync interval

## Scenarios

### Scenario 1: Discard dead-letter person with device_employee_no
```
Given a person with status="sync_dead_letter", device_employee_no=42
And the person has card "123456" assigned on device
When the user clicks "Discard" or "Delete"
Then the agent calls adapter.deletePerson(42) on the device
And the device deletes employeeNo 42 and their card
On success:
  - device_employee_no is set to null in DB
  - Person status becomes "inactive" (soft delete)
On failure:
  - Error is shown to user
  - Person remains in "sync_dead_letter"
  - sync_error is updated with failure reason
```

### Scenario 2: Discard dead-letter person without device_employee_no
```
Given a person with status="sync_dead_letter", device_employee_no=null
When the user clicks "Discard" or "Delete"
Then no device call is needed
And the person is immediately soft-deleted (status = "inactive")
```

### Scenario 3: Discard person that doesn't exist on device
```
Given a person with status="sync_dead_letter", device_employee_no=99
And employeeNo 99 does NOT exist on the device (orphaned DB state)
When the agent attempts deletePerson(99)
Then device returns "not found" error
But the system treats this as success (already gone)
And proceeds to clear device_employee_no and soft-delete
```

### Scenario 4: Sync loop auto-cleanup of dead-letters
```
Given a person with status="sync_dead_letter", device_employee_no=55
And the person has been in dead-letter for > 7 days
When the sync loop runs cleanup
Then it calls adapter.deletePerson(55) on device
And on success, clears device_employee_no and marks inactive
```

### Scenario 5: Delete during active sync
```
Given a person is currently being synced (status="pending_sync")
When a user attempts to discard/delete that person
Then the delete is rejected with error "Person is currently syncing"
Or the sync is cancelled and delete proceeds
```

## Acceptance Criteria

- [ ] Discarding/deleting a person with `device_employee_no` triggers device deletion first
- [ ] Device deletion failure prevents DB status change (person stays in dead-letter)
- [ ] Successful device deletion clears `device_employee_no` in DB
- [ ] Person is soft-deleted (status = 'inactive') only after device cleanup succeeds
- [ ] Discarding person without `device_employee_no` proceeds immediately to soft-delete
- [ ] Sync loop includes `sync_dead_letter` persons in cleanup process
- [ ] Error messages are clear: "Failed to delete from device. Person not removed."
- [ ] Cleanup handles "not found on device" as success (already deleted)

## Technical Notes

### Implementation Location
- `src/actions/persons.ts` — `discardPerson` / `deletePerson` action
- `agent/src/sync/person-sync-loop.ts` — `cleanupDeadLetterPersons` function
- `agent/src/adapters/hikvision.adapter.ts` — `deletePerson` method

### Discard/Delete Action Flow
```typescript
export async function discardPerson(personId: string): Promise<ActionResult> {
  const person = await getPersonById(personId)
  
  if (person.status === 'pending_sync') {
    return { success: false, error: 'Person is currently syncing. Wait or cancel first.' }
  }

  // If person has device employee No, delete from device first
  if (person.device_employee_no) {
    try {
      await agentSync.deletePersonFromDevice(person.device_employee_no)
    } catch (error) {
      return { 
        success: false, 
        error: `Failed to delete from device: ${error.message}. Person not removed.` 
      }
    }
    
    // Device deleted successfully - clear the reference
    await admin
      .from('persons')
      .update({ device_employee_no: null })
      .eq('id', personId)
  }

  // Now soft delete in DB
  await admin
    .from('persons')
    .update({ status: 'inactive' })
    .eq('id', personId)

  return { success: true }
}
```

### Sync Loop Cleanup Extension
```typescript
// In person-sync-loop.ts
async function cleanupDeadLetterPersons() {
  const deadLetters = await db
    .from('persons')
    .select('*')
    .eq('status', 'sync_dead_letter')
    .eq('device_employee_no', null) // Only those with device reference

  for (const person of deadLetters) {
    try {
      await adapter.deletePerson(person.device_employee_no)
      await db
        .from('persons')
        .update({ 
          device_employee_no: null,
          status: 'inactive' 
        })
        .eq('id', person.id)
    } catch (error) {
      // Log but don't block - will retry next cycle
      console.error(`Failed to cleanup dead-letter person ${person.id}:`, error)
    }
  }
}
```

### Device Deletion Side Effects
When `deletePerson(employeeNo)` is called on Hikvision device:
1. UserInfo (employee) is deleted
2. All CardInfo records for that employeeNo are deleted
3. Access control permissions are removed
4. Fingerprint data is NOT deleted (device-side only, but access revoked)

### Hard Delete Option
If business rules require hard delete instead of soft delete:
```typescript
// Replace soft delete with hard delete
await admin.from('persons').delete().eq('id', personId)
```
This is a separate decision — spec covers soft delete as default.

### Race Condition Prevention
If sync loop is actively syncing a person at the moment of discard:
- Check `status` in DB within transaction
- If changed to `pending_sync` by sync loop, abort discard with error
- User can retry discard after sync completes
