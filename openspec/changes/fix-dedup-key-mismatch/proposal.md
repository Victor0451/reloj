# Proposal: Fix Dedup Key Mismatch

## Intent

Unify event deduplication so the agent treats the same access event consistently across all sync paths. Today `dedup.ts` and `event-sync-loop.ts` derive different keys, which can allow duplicate inserts and duplicate person upserts.

## Scope

### In Scope
- Define one canonical event dedup key in `agent/src/sync/dedup.ts`
- Replace inline dedup logic in `agent/src/sync/event-sync-loop.ts` with `EventDeduplicator`
- Align multi-device and single-device sync paths to the same dedup behavior

### Out of Scope
- DB-level uniqueness constraints or migrations
- Changes to event fetch windows, polling cadence, or retry behavior

## Capabilities

### New Capabilities
- `event-deduplication`: Canonical identity and shared duplicate filtering for access events across sync flows

### Modified Capabilities
- None

## Approach

### Options
- **1. Match loop key**: lowest churn, but drops `major/minor` and may collapse distinct same-timestamp events.
- **2. Reuse current dedup.ts as-is**: improves reuse, but keeps string-time formatting and ignores `cardReaderNo`.
- **3. Canonical key for both**: normalize `eventTime` to epoch ms and include `employeeId`, `major`, `minor`, and `cardReaderNo`; route both sync paths through `EventDeduplicator`.

### Recommended
Choose **Option 3**. It removes duplicate logic, preserves event semantics (`major/minor`), keeps reader context, and avoids format drift between modules.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/sync/dedup.ts` | Modified | Canonical key builder and shared dedup contract |
| `agent/src/sync/event-sync-loop.ts` | Modified | Replace inline sets/keys in both sync paths |
| `agent/src/core/interfaces.ts` | Modified | Only if shared dedup typing should accept `AccessEvent` directly |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Canonical key is too broad and hides valid events | Med | Include semantic + reader fields; review against current `AccessEvent` shape |
| Canonical key is too narrow and misses duplicates | Low | Use one shared builder in both code paths |

## Rollback Plan

Revert `dedup.ts` and `event-sync-loop.ts` to the prior inline key logic. If needed, temporarily restore per-path dedup while keeping the rest of the sync loop unchanged.

## Dependencies

- No external dependencies; relies on existing `AccessEvent` fields and current in-memory dedup state.

## Success Criteria

- [ ] Both sync paths use the same shared deduplication utility
- [ ] Dedup key generation is defined in exactly one module
- [ ] Equivalent events from different paths are skipped as duplicates
- [ ] Distinct events differing by semantic or reader fields are not collapsed
