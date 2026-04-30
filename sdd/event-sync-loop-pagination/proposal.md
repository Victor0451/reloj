# Proposal: event-sync-loop-pagination

## Intent

Fix the Hikvision adapter's event sync loop so it fetches ALL events from the device's circular buffer — not just the oldest ~30. Currently, `searchResultPosition: 0` is hardcoded and `responseStatusStrg: "MORE"` is ignored, causing the agent to repeatedly fetch stale events while new ones (serialNo 203, 215, 219, 222 from 2026-04-27) remain unreachable.

## Scope

### In Scope
- Implement ISAPI pagination loop in `HikvisionAdapter.getEvents()` — accumulate pages while `responseStatusStrg === "MORE"`, advancing `searchResultPosition += numOfMatches` each iteration
- Fix `startSingleDeviceEventSync()` to pass BOTH `startTime` AND `endTime` to the adapter, activating the time filter

### Out of Scope
- DB persistence of `lastSyncTime` (future improvement)
- `serialNo`-based query (device doesn't support it)
- Supabase schema or RLS changes

## Capabilities

### New Capabilities
- **event-pagination**: Adapter fetches all pages from device in a single `getEvents()` call, returning the complete event array

### Modified Capabilities
- None (fixes existing behavior, no new spec-level requirements)

## Approach

**Primary**: Implement pagination loop in `HikvisionAdapter.getEvents()`:
```
1. Set position = 0, allEvents = []
2. Loop:
   a. Call ISAPI searchEvents with current position
   b. Append InfoList to allEvents
   c. If responseStatusStrg !== "MORE" → break
   d. position += numOfMatches
3. Return allEvents
```

**Secondary**: `event-sync-loop.ts` passes `Date.now()` as `endTime` alongside `lastSyncTime` as `startTime`, so adapter can apply time filter when both are present.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/adapters/hikvision.adapter.ts` | Modified | Add pagination loop in `getEvents()`; update return type to include all accumulated events |
| `agent/src/sync/event-sync-loop.ts` | Modified | Pass `endTime` alongside `startTime` in `adapter.getEvents()` call |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `getEvents()` signature change — returns accumulated events, not single page | Low | Adapter is internal to agent; no external consumers |
| Breaking time filter behavior if endTime not provided | Low | Time filter only activates when BOTH startTime AND endTime are set; existing callers without endTime will continue to work as before (no filter) |

## Rollback Plan

1. Revert `hikvision.adapter.ts` to remove pagination loop (restore single request with `searchResultPosition: 0`)
2. Revert `event-sync-loop.ts` to pass only `startTime`
3. Deploy and verify sync cycles resume single-page behavior

## Dependencies

- Hikvision ISAPI docs (`docs/implementacion_hikvision_nextjs_api.md:900-938`) — pagination pattern already documented
- No external dependencies

## Success Criteria

- [ ] Agent fetches ALL 35 events from device in one sync cycle (verify via logs)
- [ ] New events (serialNo 203, 215, 219, 222 from 2026-04-27) appear in Supabase `access_events` table
- [ ] No duplicate key violations on `eventId` (dedup by serialNo works correctly)
- [ ] `syncStatus` shows "synced" after each cycle