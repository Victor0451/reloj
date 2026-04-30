# Spec: Edit Sync Flow

## Overview

When a person is edited, the system must detect which fields affect the device and set `status = pending_sync` to trigger re-synchronization. The sync agent picks up pending persons within 15 seconds and updates the device. This spec covers the edit-to-sync pipeline.

## Current Behavior

**Before this change:**
- `updatePerson` only sets `status = pending_sync` when `name` OR `employee_id` changes
- `card_number` changes do NOT trigger re-sync — the device never receives the new card
- `department` changes DO trigger `pending_sync` but department is never sent to device (wasteful)

```typescript
// Current (broken) logic in src/actions/persons.ts
const nameChanged = input.name && input.name !== existingPerson.name
const employeeChanged = input.employee_id !== undefined && input.employee_id !== existingPerson.employee_id
const needsSync = nameChanged || employeeChanged
if (needsSync) updateData.status = 'pending_sync'
```

## Expected Behavior

**After this change:**
- `needsSync` is true when ANY of these fields change: `name`, `employee_id`, `card_number`
- `department` is NOT included in `needsSync` (not sent to device)
- Sync agent calls `updatePersonOnDevice` (PUT) for each `pending_sync` person
- If `card_number` changed AND adapter has `assignCardToDevice` method → call it after user update
- On success → status = `active`
- On failure → `sync_attempts++`, status = `sync_failed` or `sync_dead_letter` (after 3 attempts)

## Scenarios

### Scenario 1: Edit name triggers sync
```
Given a person with name="Juan Perez", status="active"
When the user edits name to "Juan Carlos Perez"
Then the person's status becomes "pending_sync"
And the sync agent updates the name on the device within 15s
And status becomes "active" after successful sync
```

### Scenario 2: Edit card_number triggers sync
```
Given a person with card_number="123456", status="active"
When the user edits card_number to "654321"
Then the person's status becomes "pending_sync"
And the sync agent calls updatePersonOnDevice
And the sync agent calls assignCardToDevice with new card_number
And status becomes "active" after successful sync
```

### Scenario 3: Edit department does NOT trigger sync
```
Given a person with department="Sales", status="active"
When the user edits department to "Marketing"
Then the person's status remains "active"
And no sync is triggered (department is not sent to device)
```

### Scenario 4: Multiple field edit triggers single sync
```
Given a person with name="Juan", card_number="123", status="active"
When the user edits name to "Pedro" AND card_number to "456"
Then status becomes "pending_sync" (once, not multiple)
And sync agent performs one combined update on device
```

### Scenario 5: Sync failure increments attempts
```
Given a person with status="pending_sync", sync_attempts=1
When the sync agent attempts to update but device returns error
Then sync_attempts becomes 2
And status becomes "sync_failed"
And if attempts >= 3, status becomes "sync_dead_letter"
```

### Scenario 6: Subsequent successful sync after failure
```
Given a person with status="sync_failed", sync_attempts=2
When the user retries and sync succeeds
Then sync_attempts resets to 0
And status becomes "active"
```

## Acceptance Criteria

- [ ] Editing `name` sets `status = pending_sync`
- [ ] Editing `employee_id` sets `status = pending_sync`
- [ ] Editing `card_number` sets `status = pending_sync`
- [ ] Editing `department` does NOT set `status = pending_sync`
- [ ] Sync agent processes `pending_sync` persons within 15 seconds
- [ ] Card change triggers `assignCardToDevice` call in adapter
- [ ] Failed sync increments `sync_attempts`
- [ ] After 3 failed attempts, person moves to `sync_dead_letter` status
- [ ] Successful sync resets `sync_attempts` to 0 and sets status to `active`

## Technical Notes

### Implementation Location
- `src/actions/persons.ts` — `updatePerson` function
- `agent/src/sync/person-sync-loop.ts` — sync agent loop

### Updated needsSync Logic
```typescript
const nameChanged = input.name !== undefined && input.name !== existingPerson.name
const employeeChanged = input.employee_id !== undefined && input.employee_id !== existingPerson.employee_id
const cardChanged = input.card_number !== undefined && input.card_number !== existingPerson.card_number
const needsSync = nameChanged || employeeChanged || cardChanged
```

### Sync Agent Flow
```
1. Pick up person with status = "pending_sync"
2. Call adapter.updatePersonOnDevice(person)
   - If card_number changed → call adapter.assignCardToDevice(newCard, employeeNo)
3. On success: set status = "active", sync_attempts = 0
4. On failure: sync_attempts++, if attempts >= 3 → status = "sync_dead_letter", else status = "sync_failed"
```