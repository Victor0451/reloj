# Exploration: person-module-hardening

**Date**: 2026-04-27  
**Phase**: sdd-explore  
**Project**: reloj  
**Artifact Store**: hybrid (engram + openspec)

---

## 1. Minimum Required Fields (ISAPI Device Requirements)

### ISAPI Validation Findings

**Device API (Hikvision DS-K1T320) requirements per validated curl examples:**

| Field | Required on Device? | Required for Check-in/out? | Risk if Missing |
|-------|---------------------|---------------------------|-----------------|
| `employeeNo` | **YES** — primary identifier, used in events as `employeeNoString` | **YES** — device matches events by this field | Events cannot be linked to DB record |
| `cardNo` | NO — user can be created without card | Card auth requires it; other auth modes (face/fp) don't | Person can't use card authentication |
| `name` | **YES** — sent in UserInfo body | NO — cosmetic on device | User created but may be nameless in device UI |
| `employee_id` (DB) | Maps to device `employeeNo` | **YES** if we want event linking | Sync generates `AUTO_` placeholder; device-assigned number unknown to DB |

### Key ISAPI Endpoints

```
POST /ISAPI/AccessControl/UserInfo/Record?format=json  → Create user (requires employeeNo)
POST /ISAPI/AccessControl/CardInfo/Record?format=json   → Assign card (requires employeeNo + cardNo)
PUT  /ISAPI/AccessControl/UserInfo/Modify?format=json   → Update user
```

### What Happens if Person Has No Card and No employee_id

1. DB record created with `employee_id=null`, `status=pending_sync`
2. Sync loop generates `AUTO_{id.slice(0,8)}` as placeholder employeeNo
3. `createPersonOnDevice` receives `AUTO_` prefix → calls `getNextAvailableEmployeeNo()` to find free number
4. If auto-assign succeeds: person created on device with real number, but **DB doesn't know the assigned number** → events cannot be linked
5. If auto-assign fails: person gets `sync_failed` status
6. Events from device come back with `employeeNoString` (the device-assigned number) but **DB has no mapping**

### Can a Person Be Created with Only a Name?

- **DB**: YES (only `name` is NOT NULL)
- **Device**: Technically yes, ISAPI only requires `employeeNo` and `name`
- **Functionally BROKEN**: Without `employee_id` the sync works but DB never learns the device-assigned employeeNo, making event linking impossible

---

## 2. Edit Flow Issues

**File**: `src/actions/persons.ts` — `updatePerson` function

```ts
const nameChanged = input.name && input.name !== existingPerson.name
const employeeChanged = input.employee_id !== undefined && input.employee_id !== existingPerson.employee_id
const needsSync = nameChanged || employeeChanged
// ...
if (needsSync) updateData.status = 'pending_sync'
```

### Issues Found

