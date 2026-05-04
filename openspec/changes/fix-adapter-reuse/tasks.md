# Tasks: Fix Adapter Reuse in Event Sync Loop

## Phase 1: Core Implementation

- [ ] 1.1 Remove `adapterManager.removeAdapter(deviceId).catch(() => {});` at `agent/src/sync/event-sync-loop.ts:317`
- [ ] 1.2 Add `adapterManager.removeAdapter(deviceId).catch(() => {});` inside error catch block (after line 463), gated on `isRealError`

## Phase 2: Verification

- [ ] 2.1 Verify success path: `getAdapter()` called without preceding `removeAdapter()`
- [ ] 2.2 Verify error path: `removeAdapter()` called only when `isRealError` is true