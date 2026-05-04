# Tasks: fix-error-codes

## Phase 1: Foundation

- [ ] 1.1 Create `agent/src/sync/transient-error.ts` with `TransientError` enum and `isRealError` helper

## Phase 2: Core Implementation

- [ ] 2.1 Update `isRealError` at `event-sync-loop.ts:235` to use new helper
- [ ] 2.2 Update `isRealError` at `event-sync-loop.ts:460` to use new helper

## Phase 3: Verification

- [ ] 3.1 Verify TypeScript compiles (`npx tsc --noEmit` passes)