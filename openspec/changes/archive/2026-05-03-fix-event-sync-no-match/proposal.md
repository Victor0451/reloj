# Proposal: Fix Event Sync NO MATCH Error

## Summary

When event sync queries the Hikvision device with a time filter, it returns `NO MATCH` if no events exist in that range, even when older events are available on the device. The code then falls back to XML format which the device rejects with `badJsonFormat`, causing the sync to fail with a 400 error.

## Problem

1. **NO MATCH on time-filtered queries**: The Hikvision DS-K1T320MFWX returns `{"AcsEvent":{"responseStatusStrg":"NO MATCH","totalMatches":0}}` when querying a time range with no events, even if older events exist on the device.

2. **XML fallback causes 400 error**: When JSON returns NO MATCH, the code falls back to XML format (`/ISAPI/AccessControl/AcsEvent` without `?format=json`). The device rejects this with `badJsonFormat: Invalid Format`.

3. **Events not synced**: The device has events from April 26 but the query looks for events from the last 24 hours (May 2-3) → NO MATCH → 400 → no events synced.

## Investigation

### Root Cause
The `lastSyncTime` in `startSingleDeviceEventSync` defaults to 24 hours ago. When the device has no events in that range but has older events, the JSON returns `NO MATCH` and the code falls back to XML which the device doesn't support for events.

### Device Behavior
- **JSON endpoint** (`/ISAPI/AccessControl/AcsEvent?format=json`): Works correctly, returns events when available, returns `NO MATCH` when no events in range
- **XML endpoint** (`/ISAPI/AccessControl/AcsEvent`): Returns `badJsonFormat` - device doesn't support XML for event queries

### Confirmed via curl tests
```bash
# With time filters (no events in range) → NO MATCH
curl -X POST -d '{"AcsEventCond":{...,"startTime":"2026-05-02T00:00:00-03:00","endTime":"2026-05-03T00:00:00-03:00"}}'
# Response: {"AcsEvent":{"responseStatusStrg":"NO MATCH","totalMatches":0}}

# Without time filters → MORE (events available)
curl -X POST -d '{"AcsEventCond":{...}}'
# Response: {"AcsEvent":{"responseStatusStrg":"MORE","totalMatches":39}}
```

## Solution

When JSON returns `NO MATCH` with 0 events AND time filters were applied, retry the query WITHOUT time filters to capture events from the device's available history.

### Implementation
- In `HikvisionAdapter.getEvents()`, after getting `NO MATCH` response with time filters
- Make a second request without `startTime`/`endTime` parameters
- If retry returns events, use those instead
- This handles devices that return `NO MATCH` for empty ranges but have older events available

### Why this approach?
- Non-invasive: only affects the retry path, not the normal flow
- Fallback gracefully: doesn't break existing behavior for devices that DO support time filtering
- Simple: no need to track which devices support time filters

## Scope

**Files to modify**:
- `agent/src/adapters/hikvision.adapter.ts` - Add NO MATCH retry logic in `getEvents()`

**No database migrations needed**: This is a code fix only.

## Expected Outcome

- Event sync successfully retrieves events from device when time-filtered query returns NO MATCH
- Events stored in `access_events` table with deduplication (already handled by existing unique constraint)
- No 400 errors from XML fallback when JSON returns NO MATCH

## Risks

- **Low**: Retry without time filters may return large event sets from devices with long history. Mitigated by `maxResults` limit (200) which is already in place.
- **Low**: Events older than expected may be synced on first run. This is actually desirable - catches up on missed events.

## Rollback Plan

If the retry causes issues, add a device capability flag `supportsTimeFilteredEvents: boolean` to the database and skip the retry for devices that return NO MATCH but have the capability. However, based on testing, all events have `attendanceStatus` eventually, so time filtering is unlikely to be a device capability difference.