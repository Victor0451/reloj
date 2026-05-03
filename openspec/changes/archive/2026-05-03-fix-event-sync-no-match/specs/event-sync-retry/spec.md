# Spec: Event Sync NO MATCH Retry

## Purpose

When the Hikvision device event query returns `NO MATCH` with 0 events but time filters were applied, retry without time filters to capture events from the device's available history. This ensures event sync succeeds even when the queried time window has no events.

## Background

The Hikvision DS-K1T320MFWX returns `NO MATCH` when a time-filtered event query finds no events in that range, even when older events exist on the device. The previous behavior was to fall back to XML format, which the device rejects with `badJsonFormat`, causing sync to fail.

## Requirements

### Requirement: NO MATCH detection and retry

When `getEvents()` receives a response with `responseStatusStrg: "NO MATCH"`, `totalMatches: 0`, and 0 parsed events AND time filters were provided in the request, the adapter SHALL retry the query WITHOUT time filters.

#### Scenario: NO MATCH with time filters, retry succeeds

- GIVEN `getEvents()` is called with `startTime` and `endTime` set
- WHEN the device returns `{"AcsEvent":{"responseStatusStrg":"NO MATCH","totalMatches":0}}`
- THEN the adapter SHALL make a second query WITHOUT `startTime` and `endTime` parameters
- AND if the retry returns events, those events SHALL be returned to the caller

#### Scenario: NO MATCH without time filters

- GIVEN `getEvents()` is called WITHOUT time filters (both startTime and endTime are undefined)
- WHEN the device returns `{"AcsEvent":{"responseStatusStrg":"NO MATCH","totalMatches":0}}`
- THEN the adapter SHALL return an empty array (no retry needed)

#### Scenario: Normal response with events

- GIVEN `getEvents()` is called with or without time filters
- WHEN the device returns `{"AcsEvent":{"responseStatusStrg":"OK" or "MORE","totalMatches":N}}` where N > 0
- THEN the adapter SHALL return the parsed events without retrying

### Requirement: Graceful degradation on XML fallback

The XML fallback for events SHALL NOT throw an error when the device returns a non-200 status. Instead, it SHALL log a warning and return an empty array.

#### Scenario: XML fallback returns 400

- GIVEN the JSON endpoint returned NO MATCH and retry also returned no events
- WHEN the XML fallback is attempted and returns status 400
- THEN the adapter SHALL log a warning with the status code
- AND return an empty array (not throw an error)

## Implementation Details

### Flow

```
1. Call JSON endpoint with time filters
2. If status 200 and events > 0 → return events
3. If status 200 and NO MATCH and time filters present → retry without filters
4. If retry returns events → return those
5. If all else fails → try XML fallback (graceful, no throw)
6. Return events or empty array
```

### Key Code Location

`agent/src/adapters/hikvision.adapter.ts` - `getEvents()` method, around line 483-530

### Retry Request Format

Without time filters, the JSON body is:
```json
{
  "AcsEventCond": {
    "searchID": "sync_<timestamp>",
    "searchResultPosition": 0,
    "maxResults": 200,
    "major": 5,
    "minor": 38
  }
}
```

(Note: No `startTime` or `endTime` fields)

## Deduplication

The dedup logic is handled by the caller (`event-sync-loop.ts`) via the unique constraint `access_events_employee_time_device_unique`. Events that already exist in the database will fail to insert with `duplicate key` error, which is caught and counted as `skipped`.

## Test Scenarios

1. Query time range with no events → device returns NO MATCH → retry without time filters → events returned
2. Query without time filters → events returned directly (no retry)
3. Device has no events at all → empty array returned (no retry)
4. XML fallback returns 400 → graceful empty return, no error thrown