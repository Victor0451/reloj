# Tasks: Fix Device Capacity Check Before Person Sync

## Phase 1: Database Foundation

- [ ] 1.1 Create `supabase/migrations/023_add_device_capacity_status.sql` — adds `TEXT` column `device_capacity_status DEFAULT 'unknown'` with `CHECK (device_capacity_status IN ('ok', 'near_full', 'full', 'unknown'))`

## Phase 2: Adapter Error Handling

- [ ] 2.1 Read `agent/src/adapters/hikvision.adapter.ts` around line 1043 — understand existing error handling in `createPersonOnDevice`
- [ ] 2.2 Modify `createPersonOnDevice` in `agent/src/adapters/hikvision.adapter.ts` — parse HTTP 402 and return `SyncResult` with `error` containing `"device_full"`

## Phase 3: Sync Loop Dead-Letter Logic

- [ ] 3.1 Read `agent/src/sync/person-sync-loop.ts` — understand how `createPersonOnDevice` failures are currently handled
- [ ] 3.2 Modify `syncSinglePerson` in `agent/src/sync/person-sync-loop.ts` — detect `"device_full"` error, set `sync_attempts = 1` directly, update device `device_capacity_status = 'full'`

## Phase 4: Verification

- [ ] 4.1 Run `npx tsc --noEmit` — verify TypeScript compiles without errors
