# Delta: Device Capacity Handling

## MODIFIED Requirements

### Requirement: HikvisionAdapter.createPersonOnDevice MUST return distinct error for HTTP 402

The HikvisionAdapter `createPersonOnDevice` method MUST parse HTTP 402 responses as a distinct "device full" error condition and include this in the returned `SyncResult.error` field with a value containing `"device_full"`.

(Previously: All non-2xx responses returned generic "Create failed: {status}" error)

#### Scenario: HTTP 402 returns device_full error

- GIVEN `createPersonOnDevice` receives a valid person and the device returns HTTP 402
- WHEN the adapter processes the response
- THEN the returned `SyncResult` has `success: false` and `error` containing `"device_full"`

#### Scenario: HTTP 200 returns success

- GIVEN `createPersonOnDevice` receives a valid person and the device returns HTTP 200
- WHEN the adapter processes the response
- THEN the returned `SyncResult` has `success: true` and a valid `employeeNo`

#### Scenario: Other HTTP errors return generic error (unchanged)

- GIVEN `createPersonOnDevice` receives a valid person and the device returns a non-402 error (e.g., 500)
- WHEN the adapter processes the response
- THEN the returned `SyncResult` has `success: false` and `error` containing `"Create failed: {status}"`

---

### Requirement: Person sync loop MUST treat HTTP 402 as immediate dead-letter with 1 attempt

The person sync loop in `person-sync-loop.ts` MUST immediately move a person to `sync_dead_letter` status upon detecting a `"device_full"` error from `createPersonOnDevice`, without incrementing retry attempts.

(Previously: HTTP 402 would trigger up to 3 retry attempts before dead-letter)

#### Scenario: Device full (402) dead-letters immediately

- GIVEN a person in `pending_sync` status with `sync_attempts = 0`
- AND `createPersonOnDevice` returns error containing `"device_full"`
- WHEN the sync loop processes the failure
- THEN the person's status becomes `sync_dead_letter` with `sync_attempts = 1` (not incremented)
- AND `sync_error` is set to `"device_full"`

#### Scenario: Device full updates device capacity status to 'full'

- GIVEN `createPersonOnDevice` returns error containing `"device_full"`
- WHEN the sync loop processes the failure
- THEN the device's `device_capacity_status` field in the `devices` table is updated to `'full'`

#### Scenario: Non-402 errors follow existing 3-attempt retry logic (unchanged)

- GIVEN a person in `pending_sync` status with `sync_attempts = 0`
- AND `createPersonOnDevice` returns a non-402 error
- WHEN the sync loop processes the failure
- THEN the person moves to `sync_failed` with `sync_attempts = 1`
- AND the person is retried up to 2 more times before dead-letter

---

### Requirement: devices table MUST include device_capacity_status field

The `devices` table MUST include a `device_capacity_status` column with type `VARCHAR` default `'unknown'`, containing one of: `'ok'`, `'near_full'`, `'full'`, `'unknown'`.

#### Scenario: New device starts with unknown capacity status

- GIVEN a new device is enrolled
- WHEN the device record is created in the `devices` table
- THEN `device_capacity_status` is set to `'unknown'`

#### Scenario: Device full event updates status to 'full'

- GIVEN a person sync fails with HTTP 402
- WHEN the failure is processed
- THEN the device's `device_capacity_status` is updated to `'full'`

#### Scenario: Successful sync on 'full' device updates status back to 'ok'

- GIVEN a device has `device_capacity_status = 'full'`
- AND a subsequent person sync succeeds
- WHEN the success is processed
- THEN the device's `device_capacity_status` is updated to `'ok'`

#### Scenario: UserInfo/Count query detects near_full (optional)

- GIVEN the sync loop queries `UserInfo/Count` endpoint
- AND the response indicates capacity is between 80-95%
- WHEN the query result is processed
- THEN the device's `device_capacity_status` is updated to `'near_full'`

#### Scenario: UserInfo/Count query fails leaves status unchanged

- GIVEN the sync loop queries `UserInfo/Count` endpoint
- AND the query fails (network error, timeout, etc.)
- WHEN the query result is processed
- THEN the device's `device_capacity_status` remains unchanged (keeps prior value)

---

## BEHAVIOR CHANGE SUMMARY

| Before | After |
|--------|-------|
| HTTP 402 → 3 retry attempts → dead-letter | HTTP 402 → immediate dead-letter (1 attempt), device marked `full` |
| No device capacity tracking | `devices.device_capacity_status` field tracks `ok\|near_full\|full\|unknown` |
| Device full status only cleared by manual intervention | Device full cleared automatically when subsequent sync succeeds |