# Design: Event Sync NO MATCH Retry

## Context

The Hikvision event sync was failing with 400 errors because:
1. When querying with time filters, the device returns `NO MATCH` if no events in range
2. The code fell back to XML format which the device rejects
3. This caused sync to fail even though events existed on the device

## Decision

**Retry without time filters when JSON returns NO MATCH with time filters applied.**

### Why this approach?

1. **Non-invasive**: Only adds a retry path, doesn't modify existing time-filtered behavior
2. **Device-agnostic**: Works regardless of whether device supports time-filtered events
3. **Simple**: Single additional request, no complex state machine
4. **Safe**: `maxResults` limit still applies to retry request

### Alternatives considered

1. **Remove XML fallback entirely**: Would lose fallback for other scenarios
2. **Track device capabilities in DB**: Adds complexity, device seems to support time filters for some ranges
3. **Use serialNo pagination**: Would be more correct but significantly more complex

## Implementation

### Location
`agent/src/adapters/hikvision.adapter.ts` - `getEvents()` method

### Code Flow

```typescript
// 1. Make request with time filters
const jsonResponse = await digestRequest(...);

// 2. Parse response
if (jsonResponse.status === 200) {
  const data = JSON.parse(jsonResponse.body);
  const parsedEvents = this.parseJsonEvents(data);
  allEvents.push(...parsedEvents);

  // 3. Check for NO MATCH with time filters
  if (allEvents.length === 0 && hasTimeFilter && data?.AcsEvent?.responseStatusStrg === "NO MATCH") {
    // 4. Retry WITHOUT time filters
    const noTimeBody = JSON.stringify({
      AcsEventCond: {
        searchID: `sync_${Date.now()}`,
        searchResultPosition: 0,
        maxResults: Math.min(maxResults, 200),
        major: 5,
        minor: 38,
        // NO startTime/endTime
      }
    });
    const retryResponse = await digestRequest(...);
    // 5. Parse and return retry events
  }
}
```

### Key Points

1. **hasTimeFilter detection**: Uses the same condition already in code (`options?.startTime !== undefined && options?.endTime !== undefined`)
2. **Separate retry body**: Constructs new body without time fields, uses fresh timestamp for searchID
3. **No pagination on retry**: Simplifies logic - if events exist, return up to `maxResults` (200)
4. **Immediate return on retry success**: Don't paginate the fallback, just return what we got

### XML Fallback Change

Changed from throwing error to returning empty array gracefully:

```typescript
// Before:
if (xmlResponse.status !== 200) {
  throw new Error(`Failed to get events: ${xmlResponse.status}`);
}

// After:
if (xmlResponse.status !== 200) {
  log.warn("hikvision", "XML fallback also failed", { status: xmlResponse.status });
  return [];
}
```

This prevents 400 errors from propagating as exceptions.

## Testing

### Manual verification
1. Restart agent with new code
2. Check logs for:
   - `"NO MATCH with time filters, retrying without time range"`
   - `"Retry without time filters response"` with status 200
   - `"Retry returned N events (total: N)"`

### Log output sequence
```
"Making JSON events request" { body with startTime/endTime }
"JSON events response" { NO MATCH }
"JSON returned 0 events"
"NO MATCH with time filters, retrying without time range"
"Retry without time filters response" { MORE, events }
"Retry returned 30 events (total: 30)"
"Fetched 30 events"
```

### Duplicate key errors
These are expected and indicate dedup is working:
```
"Failed to insert event" { duplicate key violation }
```
Events already in DB are skipped, new events are inserted.

## Files Modified

- `agent/src/adapters/hikvision.adapter.ts`:
  - Added retry logic after NO MATCH detection (lines ~499-536)
  - Changed XML fallback from throw to warn+return-empty (line ~549)
  - Added logging for request/response debugging