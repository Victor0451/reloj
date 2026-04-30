# Tasks: person-module-hardening

## Overview

Implementation task breakdown for the person-module-hardening change. Groups tasks by phase and priority. Dependencies: TypeScript types must be done first (all other changes depend on correct types).

---

## Phase 1: TypeScript Types (Prerequisite)

**Why first**: All backend, agent, and frontend changes depend on correct types. Doing this first ensures type safety throughout.

### 1.1 — Update PersonRecord type with sync fields
- **Description**: Add `sync_attempts: number` and `sync_error: string | null` to PersonRecord interface in `src/types/person.types.ts`
- **Files affected**: `src/types/person.types.ts`
- **Verification**: `npx tsc --noEmit` passes with no errors
- **Complexity**: LOW

### 1.2 — Add PersonStatus union type with new statuses
- **Description**: Create `PersonStatus` type union: `'active' | 'inactive' | 'pending_sync' | 'sync_failed' | 'sync_dead_letter'`. Update `PersonRecord.status` to use this type.
- **Files affected**: `src/types/person.types.ts`
- **Verification**: All usages of `person.status` accept new values without type errors
- **Complexity**: LOW

### 1.3 — Audit all imports of person.types
- **Description**: Find all files importing from `src/types/person.types.ts` and verify they handle (or don't break on) new fields. Check if `database.types.ts` (Supabase) also needs regeneration.
- **Files affected**: Any file importing `PersonRecord`, `PersonStatus`, or related types
- **Verification**: `npx tsc --noEmit` passes with no errors across entire codebase
- **Complexity**: LOW

---

## Phase 2: Backend Validation (createPerson, updatePerson)

**Why next**: Validation rules are core business logic. Must be in place before UI validation can work correctly.

### 2.1 — Add minimum required fields validation in createPerson
- **Description**: In `src/actions/persons.ts`, `createPerson` function: validate that at least one of `employee_id` OR `card_number` is present (not null/empty). Return clear error: "Person must have either employee_id or card_number"
- **Files affected**: `src/actions/persons.ts`
- **Verification**: Create person without either field → rejection with correct error message
- **Complexity**: LOW

### 2.2 — Add minimum required fields validation in updatePerson
- **Description**: In `src/actions/persons.ts`, `updatePerson` function: validate that at least one of `employee_id` OR `card_number` remains after edit. Block if both become null/empty.
- **Files affected**: `src/actions/persons.ts`
- **Verification**: Edit person to clear both fields → rejection with correct error message
- **Complexity**: LOW

### 2.3 — Fix needsSync to include card_number changes
- **Description**: In `updatePerson`, expand `needsSync` logic to include `card_number` changes. Remove `department` from needsSync (not sent to device).
- **Files affected**: `src/actions/persons.ts`
- **Verification**: Edit only `card_number` → status becomes `pending_sync`. Edit only `department` → status stays unchanged.
- **Complexity**: LOW

### 2.4 — Auto-assign employeeNo when only card_number provided
- **Description**: Document in `createPerson` that when only `card_number` is provided, sync agent must call `getNextAvailableEmployeeNo()`. No code change needed in actions — this is handled by sync agent on device sync.
- **Files affected**: `src/actions/persons.ts` (comment/docs only)
- **Verification**: Person created with only card_number shows status `pending_sync` and gets employeeNo assigned on device
- **Complexity**: LOW

### 2.5 — Create resetPersonSync action for dead-letter retry
- **Description**: Create new `resetPersonSync(personId)` function in `src/actions/persons.ts`: sets status to `pending_sync`, resets `sync_attempts` to 0, clears `sync_error`. Include 30s debounce check.
- **Files affected**: `src/actions/persons.ts`
- **Verification**: Calling resetPersonSync on dead-letter person → status becomes `pending_sync`, attempts reset to 0
- **Complexity**: MEDIUM

### 2.6 — Create discardPerson action for dead-letter cleanup
- **Description**: Create new `discardPerson(personId)` function: checks if person has `device_employee_no`, if so calls agent to delete from device first. On success, sets `device_employee_no` to null and status to `inactive`.
- **Files affected**: `src/actions/persons.ts`
- **Verification**: Discard person with device_employee_no → device deletion called first, then DB updated. Discard person without device_employee_no → immediate soft-delete.
- **Complexity**: MEDIUM

---

## Phase 3: Agent Adapter Fixes

**Why this phase**: Adapter fixes enable proper device synchronization. Must be done before UI retry/discard can work.

### 3.1 — Fix HikvisionAdapter.updatePersonOnDevice to call assignCardToDevice on card change
- **Description**: In `agent/src/adapters/hikvision.adapter.ts`, modify `updatePersonOnDevice` to accept optional `previousCardNumber` parameter. After successful PUT of UserInfo, compare `card_number` with previous value. If changed, call `assignCardToDevice()`.
- **Files affected**: `agent/src/adapters/hikvision.adapter.ts`
- **Verification**: Change card_number on device → assignCardToDevice is called with new card. No change → no assignCardToDevice call.
- **Complexity**: MEDIUM

### 3.2 — Add card conflict handling in assignCardToDevice
- **Description**: In `assignCardToDevice`: check if card already exists on another employee. If so, delete from previous owner first, then assign to new owner.
- **Files affected**: `agent/src/adapters/hikvision.adapter.ts`
- **Verification**: Assign card that exists on EMP002 to EMP001 → card removed from EMP002, assigned to EMP001
- **Complexity**: MEDIUM

### 3.3 — Verify deletePerson handles "not found" as success
- **Description**: Verify `deletePerson` in HikvisionAdapter treats "not found" response as success (already deleted). Per spec, this is already done — confirm and add comment.
- **Files affected**: `agent/src/adapters/hikvision.adapter.ts`
- **Verification**: Delete person that doesn't exist on device → succeeds without error
- **Complexity**: LOW

### 3.4 — Add dead-letter device cleanup in sync loop
- **Description**: In `agent/src/sync/person-sync-loop.ts`, add `cleanupDeadLetterPersons` function: picks up `sync_dead_letter` persons with `device_employee_no` that have been in dead-letter > 7 days, calls deletePerson on device, clears device_employee_no, marks inactive.
- **Files affected**: `agent/src/sync/person-sync-loop.ts`
- **Verification**: Person in dead-letter > 7 days with device_employee_no → auto-cleaned from device and marked inactive
- **Complexity**: MEDIUM

---

## Phase 4: UI - Status Badges

**Why this phase**: UI status indicators are highly visible and depend on correct types.

### 4.1 — Update Badge component mapping for new statuses
- **Description**: Find or create `StatusBadge` component. Add/verify mapping for `sync_failed` (red) and `sync_dead_letter` (gray) with correct colors and icons.
- **Files affected**: `src/components/ui/status-badge.tsx` (or similar), `src/components/persons/persons-table.tsx`
- **Verification**: Each status shows correct badge: active=green, pending_sync=amber+spinner, sync_failed=red+retry, sync_dead_letter=gray+warning, inactive=gray
- **Complexity**: LOW

### 4.2 — Add sync status to person dialog header
- **Description**: In `src/components/persons/person-dialog.tsx`, add status banner at top when editing a person with `sync_failed` or `sync_dead_letter` status. Show sync_error and attempt count.
- **Files affected**: `src/components/persons/person-dialog.tsx`
- **Verification**: Open edit dialog for failed person → banner shows error details
- **Complexity**: LOW

### 4.3 — Add attempt count display to badges
- **Description**: For `sync_failed` status, show attempt count in badge (e.g., "Error (2/3)"). Dead-letter shows "Fallido" with warning icon.
- **Files affected**: `src/components/ui/status-badge.tsx` (or similar)
- **Verification**: Person with sync_attempts=2 shows "Error (2/3)" in badge
- **Complexity**: LOW

---

## Phase 5: UI - Dead Letter Management

**Why this phase**: Dead-letter retry/discard is a key user-facing feature.

### 5.1 — Show dead-letter persons in persons table or separate section
- **Description**: Filter and display persons with `status='sync_dead_letter'` in persons table, or create dedicated dead-letter section/page. Badge count in navigation.
- **Files affected**: `src/components/persons/persons-table.tsx`, navigation component
- **Verification**: Navigation shows dead-letter count badge. Dead-letter persons visible in table/section.
- **Complexity**: MEDIUM
- **Status**: [x] Done — dead-letter already in filter dropdown (line 174), gray badge shows with XCircle icon

### 5.2 — Add Retry button with 30s debounce
- **Description**: For each dead-letter person, add Retry button that calls `resetPersonSync`. Button disabled during 30s debounce window with tooltip showing countdown.
- **Files affected**: `src/components/persons/persons-table.tsx`
- **Verification**: Click Retry → status becomes `pending_sync`. Click again within 30s → button disabled, tooltip shows "Wait Xs"
- **Complexity**: MEDIUM
- **Status**: [x] Done — "Reintentar" button added to dropdown for sync_dead_letter status, calls handleRetry → resetPersonSync

### 5.3 — Add "Delete from device" / Discard option for dead-letters
- **Description**: Add Discard button for dead-letter persons that calls `discardPerson`. Handles device deletion (if has device_employee_no) then soft-delete.
- **Files affected**: `src/components/persons/persons-table.tsx`
- **Verification**: Discard person with device_employee_no → device deletion attempted first. Discard person without → immediate soft-delete.
- **Complexity**: MEDIUM
- **Status**: [x] Done — "Descartar" button added to dropdown for sync_dead_letter status, calls handleDiscard → discardPerson

### 5.4 — Connect retry/discard to resetPersonSync and discardPerson actions
- **Description**: Wire up the UI buttons to call the backend actions created in Phase 2. Show loading state, handle errors with toast notifications.
- **Files affected**: `src/components/persons/persons-table.tsx`
- **Verification**: Click Retry → action called → UI updates. Click Discard → action called → person removed from list.
- **Complexity**: LOW
- **Status**: [x] Done — handleRetry and handleDiscard in persons-client.tsx call respective actions with toast notifications

---

## Phase 6: UI - Sync Error Display

**Why this phase**: Error visibility helps users understand sync issues.

### 6.1 — Add expandable row detail showing sync_error
- **Description**: In persons table, allow rows to expand (or add detail button) showing full sync details: status, attempts, last error, last attempt timestamp.
- **Files affected**: `src/components/persons/persons-table.tsx`
- **Verification**: Click expand on failed person → shows full error details and attempt count
- **Complexity**: MEDIUM

### 6.2 — Add tooltip with last error message on badge hover
- **Description**: Add `title` attribute or tooltip on status badge showing "Intento X/3: [error message]". Use truncation if error is long.
- **Files affected**: `src/components/ui/status-badge.tsx`, `src/components/persons/persons-table.tsx`
- **Verification**: Hover over error badge → tooltip shows attempt count and error message
- **Complexity**: LOW

### 6.3 — sync_attempts count display in table
- **Description**: Ensure `sync_attempts` is visible in table for failed/dead-letter persons (via expandable detail or inline).
- **Files affected**: `src/components/persons/persons-table.tsx`
- **Verification**: Failed person shows "2/3" attempts in expandable detail
- **Complexity**: LOW

---

## Phase 7: Verification

**Why last**: After all code changes, verify against acceptance criteria.

### 7.1 — Test create without employee_id AND without card_number → should reject
- **Description**: Create person with name only, leave employee_id and card_number empty. Expect: rejection with error "Person must have either employee_id or card_number"
- **Files affected**: N/A (test)
- **Verification**: Manual or E2E test passes
- **Complexity**: LOW

### 7.2 — Test create with employee_id only → should succeed
- **Description**: Create person with name and employee_id only. Expect: creation succeeds, status = `pending_sync`
- **Files affected**: N/A (test)
- **Verification**: Manual or E2E test passes
- **Complexity**: LOW

### 7.3 — Test create with card_number only → should auto-assign employeeNo
- **Description**: Create person with name and card_number only. Expect: creation succeeds, status = `pending_sync`, sync agent assigns employeeNo on device
- **Files affected**: N/A (test)
- **Verification**: Person synced to device gets employeeNo assigned via getNextAvailableEmployeeNo()
- **Complexity**: MEDIUM

### 7.4 — Test edit card_number → should sync to device
- **Description**: Edit existing person, change card_number. Expect: status becomes `pending_sync`, sync agent calls updatePersonOnDevice AND assignCardToDevice with new card
- **Files affected**: N/A (test)
- **Verification**: Device receives updated card assignment
- **Complexity**: MEDIUM

### 7.5 — Test dead-letter retry → should reset and sync
- **Description**: Take dead-letter person, click Retry. Expect: status = `pending_sync`, sync_attempts = 0, agent picks up within 15s
- **Files affected**: N/A (test)
- **Verification**: After retry, person syncs successfully (or fails again with new attempt)
- **Complexity**: MEDIUM

### 7.6 — Test dead-letter discard → should delete from device first
- **Description**: Discard dead-letter person with device_employee_no. Expect: device deletion called first, then DB updated. On success, device_employee_no = null, status = `inactive`
- **Files affected**: N/A (test)
- **Verification**: Device entry removed, DB reflects soft-delete
- **Complexity**: MEDIUM

### 7.7 — TypeScript compilation passes
- **Description**: Run `npx tsc --noEmit` across entire project. All types correct, no errors.
- **Files affected**: N/A
- **Verification**: `tsc` exits with code 0
- **Complexity**: LOW

---

## Task Summary

| Phase | Tasks | Complexity |
|-------|-------|------------|
| Phase 1: TypeScript Types | 1.1, 1.2, 1.3 | LOW |
| Phase 2: Backend Validation | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 | LOW-MEDIUM |
| Phase 3: Agent Adapter Fixes | 3.1, 3.2, 3.3, 3.4 | MEDIUM |
| Phase 4: UI - Status Badges | 4.1, 4.2, 4.3 | LOW |
| Phase 5: UI - Dead Letter Management | 5.1, 5.2, 5.3, 5.4 | MEDIUM |
| Phase 6: UI - Sync Error Display | 6.1, 6.2, 6.3 | LOW-MEDIUM |
| Phase 7: Verification | 7.1-7.7 | LOW-MEDIUM |

**Total tasks**: 22

**Estimated total complexity**: 15 LOW, 7 MEDIUM — no HIGH complexity tasks identified.
