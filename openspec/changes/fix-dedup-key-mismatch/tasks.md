# Tasks: Fix Dedup Key Mismatch

## Phase 1: Update dedup.ts to use canonical key

- [ ] 1.1 Redefine `createDedupKey(event)` in `agent/src/sync/dedup.ts` to use canonical key format: `employeeId|<unix-ms>|<cardReaderNo-or-0>`
- [ ] 1.2 Update `EventDeduplicator` to accept the new `DedupEventLike` contract
- [ ] 1.3 Ensure timestamp normalization handles both `Date` and ISO string inputs
- [ ] 1.4 Verify `EventDeduplicator` eviction logic still works correctly

## Phase 2: Replace inline dedup in event-sync-loop.ts

- [ ] 2.1 Remove inline `Set<string>` and dedup key building from event-sync-loop.ts
- [ ] 2.2 Import and use shared `EventDeduplicator` from dedup.ts
- [ ] 2.3 Update both sync modes (single-device and multi-device) to use shared class
- [ ] 2.4 Verify the sync loop behavior is unchanged (events not duplicated)

## Phase 3: Add tests

- [ ] 3.1 Create `agent/src/sync/dedup.test.ts` with tests for canonical key generation
- [ ] 3.2 Add tests for duplicate detection with different `cardReaderNo` values
- [ ] 3.3 Add tests for timestamp normalization (Date vs ISO string)
- [ ] 3.4 Update `agent/package.json` test script if needed

## Phase 4: Verification

- [ ] 4.1 Run `npm run build` — verify TypeScript passes
- [ ] 4.2 Run tests — verify dedup tests pass
- [ ] 4.3 Manual verification — check that event sync doesn't duplicate events

## Dependencies

- D1: Phase 1 must complete before Phase 2 (dedup.ts must have correct key before event-sync-loop.ts uses it)
- D2: Phase 2 must complete before Phase 3 (integration tests depend on the updated class)
- D3: Phase 3 can run in parallel with Phase 4 after Phase 2 is done
