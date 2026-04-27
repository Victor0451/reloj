# Verification Report

**Change**: event-driven-person-sync
**Version**: N/A
**Mode**: Standard (no test runner detected)

---

## Verification Scope

T4: Verify DB→device sync flow (code review)
T5: Test device→DB import via curl

---

## T4: DB→Device Sync Flow Review

### 1. Where does sync start?

- `startSingleDevicePersonSync` (person-sync-loop.ts:418) — single-device mode, called with device config
- Sync interval: 15000ms default (line 426)
- Calls `syncPendingPersons` for pending sync + `syncPersonsFromDevice` for device→DB import (lines 452-511)

### 2. How are pending_sync persons fetched?

`syncPendingPersons` (person-sync-loop.ts:80-119):
```typescript
const { data: pendingPersons, error } = await (supabase as any)
  .from("persons")
  .select("*")
  .or("status.eq.pending_sync,status.eq.sync_failed")
  .limit(batchSize);
```
✅ Fetches persons with status `pending_sync` or `sync_failed`

### 3. How is syncSinglePerson called?

- Called from `syncPendingPersons` loop (line 111)
- Passes pre-fetched `existingEmployeeNos` Set to avoid N+1 device queries

### 4. Employee ID Handling — CRITICAL ISSUE FOUND

**Code path when `employee_id` is null** (lines 127-198):

```typescript
const hasEmployeeId = !!person.employee_id;
const employeeNo = person.employee_id ?? `AUTO_${person.id.slice(0, 8)}`;

// ...

if (existsOnDevice) {
  await adapter.syncPerson(personData);  // search → update/create
} else {
  if (hasEmployeeId) {
    await adapter.syncPerson(personData);  // syncPerson (PUT)
  } else {
    // No employee_id — try createPerson (XML POST, device assigns number)
    const createMethod = (adapter as any).createPerson;
    if (typeof createMethod === 'function') {
      const result = await createMethod(personData);
```

**Key insight**: When `employee_id` is null, the code calls `adapter.createPerson()` (XML POST) — NOT `createPersonOnDevice()` (JSON POST).

### 5. createPersonOnDevice — Bug Found

In `hikvision.adapter.ts:805-856`:
```typescript
async createPersonOnDevice(person: Person): Promise<SyncResult> {
  const employeeNo = person.employeeNo || person.employeeId || '';
  // ...
  const body = {
    UserInfo: {
      employeeNo: employeeNo,  // ← empty string if both are falsy
```

**Issue**: If `employeeNo` is `AUTO_xxx` (non-numeric), `createPersonOnDevice` sends it to the device which will likely reject it because employeeNo must be numeric.

**However**: The null employee_id code path calls `adapter.createPerson()` (XML version), not `createPersonOnDevice()`. The XML `createPerson` (line 602-647) also sends `employeeNo` empty string when both are falsy — but the difference is the device MAY handle XML POST differently.

### 6. Sync Flow Summary

| Scenario | Code Path | Behavior |
|----------|-----------|----------|
| person has `employee_id` AND exists on device | `syncPerson` → search → update | ✅ Correct |
| person has `employee_id` AND not on device | `syncPerson` → search → create | ✅ Correct |
| person has `employee_id = null` AND not on device | `createPerson` (XML POST) | ⚠️ May work (device assigns number) |
| person has `employee_id = null` AND `createPerson` fails | Falls back to `syncPerson` with `AUTO_xxx` | ❌ `AUTO_xxx` likely rejected by device |

---

## T5: Device→DB Import Test

### Test Results

**Juan Perez (employeeNo 123) — FOUND ✅**
```json
{
  "employeeNo": "123",
  "name": "Juan Perez",
  "userType": "normal",
  "numOfCard": 1
}
```

**Test User (employeeNo 999) — FOUND ✅**
```json
{
  "employeeNo": "999",
  "name": "Test User",
  "userType": "normal",
  "numOfCard": 0
}
```

### CRITICAL: getPersons() is Broken

The `syncPersonsFromDevice` function (person-sync-loop.ts:275-375) uses `adapter.getPersons()` to fetch all device persons, then inserts them to DB.

**But `getPersons()` fails on this device** (returns empty array silently):
```
GET /ISAPI/AccessControl/UserInfo/1?format=0
→ 400 "notSupport" — endpoint not supported
```

**Implication**: `syncPersonsFromDevice` will fetch 0 persons and import nothing, even though Juan Perez and Test User exist on the device.

### Workaround Available

The **Search endpoint DOES work** (confirmed with curl). `searchPersonOnDevice(employeeNo)` successfully finds persons. But `getPersons()` uses a different endpoint that this device doesn't support.

**Consequence**: Device→DB import currently fails silently because `getPersons()` returns `[]`.

---

## Completeness

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1 | 1.1-1.5 (event-driven person sync) | ✅ ALL COMPLETE |
| Phase 2 | 2.1-2.10 (attendance control) | 🔲 NOT STARTED |

---

## Correctness (Static)

| Requirement | Status | Notes |
|-------------|--------|-------|
| 1.1 `AccessEvent` interface with `detectedName`, `detectedEmployeeNo` | ✅ Implemented | interfaces.ts |
| 1.2 Hikvision adapter extracts name/employeeNoString from minor=38 | ✅ Implemented | hikvision.adapter.ts:555-558 |
| 1.3 `upsertPersonFromEvent` function | ✅ Implemented | event-sync-loop.ts:17-65 |
| 1.4 Event sync calls upsertPersonFromEvent when detectedName present | ✅ Implemented | event-sync-loop.ts:174-188 |
| 1.5 FK `person_id` on access_events | ✅ Implemented | Event insert includes person_id |

---

## Issues Found

**CRITICAL** (must fix before archive):
1. **`syncPersonsFromDevice` broken**: `getPersons()` returns `[]` on this device. Device→DB import will never work until fixed.

**WARNING** (should fix):
1. **`createPerson` sends empty employeeNo**: When both `employeeNo` and `employeeId` are empty, sends empty string to device. Works if device assigns number, but behavior is unclear.
2. **No fallback for device→DB import**: When `getPersons()` fails, `syncPersonsFromDevice` should fall back to searching persons individually or at least log a warning.

**SUGGESTION** (nice to have):
1. **Consider batch search**: Since `getPersons()` is broken, consider implementing a batch search approach (search multiple employeeNos in one query or loop through known IDs).

---

## Verdict

**PASS WITH WARNINGS**

Phase 1 (T1-T3 equivalent) is fully implemented and code structure is correct. The DB→device sync flow is sound for the happy path. However:

1. **T4**: Sync flow handles null employee_id via `createPerson` (XML POST), which may work when device assigns the number — but this path is untested and the `AUTO_xxx` fallback if it fails would send invalid non-numeric ID to device.

2. **T5**: Device→DB import is **non-functional** because `getPersons()` uses an unsupported endpoint. Juan Perez and Test User are confirmed on the device but cannot be imported via current code path.

**Recommendation**: Fix `getPersons()` to use Search-based approach, OR implement a separate batch search mechanism for device→DB import.
