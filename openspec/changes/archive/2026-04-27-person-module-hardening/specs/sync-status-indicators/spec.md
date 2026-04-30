# Spec: Sync Status Indicators

## Overview

Makes sync status visible to users through color-coded badges in the persons table and person dialog. Users can immediately see whether a person is synchronized, pending, failed, or dead-lettered without having to dig into details.

## Current Behavior

**Before this change:**
- Persons table shows a simple badge for status
- Only basic states shown: "Activo", "Inactivo", "Pendiente"
- No differentiation between `sync_failed` and `sync_dead_letter`
- No visual indicator of `sync_attempts` count
- No way to see sync state in the edit dialog

## Expected Behavior

**After this change:**
- Persons table shows detailed status badges:
  - `pending_sync` → yellow/amber badge "Pendiente" + spinner icon
  - `sync_failed` → red badge "Error" + retry icon
  - `sync_dead_letter` → gray badge "Fallido" + warning icon
  - `active` → green badge "Sincronizado"
  - `inactive` → gray badge "Inactivo"
- Sync status is also shown in person dialog (read-only, for visibility)
- Badges include attempt count for failed states (e.g., "Error (2/3)")

## Scenarios

### Scenario 1: Active person badge
```
Given a person with status="active", name="Juan Perez"
When the persons table is rendered
Then the status column shows green badge "Sincronizado" ✓
```

### Scenario 2: Pending sync person badge with spinner
```
Given a person with status="pending_sync", name="Juan Perez"
When the persons table is rendered
Then the status column shows amber badge "Pendiente" with spinning icon
And no attempt count is shown
```

### Scenario 3: Sync failed person badge with attempts
```
Given a person with status="sync_failed", sync_attempts=2, name="Juan Perez"
When the persons table is rendered
Then the status column shows red badge "Error (2/3)"
And clicking/hovering shows tooltip with sync_error message
```

### Scenario 4: Dead-letter person badge
```
Given a person with status="sync_dead_letter", sync_attempts=3, name="Juan Perez"
When the persons table is rendered
Then the status column shows gray badge "Fallido"
And a warning icon is visible
And clicking shows option to "Retry" or "Discard"
```

### Scenario 5: Sync status in edit dialog
```
Given a person with status="sync_failed", sync_attempts=2
When the user opens the person in edit dialog
Then at the top of the dialog, a status banner shows:
  "⚠️ Sincronización fallida. Último intento: 2/3. Error: [error message]"
```

### Scenario 6: Inactive person badge
```
Given a person with status="inactive", name="Juan Perez"
When the persons table is rendered
Then the status column shows gray badge "Inactivo"
And no sync-related icons are shown
```

## Acceptance Criteria

- [ ] `active` → green badge "Sincronizado" with checkmark icon
- [ ] `pending_sync` → amber badge "Pendiente" with spinning sync icon
- [ ] `sync_failed` → red badge "Error" with retry icon and attempt count (e.g., "Error (2/3)")
- [ ] `sync_dead_letter` → gray badge "Fallido" with warning icon
- [ ] `inactive` → gray badge "Inactivo"
- [ ] Hover/tooltip on failed/dead-letter shows `sync_error` message
- [ ] Person dialog shows sync status banner when editing failed/dead-letter persons
- [ ] Badges are consistent across table and dialog

## Technical Notes

### Implementation Location
- `src/components/persons/persons-table.tsx` — status badge component
- `src/components/persons/person-dialog.tsx` — status banner in dialog
- `src/components/ui/status-badge.tsx` — reusable badge component (new or existing)

### Badge Component API
```typescript
interface SyncStatusBadgeProps {
  status: PersonStatus
  syncAttempts?: number
  syncError?: string | null
  onRetry?: () => void
  onDiscard?: () => void
}

// Usage
<SyncStatusBadge 
  status={person.status} 
  syncAttempts={person.sync_attempts}
  syncError={person.sync_error}
  onRetry={handleRetry}
  onDiscard={handleDiscard}
/>
```

### Color Palette
```typescript
const STATUS_COLORS = {
  active: { bg: 'bg-green-100', text: 'text-green-800', icon: '✓' },
  pending_sync: { bg: 'bg-amber-100', text: 'text-amber-800', icon: '↻' }, // spinning
  sync_failed: { bg: 'bg-red-100', text: 'text-red-800', icon: '↻' },
  sync_dead_letter: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '⚠' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-500', icon: '○' },
}
```

### Tooltip Implementation
```typescript
// Using title attribute for simple tooltip
<span 
  title={`Intento ${syncAttempts}/3: ${syncError}`}
  className="cursor-help"
>
  <SyncStatusBadge ... />
</span>

// Or use a proper tooltip library if project has one
<Tooltip content={`Intento ${syncAttempts}/3: ${syncError}`}>
  <SyncStatusBadge ... />
</Tooltip>
```

### PersonDialog Status Banner
```tsx
{person.status === 'sync_failed' && (
  <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
    <p className="text-sm text-red-800">
      ⚠️ Sincronización fallida. Último intento: {person.sync_attempts}/3.
      {person.sync_error && ` Error: ${person.sync_error}`}
    </p>
  </div>
)}

{person.status === 'sync_dead_letter' && (
  <div className="bg-gray-50 border border-gray-300 rounded p-3 mb-4">
    <p className="text-sm text-gray-700">
      ⚠️ Sincronización fallida definitivamente. 
      <button onClick={handleRetry} className="underline ml-1">Reintentar</button>
      {' o '}
      <button onClick={handleDiscard} className="underline ml-1">Descartar</button>
    </p>
  </div>
)}
```

### Accessibility
- Badges should have `aria-label` describing full status
- Icons should have `aria-hidden="true"` if decorative
- Error messages should be screen-reader accessible
- Color alone should not convey status (always include text/icon)
