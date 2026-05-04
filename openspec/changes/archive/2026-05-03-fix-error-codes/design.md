# Design: Fix Error Filtering Uses Fragile String Matching

## Technical Approach

Replace the fragile `errorMessage.includes("not available")` string matching in `event-sync-loop.ts` with a type-safe `isRealError()` helper that uses a `TransientError` enum and `IsapiError.statusCode` inspection.

## Architecture Decisions

### Decision: New shared errors module

**Choice**: Create `agent/src/sync/transient-error.ts` with `TransientError` enum and `isRealError()` helper
**Alternatives considered**: Adding to `isapi/client.ts`, using a class hierarchy, patching inline
**Rationale**: Keeps error classification centralized and testable; avoids coupling sync logic to ISAPI module

### Decision: Enum values match device error codes

**Choice**: Lowercase string values (`notAvailable`, `deviceBusy`) matching device responses
**Alternatives considered**: TypeScript const objects, numeric codes, class instances
**Rationale**: Device ISAPI responses use lowercase codes; direct mapping avoids transformation overhead

### Decision: Conservative fallback for generic errors

**Choice**: Generic `Error` instances (non-IsapiError) return `true` from `isRealError()`
**Alternatives considered**: Returning `false` (optimistic), logging and treating as unknown
**Rationale**: False positives (retrying real failures) are worse than false negatives; we want devices marked errored when uncertain

## Data Flow

```
Device Error Response
        │
        ▼
┌───────────────────┐
│ IsapiError?       │──No──→ return true (generic Error = real error)
└───────────────────┘
        │yes
        ▼
┌───────────────────┐
│ statusCode 401?   │──Yes──→ return true (auth failure = real error)
└───────────────────┘
        │no
        ▼
┌───────────────────┐
│ code in enum?     │──Yes──→ return false (transient = not real error)
└───────────────────┘
        │no
        ▼
   return true (unknown IsapiError = real error, conservative)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/sync/transient-error.ts` | Create | `TransientError` enum + `isRealError()` helper |
| `agent/src/sync/event-sync-loop.ts` | Modify | Lines 235 and 460 — replace string match with `isRealError(err)` |

## Interface: TransientError Enum

```typescript
export enum TransientError {
  NOT_AVAILABLE = 'notAvailable',
  DEVICE_BUSY = 'deviceBusy',
  NO_MATCH = 'noMatch',
  MORE_DATA = 'moreData',
}
```

## Interface: isRealError Function

```typescript
import { IsapiError } from '../isapi/client';

export function isRealError(error: unknown): boolean {
  // HTTP auth failures — always fatal, never transient
  if (error instanceof IsapiError && error.statusCode === 401) {
    return true;
  }
  // Transient device errors — not real errors
  if (error instanceof IsapiError) {
    return !Object.values(TransientError).includes(error.code as TransientError);
  }
  // Fallback for generic errors — be conservative
  return true;
}
```

## Classification Logic

| Condition | Result | Reason |
|-----------|--------|--------|
| `IsapiError` + `statusCode === 401` | Real error | Auth failure needs attention |
| `IsapiError` + `code` in `TransientError` | Not real error | Device transient, retry allowed |
| `IsapiError` + other `statusCode` | Real error | Unknown IsapiError, conservative |
| Generic `Error` | Real error | Unknown source, conservative |

## Edge Cases

1. **Real error message contains "not available"** → No longer misclassified (good). The enum check uses `error.code`, not message substring.

2. **New device error code appears** → Add to `TransientError` enum. No string patching required.

3. **Network timeout (not IsapiError)** → Treated as real error, conservative fallback kicks in.

4. **HTTP 500-503 from device** → Treated as real error. Circuit breaker handles retry logic separately.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `isRealError()` classification | Test each enum value, 401, generic Error |
| Unit | Real error with "not available" in message | Ensure not falsely classified as transient |
| Integration | Both sync loops use new helper | Confirm lines 235 and 460 call `isRealError(err)` |

## Migration / Rollout

No migration required. This is a refactoring — same behavior, better implementation.

## Open Questions

None.