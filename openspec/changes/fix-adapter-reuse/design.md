# Design: Fix Adapter Reuse in Event Sync Loop

## Technical Approach

The issue is that `startSingleDeviceEventSync` destroys and recreates the Hikvision adapter on every sync cycle (line 317), even when the device is healthy. This wastes connections and slows sync. The fix removes the unconditional `removeAdapter` call on success and adds `removeAdapter` inside the error catch block to evict only failed adapters.

## Architecture Decisions

### Decision: Reuse adapter on successful sync

**Choice**: Remove line 317 `adapterManager.removeAdapter(deviceId).catch(() => {});` from the success path
**Alternatives considered**: Conditional removal based on error count, leaving adapter removal unconditional
**Rationale**: Adapter already caches itself; destroying it on every cycle is redundant and slow

### Decision: Evict adapter only on real errors

**Choice**: Move `removeAdapter` into the error catch block, guarded by `isRealError` check
**Alternatives considered**: Always remove on any error, never remove on error
**Rationale**: Auth failures (401) need fresh adapter with new credentials; "not available" is transient — keep cached

## Data Flow

**Before (every cycle):**
```
sync → 5s delay → removeAdapter() → 1s delay → getAdapter() → fetch → destroy → repeat
```

**After — success path:**
```
sync → circuit check → 5s delay → getAdapter() (reuses cached) → fetch → done (no remove)
```

**After — error path:**
```
sync → circuit check → 5s delay → getAdapter() → fetch → ERROR → removeAdapter() → mark error
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/sync/event-sync-loop.ts` | Modify | Remove line 317 unconditional removeAdapter; add removeAdapter in error catch (lines 459-477) |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | isRealError classification | Verify "not available" stays cached, 401 removes adapter |
| Integration | Success path reuses adapter | Confirm getAdapter called without preceding removeAdapter |

## Migration / Rollout

No migration required. This is a behavioral fix — no schema or data changes.

## Open Questions

None — the error classification pattern (`isRealError`) already exists and matches the spec reference.