# Tasks: Person Sync Rollback

## Phase 1: DB Schema

- [ ] 1.1 Create migration to add `device_committed` to person status enum
- [ ] 1.2 Verify migration runs against Supabase

## Phase 2: Refactor person-sync-loop.ts

- [ ] 2.1 Update `syncSinglePerson` to set `device_committed` after device success
- [ ] 2.2 Add compensating delete logic when DB update fails after device success
- [ ] 2.3 Handle compensating delete failure → mark as `sync_dead_letter`
- [ ] 2.4 Update retry logic to handle `device_committed` state
- [ ] 2.5 Final status transition from `device_committed` to `synced`

## Phase 3: Verification

- [ ] 3.1 Build passes — TypeScript compilation
- [ ] 3.2 Manual test: simulate DB failure after device success
- [ ] 3.3 Verify compensating delete is triggered correctly
- [ ] 3.4 Verify retry from `device_committed` works

## Dependencies

- D1: Phase 1 must complete before Phase 2 (migration needed)
- D2: Phase 2 can proceed once migration is applied
- D3: Phase 3 runs after Phase 2
