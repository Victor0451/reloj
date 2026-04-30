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
And the error is also shown in expandable detail
```

### Scenario 5: Clear error on successful re-sync
```
Given a person with status="sync_failed", sync_error="Device timeout"
When the user retries and sync succeeds
Then sync_error is set to null
And status becomes "active"
And no error is shown
```

### Scenario 6: Very long error message truncation
```
Given a person with sync_error="HTTP 504: Gateway Timeout - upstream device did not respond within 30000ms. Card assignment failed."
When the error is displayed in tooltip
Then it is truncated to ~100 chars with "..."
And user can click to see full message
```

## Acceptance Criteria

- [ ] Hovering/focusing on failed/dead-letter badge shows tooltip with attempt count and error
- [ ] Expanding a row shows full sync details including error message
- [ ] Person dialog shows error banner with attempt count for failed/dead-letter persons
- [ ] Error messages are truncated with option to see full text
- [ ] Last attempt timestamp is shown (if available)
- [ ] sync_error is cleared on successful re-sync
- [ ] Long error messages don't break UI layout

## Technical Notes

### Implementation Location
- `src/components/persons/persons-table.tsx` — expandable row, tooltip
- `src/components/persons/person-dialog.tsx` — error banner
- `src/components/ui/expandable-detail.tsx` — reusable expandable component

### Tooltip Implementation
```typescript
// Simple title-based tooltip
<td 
  title={`Intento ${person.sync_attempts}/3: ${person.sync_error || 'Unknown error'}`}
  className="cursor-help"
>
  <SyncStatusBadge status={person.status} ... />
</td>

// Or with proper tooltip component
<Tooltip 
  content={
    <div className="p-2">
      <div className="font-semibold">Intento {syncAttempts}/3</div>
      <div>{syncError}</div>
    </div>
  }
>
  <SyncStatusBadge status={person.status} ... />
</Tooltip>
```

### Expandable Row Detail
```tsx
<TableRow>
  {/* ... normal cells ... */}
  <TableCell>
    <SyncStatusBadge status={person.status} ... />
  </TableCell>
  <TableCell>
    <button 
      onClick={() => setExpanded(!expanded)}
      className="text-blue-600 hover:underline"
    >
      {expanded ? 'Ocultar' : 'Ver'} detalles
    </button>
  </TableCell>
</TableRow>

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
        {person.updated_at && (
          <div>
            <span className="font-medium">Último intento:</span> {formatDateTime(person.updated_at)}
          </div>
        )}
      </div>
    </TableCell>
  </TableRow>
)}
```

### Error Banner in Dialog
```tsx
{['sync_failed', 'sync_dead_letter'].includes(person.status) && (
  <div 
    className={`rounded p-3 mb-4 ${
      person.status === 'sync_dead_letter' 
        ? 'bg-gray-100 border border-gray-300' 
        : 'bg-red-50 border border-red-200'
    }`}
  >
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

### Error Message Truncation
```typescript
function truncateError(error: string, maxLength: number = 100): string {
  if (error.length <= maxLength) return error
  return error.slice(0, maxLength) + '...'
}

// Usage
<span title={syncError}>
  {truncateError(syncError)}
</span>
```

### Accessibility
- Error messages must be in DOM (not just title attribute) for screen readers
- Use `aria-describedby` to associate badge with error description
- Provide expanded view as alternative to tooltip
- Color + text + icon ensures accessibility beyond color blindness
