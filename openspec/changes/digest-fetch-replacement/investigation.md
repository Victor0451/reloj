# Investigation: Hikvision DS-K1T320MFWX getEvents() 400 Error

## Root Cause Analysis

### Primary Issue: DS-K1T320MFWX Rejects startTime/endTime Filters

The DS-K1T320MFWX (Chinese market variant with older firmware) returns HTTP 400 with:
```json
{"statusCode":6,"statusString":"Invalid Content","subStatusCode":"badJsonContent","errorMsg":"startTime"}
```

This device rejects JSON bodies containing `startTime` or `endTime` fields in ISO 8601 format.

**Why curl worked**: Curl test used minimal body without time filters:
```bash
# curl works with this body
{"AcsEventCond":{"searchID":"1","searchResultPosition":0,"maxResults":5,"major":0,"minor":0}}
```

**Why Node.js failed**: Adapter ALWAYS included startTime/endTime (even with defaults):
```typescript
// Old code - always sent time filters
{ "startTime": "2026-04-25T04:20:09.812Z", "endTime": "2026-04-26T04:20:09.813Z" }
```

### Secondary Issue: Wrong JSON Response Path

The `parseJsonEvents()` function looked for events in wrong location:
```typescript
// WRONG - returns empty array
data?.AcsEvent?.AcsEventList?.AcsEvent

// CORRECT - returns actual events
data?.AcsEvent?.InfoList
```

Actual device response structure:
```json
{
  "AcsEvent": {
    "searchID": "sync_xxx",
    "totalMatches": 121,
    "responseStatusStrg": "MORE",
    "numOfMatches": 5,
    "InfoList": [...]  // <-- Not AcsEventList.AcsEvent
  }
}
```

---

## Fixes Applied

### Fix 1: Make time filters conditional (line ~401-420)

**Before**: Always included startTime/endTime in request body
**After**: Only include when caller explicitly provides both

```typescript
const hasTimeFilter = options?.startTime !== undefined && options?.endTime !== undefined;

const acsEventCond: Record<string, unknown> = {
  searchID: `sync_${Date.now()}`,
  searchResultPosition: 0,
  maxResults: Math.min(maxResults, 200),
  major: 0,
  minor: 0,
};

// Only add time filters when caller explicitly requests them
if (hasTimeFilter) {
  acsEventCond.startTime = startTime.toISOString();
  acsEventCond.endTime = endTime.toISOString();
}
```

### Fix 2: Correct parseJsonEvents response path (line ~487)

**Before**: `data?.AcsEvent?.AcsEventList?.AcsEvent || []`
**After**: `data?.AcsEvent?.InfoList || []`

### Fix 3: Handle string verification modes (line ~766-800)

**Before**: Only handled numeric codes
**After**: Handles both string ("invalid", "cardOrFaceOrFp") and numeric codes

---

## Verification

```bash
cd /home/vlongo/Projects/reloj/agent

# Test getEvents
npx tsx -e "
import { HikvisionAdapter } from './src/adapters/hikvision.adapter'
const adapter = new HikvisionAdapter({
  ip: '192.168.100.60',
  port: 443,
  username: 'admin',
  password: 'evol@2601',
  rejectUnauthorized: false
})
async function test() {
  const events = await adapter.getEvents({ maxResults: 5 })
  console.log('Events:', events.length)
}
test().catch(e => console.error(e.message))
"
```

**Result**: ✅ `Events: 5` (previously 0 due to wrong path + 400 due to time filters)

---

## Checklist

- [x] `npm run typecheck` passes
- [x] `getEvents({ maxResults: 5 })` returns 5 events (not empty, not error)
- [x] Response parsing uses correct `InfoList` path
- [x] `healthCheck()` still works (regression check)
- [x] Debug script removed

---

## Status

| Issue | Root Cause | Fix |
|-------|------------|-----|
| getEvents() returns 400 | Device rejects startTime/endTime | ✅ Conditional inclusion |
| Parser returns empty events | Wrong path `AcsEventList.AcsEvent` vs `InfoList` | ✅ Corrected |
| verifyMode type mismatch | Device returns strings, code expected numbers | ✅ Extended to handle strings |

**Next**: Update tasks.md in digest-fetch-replacement change to mark verification complete.