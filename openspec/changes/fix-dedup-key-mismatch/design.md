# Design: Fix Dedup Key Mismatch

## Technical Approach

Make `agent/src/sync/dedup.ts` the single source of truth for runtime event deduplication, then replace both inline `Set<string>` implementations in `event-sync-loop.ts` with shared `EventDeduplicator` instances. The canonical key will preserve the current production behavior from the sync loops, not the stale shape in `dedup.ts`.

## Architecture Decisions

### Decision: Canonical dedup key

| Option | Tradeoff | Decision |
|---|---|---|
| `employeeId|eventTime|major|minor` | Matches current helper, but diverges from live sync behavior and ignores multi-reader collisions | Rejected |
| `employeeId|eventTimeMs|cardReaderNo` | Matches deployed loop logic and changelog intent; requires timestamp normalization | **Chosen** |

**Choice**: `employeeId|<unix-ms>|<cardReaderNo-or-0>`.
**Rationale**: `cardReaderNo` is already the documented differentiator for multi-reader devices, while `major/minor` are not part of the active loop behavior. Normalizing `eventTime` to epoch milliseconds removes `Date` vs ISO-string mismatches and keeps one stable key format across callers.

### Decision: Keep the shared class

| Option | Tradeoff | Decision |
|---|---|---|
| Delete `EventDeduplicator` and keep inline sets | Less refactor, but logic stays duplicated and can drift again | Rejected |
| Reuse `EventDeduplicator` everywhere | One policy, one eviction strategy, one test surface | **Chosen** |

**Choice**: keep `EventDeduplicator` and make sync loops depend on it.
**Rationale**: the bug exists because the helper and the loops evolved separately. Centralizing key creation and cache trimming in one module removes that failure mode.

## Data Flow

```text
adapter.getEvents()
  -> event-sync-loop.ts
    -> EventDeduplicator.isDuplicate(event)
      -> createDedupKey(event)
        -> normalize eventTime + cardReaderNo
    -> insert only non-duplicates into access_events
```

Multi-device mode keeps one `EventDeduplicator` per device in `deviceStates`. Single-device mode keeps one instance for that loop.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/sync/dedup.ts` | Modify | Redefine the canonical key shape around `employeeId`, normalized `eventTime`, and optional `cardReaderNo`; keep eviction logic inside `EventDeduplicator`. |
| `agent/src/sync/event-sync-loop.ts` | Modify | Replace inline string building and raw `Set` management with shared `EventDeduplicator` instances in both sync modes. |
| `agent/src/sync/dedup.test.ts` | Create | Add focused tests for canonical key generation, duplicate detection, and parity with sync-loop usage. |
| `agent/package.json` | Modify | Replace placeholder test script with a minimal Node test command using existing `tsx` support. |

## Interfaces / Contracts

```ts
type DedupEventLike = {
  employeeId: string;
  eventTime: Date | string;
  cardReaderNo?: number | null;
};
```

`createDedupKey(input)` will accept this shape and return the canonical string. `EventDeduplicator.isDuplicate(input)` will use the same contract, so `AccessEvent` instances can be passed directly without loop-specific mapping.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Canonical key generation | Assert same output for `Date` and ISO string inputs; assert missing `cardReaderNo` becomes `0`. |
| Unit | Duplicate tracking | Repeated equivalent events return `true` on second call; distinct `cardReaderNo` values remain unique. |
| Integration-ish | Loop consistency | Exercise the dedup path used by both sync loops through `EventDeduplicator` inputs matching real `AccessEvent` objects. |
| Tooling | Test execution | Use Node 20 built-in `node:test` with `tsx` (`node --import tsx --test`) to avoid adding a new framework. |

## Migration / Rollout

No migration required. This is an in-memory runtime behavior fix; database schema and stored event rows remain unchanged.

## Open Questions

- [ ] Proposal/spec artifacts for this change were not present in Engram or the expected OpenSpec files; implementation should proceed from issue #28 unless those artifacts are added later.
