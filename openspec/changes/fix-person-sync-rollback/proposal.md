# Proposal: Person Sync Rollback

## Problem

Person sync flow in `person-sync-loop.ts` has no transactional boundary:

1. Sync person to device (device API call)
2. Update DB record with new status

If step 2 fails (DB/Supabase error), the device already has the person but DB doesn't know → **desync**.

## Intent

Add rollback/compensation mechanism so that if DB update fails after device sync, the device change is undone (or retry is tracked) to maintain consistency.

## Approach Options

### Option A: Compensating Delete
If DB update fails after device sync succeeds → delete the person from device.
- Simple, keeps device and DB in sync
- Risk: person data lost on device if delete fails too

### Option B: Device-Committed State
Introduce a `device_committed` status:
1. Sync to device → mark as `device_committed`
2. Update DB → mark as `synced`
3. If DB fails → retry from `device_committed` state
- Clear state machine, but requires DB schema change

### Option C: Outbox Pattern
Write to an outbox table first, then process:
1. Insert to outbox (DB)
2. Sync to device
3. Mark outbox processed / delete from outbox
4. If step 2/3 fails → outbox stays, retry picks it up
- Most robust, but complex

## Recommended: Option B (Device-Committed State)

Clean state machine, leverages existing status enum, no delete/retry complexity.

## Scope

- `agent/src/sync/person-sync-loop.ts` — add device_committed status and compensation logic
- DB schema may need migration for new status value
- `syncSinglePerson` function refactored

## Risks

- Adding new status requires DB migration
- If device_committed state persists and device is later unreachable, person stays "committed but not synced" indefinitely

## Rollback

If deployment fails, revert to current behavior (no rollback, partial sync possible).
