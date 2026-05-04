# Spec: Person Sync Rollback

## Requirement: Transactional Person Sync with Rollback

Person sync to device and DB must maintain consistency. If either operation fails, the other must be compensated.

### Scenario: Successful sync
- GIVEN a person with status `pending_sync` or `sync_failed`
- WHEN `syncSinglePerson` is called
- THEN the person is created/updated on the device
- AND DB is updated with `device_committed` status
- AND final status becomes `synced`

### Scenario: Device sync succeeds but DB fails
- GIVEN a person synced to device successfully
- WHEN DB update fails
- THEN the device change MUST be rolled back (person deleted from device)
- AND person status becomes `sync_failed` with error logged

### Scenario: Device sync fails
- GIVEN a person fails to sync to device
- WHEN the device API call fails
- THEN DB status becomes `sync_failed`
- AND no rollback needed (nothing committed on device)

### Scenario: Retry on device_committed
- GIVEN a person is in `device_committed` state (device synced but DB not yet updated)
- WHEN next sync cycle runs
- THEN the person should be retried from `device_committed` state
- AND DB update should be retried

## Data Contract

### Person Status Flow
```
pending_sync → device_committed → synced (success)
pending_sync → sync_failed (device error, no rollback needed)
device_committed → sync_failed (DB error, rollback required)
device_committed → synced (retry succeeded)
sync_failed → device_committed (retry)
```

### Error Handling
- Device API errors: set `sync_failed` with error message
- DB errors after device success: trigger compensating delete, set `sync_failed`
- Compensating delete errors: set `sync_dead_letter` (manual intervention required)