| # | Issue | Impact |
|---|-------|--------|
| H1 | **Card changes do NOT trigger re-sync** | `card_number` change is excluded from `needsSync`. DB updates, device never receives new card. |
| H2 | **Adapter `updatePersonOnDevice` never assigns cards** | Lines 981-1031 only send `UserInfo` body. No `assignCardToDevice` call exists anywhere in update flow. |
| H3 | **Department changes trigger unnecessary sync** | `department` IS included in `needsSync` (via `needsSync = nameChanged || employeeChanged` — wait, actually it's NOT, because `needsSync` only checks name/employeeChanged). Actually department is in `updateData` but doesn't trigger `pending_sync`. This is correct but suboptimal. |

### What Fields Trigger Re-sync

- ✅ `name` changed → sets `pending_sync`
- ✅ `employee_id` changed → sets `pending_sync`
- ❌ `card_number` changed → **NO re-sync**
- ❌ `department` changed → **NO re-sync** (correct — not sent to device)

### Card Update Flow Gap

```
User edits card_number in UI
  → updatePerson called with new card_number
  → needsSync = false (employee_id and name unchanged)
  → DB updated, status stays whatever it was (active/pending_sync)
  → Device NOT updated → person still has old card or no card on device
```

---

## 3. Delete Flow Issues

**File**: `src/actions/persons.ts` — `deletePerson` function

```ts
await admin.from('persons').update({ status: 'inactive' }).eq('id', id)
```

### Findings

| # | Aspect | Behavior |
|---|--------|----------|
| 1 | Delete type | **Soft delete** — sets `status='inactive'` in DB. Record persists. |
| 2 | Device deletion | **Sync loop DOES delete from device** — `cleanupInactivePersons` queries for `status='inactive'` AND `device_employee_no IS NOT NULL`, calls `adapter.deletePerson(empNo)`, clears `device_employee_no`. |
| 3 | Events preservation | `access_events.person_id` has `ON DELETE SET NULL` → events unlinked but preserved for audit. |
| 4 | **Dead-letter gap** | `cleanupInactivePersons` only processes `status='inactive'`. Persons in `sync_dead_letter` or `sync_failed` with `device_employee_no` are **never deleted from device**. |
| 5 | Reactivation | `reactivatePerson` sets `status='pending_sync'` → correct, triggers re-sync. |

### Cleanup Logic (person-sync-loop.ts)

```ts
// Lines 371-407: cleanupInactivePersons
const { data: inactivePersons } = await supabase
  .from('persons')
  .select("id, name, device_employee_no")
  .eq("status", "inactive")
  .not("device_employee_no", "is", null)
  .limit(50)
```

Only queries `status='inactive'`. Dead-letter persons are excluded.

---

## 4. Full Module Audit — Issues by Priority

### HIGH Priority

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| H1 | `card_number` edit changes doesn't sync to device | `src/actions/persons.ts:112` | `needsSync` excludes `card_number` change. Device never gets updated card. |
| H2 | Adapter `updatePersonOnDevice` never assigns cards | `agent/src/adapters/hikvision.adapter.ts:981` | `updatePersonOnDevice` only sends `UserInfo`. No `assignCardToDevice` call. New cards never reach device after person creation. |
| H3 | `employee_id` can be null, breaking event linking | `src/actions/persons.ts:52`, `supabase/schema.sql:24` | Only `name` validated as required. Null `employee_id` accepted, but sync produces un-linkable records. |
| H4 | `sync_attempts`, `sync_error` missing from TypeScript type | `src/types/person.types.ts:1` | DB has these columns (migration 009) but type definition doesn't. Also `sync_dead_letter` not in status union. |

### MEDIUM Priority

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| M1 | Dead-letter persons not cleaned from device | `agent/src/sync/person-sync-loop.ts:379` | `cleanupInactivePersons` only handles `status='inactive'`. Dead-letter persons with `device_employee_no` stay on device forever. |
| M2 | UI doesn't show `sync_error` or `sync_attempts` | `src/components/persons/persons-table.tsx` | Persons in `sync_failed`/`sync_dead_letter` show badge but no error details. User can't see WHY it failed. |
| M3 | Batch CSV: row skipped entirely if name missing | `src/actions/persons.ts:267` | Row with missing name is skipped completely, even if it has valid `employee_id` and `card_number`. |
| M4 | CSV import doesn't validate card_number format | `src/actions/persons.ts:264` | No format validation. Whitespace-only cards accepted. |
| M5 | PersonDialog: no sync status indicator on edit | `src/components/persons/person-dialog.tsx` | Editing shows form fields but no sync status badge. User can't see if they're editing an active vs failed person. |

### LOW Priority

| # | Issue | File(s) | Description |
|---|-------|---------|-------------|
| L1 | `employee_id` uniqueness not enforced at DB level | `supabase/schema.sql:24` | TEXT without UNIQUE constraint. Duplicate employee_ids can be created. Will fail on device sync (device enforces uniqueness) but DB allows duplicates. |
| L2 | Card number input allows whitespace | `src/components/persons/person-dialog.tsx:154` | `card_number` field accepts `"  "` as value, stored as-is. Could cause device rejection. |
| L3 | `syncPersonsFromDevice` runs every sync cycle | `agent/src/sync/person-sync-loop.ts:491` | Imports persons from device every 15s. No guard for already-imported. Could cause DB bloat with many device persons. |
| L4 | `device_employee_no` is INTEGER but employeeNo on device is string | `supabase/schema.sql:29` | `device_employee_no INTEGER` vs device `employeeNo` string. Conversion via `parseInt` works for numeric IDs but could overflow for large numbers. |

---

## 5. Suggested Improvements (Grouped)

### Group A — Required Field Validation
- Add `employee_id` required validation in `createPerson` (or deterministic auto-generation)
- Add `card_number` trim + format validation (numeric, expected length)
- Add `sync_attempts: number`, `sync_error: string | null`, `sync_dead_letter` to `PersonRecord` type

### Group B — Edit/Sync Fixes
- Fix `updatePerson` to trigger `pending_sync` on `card_number` change
- Update HikvisionAdapter `updatePersonOnDevice` to call `assignCardToDevice` when card is new/different
- Add "Re-sync" manual action for `sync_failed` persons

### Group C — Dead-letter & Cleanup
- Add manual "Force delete from device" for dead-letter persons
- Expand `cleanupInactivePersons` to include `sync_failed` persons with `device_employee_no`
- Consider a dead-letter queue UI for admin review

### Group D — Data Integrity
- Add partial unique index on `employee_id` WHERE `employee_id IS NOT NULL`
- Prevent overflow: validate `device_employee_no` fits in INTEGER before `parseInt`

### Group E — UX Improvements
- Show `sync_error` message in persons table (tooltip or expandable)
- Show sync status badge in `PersonDialog` on edit mode
- Improve CSV batch: allow partial row imports, validate card format

---

## 6. Recommended Approach for Proposal

### For the Proposal Phase

**Scope**: Person module hardening — fix edit/sync flow, add required field validation, improve dead-letter handling, and enhance UX feedback.

**Recommended Phases**:

| Phase | Focus | Key Changes |
|-------|-------|------------|
| **Phase 1** | Required field validation | `employee_id` required + auto-generation strategy; `sync_attempts`/`sync_error`/`sync_dead_letter` in type |
| **Phase 2** | Edit flow + card sync | `updatePerson` triggers sync on card change; adapter calls `assignCardToDevice` on card update |
| **Phase 3** | Dead-letter UX + cleanup | Dead-letter UI for admins; force-delete from device action; show `sync_error` in table |
| **Phase 4** | Data integrity | Unique constraint on `employee_id`; card format validation |

**Risks**:
- `employee_id` becoming required could break existing records with null values (migration needed)
- Card re-assignment ordering: must update UserInfo first, then assign card (ISAPI dependency)
- Sync loop complexity increases with card update logic (potential for race conditions)

**Open Questions for Orchestrator**:
1. Should `employee_id` be strictly required at create time, or auto-generated with a deterministic algorithm?
2. Is there a maximum retry policy for dead-letter persons, or manual-only forever?
3. Should the sync loop handle card updates (complex) or just add a manual "reassign card" action (simple)?

---

## Affected Files Summary

| File | Relevance |
|------|-----------|
| `src/actions/persons.ts` | Edit/delete/create validation issues |
| `src/types/person.types.ts` | Missing `sync_attempts`, `sync_error`, `sync_dead_letter` |
| `src/components/persons/person-dialog.tsx` | Missing card validation, no status in edit |
| `src/components/persons/persons-table.tsx` | No sync_error display |
| `agent/src/adapters/hikvision.adapter.ts` | `updatePersonOnDevice` missing card assignment |
| `agent/src/sync/person-sync-loop.ts` | Dead-letter persons not cleaned from device |
| `supabase/schema.sql` | No uniqueness on `employee_id`; type missing `sync_failed`/`sync_dead_letter` |
| `supabase/migrations/009_add_sync_retry_columns.sql` | Correctly adds columns but type enum may be incomplete |
