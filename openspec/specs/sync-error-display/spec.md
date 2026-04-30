# Spec: Sync Error Display

## Overview

Surfaces sync error details to users when a person's synchronization has failed. Shows the error message, attempt count, and last failure timestamp so users understand why the sync failed and can take appropriate action.

## Current Behavior

**Before this change:**
- `sync_error` field exists in DB (from migration 009) but is never displayed in UI
- Users see only the badge (e.g., "Error") with no explanation
- No way to know what went wrong: network timeout? device rejected? invalid card?
- `sync_attempts` count is tracked but not visible

## Expected Behavior

**After this change:**
- When a person has `sync_error`:
  - Expandable row detail shows error message
  - Sync attempt count is visible (e.g., "Attempt 2 of 3")
  - Tooltip on hover/focus shows: "Intento X/3: [error message]"
  - Error is shown in status banner in person dialog
- Error messages are truncated with "..." if too long, expandable on click

## Scenarios

### Scenario 1: Tooltip on failed person row
```
Given a person with status="sync_failed", sync_attempts=2, sync_error="Device timeout after 30s"
When the user hovers over the status badge
Then tooltip shows "Intento 2/3: Device timeout after 30s"
```

### Scenario 2: Expandable row detail
```
Given a person with status="sync_failed", sync_error="Card 123456 already assigned to EMP002"
When the user clicks to expand the row
Then row expands to show full details:
  - Sync status: Error
  - Attempts: 2/3
  - Last error: Card 123456 already assigned to EMP002
  - Last attempt: 2024-04-27 10:30:00
```

### Scenario 3: Error in person dialog banner
```
Given a person with status="sync_failed", sync_attempts=2, sync_error="Invalid card format"
When the user opens the edit dialog
Then a warning banner shows:
  "⚠️ Sync Error (Attempt 2/3): Invalid card format"
```

### Scenario 4: Dead-letter error display
```
Given a person with status="sync_dead_letter", sync_attempts=3, sync_error="Max retries exceeded"
When the user views the person
Then the status badge shows "Fallido"
And tooltip shows full error: "Intento 3/3: Max retries exceeded"
```

### Scenario 5: Clear error on successful re-sync
```
Given a person with status="sync_failed", sync_error="Device timeout"
When the user retries and sync succeeds
Then sync_error is set to null
And status becomes "active"
And no error is shown
```

## Acceptance Criteria

- [ ] Hovering/focusing on failed/dead-letter badge shows tooltip with attempt count and error
- [ ] Expanding a row shows full sync details including error message
- [ ] Person dialog shows error banner with attempt count for failed/dead-letter persons
- [ ] Error messages are truncated with option to see full text
- [ ] sync_error is cleared on successful re-sync
- [ ] Long error messages don't break UI layout

## Technical Notes

### Implementation Location
- `src/components/persons/persons-table.tsx` — expandable row, tooltip
- `src/components/persons/person-dialog.tsx` — error banner

### Tooltip Implementation
```typescript
// Simple title-based tooltip
<td 
  title={`Intento ${person.sync_attempts}/3: ${person.sync_error || 'Unknown error'}`}
  className="cursor-help"
>
  <SyncStatusBadge status={person.status} ... />
</td>
```

### Expandable Row Detail
```tsx
{expanded && (
  <TableRow className="bg-gray-50">
    <TableCell colSpan={100}>
      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <span className="font-medium">Estado:</span> {getStatusLabel(person.status)}
        </div>
        <div>
          <span className="font-medium">Intentos:</span> {person.sync_attempts}/3
        </div>
        <div className="col-span-2">
          <span className="font-medium">Último error:</span> 
          {person.sync_error || 'Sin errores'}
        </div>
      </div>
    </TableCell>
  </TableRow>
)}
```

### Error Banner in Dialog
```tsx
{['sync_failed', 'sync_dead_letter'].includes(person.status) && (
  <div className={`rounded p-3 mb-4 ${
    person.status === 'sync_dead_letter' 
      ? 'bg-gray-100 border border-gray-300' 
      : 'bg-red-50 border border-red-200'
  }`}>
    <p className="text-sm">
      <span className="font-semibold">
        {person.status === 'sync_dead_letter' ? '⚠️ Fallido' : '⚠️ Error de sincronización'}
      </span>
      {' '}(Intento {person.sync_attempts}/3)
      {person.sync_error && `: ${person.sync_error}`}
    </p>
  </div>
)}
```