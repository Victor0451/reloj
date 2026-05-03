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

### Scenario: Device circuit state shown in status banner

```
Given a person linked to device with circuit_state="open" or "half_open"
When the user opens the person in edit dialog
Then the status banner SHOULD display:
  "⚡ Device unreachable (circuit [open/half_open])"
And if circuit_state="open", show estimated recovery time
And if circuit_state="half_open", show "Testing connection..."
```

### Scenario: Circuit state color coding for devices

```
Given a device with circuit_state="closed"
When the device status section is rendered
Then show green badge "Connected"

Given a device with circuit_state="open"
When the device status section is rendered
Then show red badge "Disconnected (circuit open)"

Given a device with circuit_state="half_open"
When the device status section is rendered
Then show amber badge "Testing connection"
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
- [ ] `circuit_state='closed'` → green badge "Connected"
- [ ] `circuit_state='open'` → red badge "Disconnected (circuit open)"
- [ ] `circuit_state='half_open'` → amber badge "Testing connection"