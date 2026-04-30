# Spec: Dead-Letter Management - Retry

## Overview

Provides a manual retry mechanism for persons in `sync_dead_letter` status. Users can trigger re-synchronization from the UI (persons list or dead-letter page), which resets the person's sync state and allows the agent to attempt syncing again.

## Current Behavior

**Before this change:**
- Persons in `sync_dead_letter` status are stuck — no UI action available
- The only way to recover was direct database manipulation
- No clear path for users to retry a failed sync
- Sync agent ignores `sync_dead_letter` persons (doesn't attempt retry automatically)

## Expected Behavior

**After this change:**
- UI shows all persons with `sync_dead_letter` status
- Each dead-letter person has a visible "Retry" button
- Clicking "Retry" calls `resetPersonSync(personId)`
- `resetPersonSync` sets status to `pending_sync` and resets `sync_attempts` to 0
- Agent picks up the retry within 15 seconds
- Debounce: max 1 retry per 30 seconds per person (prevent flood)

## Scenarios

### Scenario 1: Retry from dead-letter page
```
Given a person with status="sync_dead_letter", sync_attempts=3
And the person has sync_error="Device timeout"
When the user clicks "Retry" on the dead-letter page
Then the person's status becomes "pending_sync"
And sync_attempts resets to 0
And the agent picks up the retry within 15s
And if sync succeeds, status becomes "active"
```

### Scenario 2: Retry button disabled during debounce
```
Given a person with status="sync_dead_letter"
And the user clicked "Retry" 10 seconds ago
When the user views the person again
Then the "Retry" button is disabled
And tooltip shows "Wait X seconds before retrying"
```

### Scenario 3: Retry from persons table inline action
```
Given a person with status="sync_dead_letter" in the persons table
When the user clicks the retry icon in the table row
Then the person is retried (same behavior as dead-letter page)
And the table updates to show "pending_sync" status
```

### Scenario 4: Retry with network failure
```
Given a person with status="sync_dead_letter"
When the user clicks "Retry" but network request fails
Then an error toast is shown: "Retry failed. Try again."
And the person's status remains "sync_dead_letter"
And sync_attempts is NOT reset
```

## Acceptance Criteria

- [ ] Dead-letter page lists all persons with `sync_dead_letter` status
- [ ] Each dead-letter person has a visible "Retry" button
- [ ] Clicking "Retry" sets status to `pending_sync` and resets `sync_attempts` to 0
- [ ] Agent picks up retried persons within 15 seconds
- [ ] Debounce prevents more than 1 retry per 30 seconds per person
- [ ] Disabled retry button shows appropriate tooltip
- [ ] Persons table inline retry action works the same way

## Technical Notes

### Implementation Location
- `src/actions/persons.ts` — `resetPersonSync` action
- `src/components/persons/persons-table.tsx` — inline retry button

### resetPersonSync Action
```typescript
export async function resetPersonSync(personId: string): Promise<ActionResult> {
  const person = await getPersonById(personId)
  if (!person) {
    return { success: false, error: 'Person not found' }
  }

  // Debounce check: prevent retry if attempted within 30s
  const lastRetry = await getLastRetryTimestamp(personId)
  if (lastRetry && Date.now() - lastRetry < 30000) {
    return { success: false, error: 'Wait 30 seconds before retrying' }
  }

  await admin
    .from('persons')
    .update({
      status: 'pending_sync',
      sync_attempts: 0,
      sync_error: null,
    })
    .eq('id', personId)

  await recordRetryTimestamp(personId) // For debounce tracking

  return { success: true }
}
```

### Debounce Implementation Options
1. **DB-based**: Store `last_retry_at` timestamp in persons table
2. **In-memory cache**: Agent maintains Map of recent retries (simpler, resets on agent restart)
3. **Frontend-only**: Prevent button clicks but not actual requests (not sufficient alone)

Recommended: Option 1 (DB-based) for reliability across agent restarts.