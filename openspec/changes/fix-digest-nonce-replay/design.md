# Design: Fix Digest Auth Nonce Replay Vulnerability

## Context

The Hikvision ISAPI adapter's `doDigestRequest()` function (line 174) uses the `digest-fetch` library for HTTP Digest authentication. On receiving a 401, it parses the `WWW-Authenticate` header via `client.parseAuth()` and then makes an authenticated request. **No nonce tracking exists** — an attacker who captures a 401 response with its Authorization header can replay it within the device's nonce validity window.

## Technical Approach

Add an in-memory `Set<string>` at module level to track recently used nonces. Before making the authenticated request after a 401, validate the nonce against this set. Reject replays with a 401 response. Prune oldest 50% of entries when the set exceeds 1000 entries.

## Architecture Decisions

### Decision: Module-level nonce tracker (not class-level)

**Choice**: Module-level `Set<string>` in `hikvision.adapter.ts`
**Alternatives considered**: Instance-level on `HikvisionAdapter`, external singleton service
**Rationale**: Nonces are server-side artifacts tied to the device, not per-connection. Single-threaded Node.js means Set operations are atomic. Module-level is simplest and matches the spec requirement.

### Decision: Eager pruning on insert (not background timer)

**Choice**: Prune oldest 50% when `recentNonces.size >= MAX_NONCE_ENTRIES` before adding new nonce
**Alternatives considered**: Periodic `setInterval` timer, lazy pruning on read
**Rationale**: Eager pruning keeps memory bounded at exactly the threshold. No timer overhead, no memory buildup between checks. The O(n) conversion to array is acceptable (runs once per 1000 nonces).

### Decision: Nonce extraction via regex from wwwAuth string

**Choice**: Parse `nonce="([^"]+)"` from the raw `wwwAuth` header string
**Alternatives considered**: Access internal `client.digest.nc` or similar, expose nonce from digest-fetch
**Rationale**: `digest-fetch` doesn't expose the parsed nonce as a property. The wwwAuth header is already available at line 208. Regex extraction is reliable and avoids coupling to library internals.

## Data Flow

```
doDigestRequest()
    │
    ├─► nodeFetch(url) → 401
    │
    ├─► wwwAuth = headers.get("www-authenticate")
    │
    ├─► client.parseAuth(wwwAuth)
    │
    ├─► extract nonce from wwwAuth via regex
    │
    ├─► isNonceValid(nonce)?
    │       │
    │       ├─► nonce in recentNonces? → return {status: 401, body: "Nonce replay detected"}
    │       │
    │       ├─► size >= 1000? → prune oldest 50%
    │       │
    │       └─► add nonce to recentNonces, return true
    │
    └─► client.addAuth(url, ...) → authenticated request
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/adapters/hikvision.adapter.ts` | Modify | Add nonce tracker module-level (after line 75), integrate validation in `doDigestRequest()` (after line 210) |

## Implementation Details

### Module-level constants and nonce tracker (after line 75)

```typescript
// ─── Nonce Replay Prevention ─────────────────────────────────────────────────

const recentNonces = new Set<string>();
const MAX_NONCE_ENTRIES = 1000;
const PRUNE_BATCH_RATIO = 0.5;

function isNonceValid(nonce: string): boolean {
  if (recentNonces.has(nonce)) {
    return false; // Replay detected
  }

  // Prune if at or above threshold
  if (recentNonces.size >= MAX_NONCE_ENTRIES) {
    const pruneCount = Math.floor(recentNonces.size * PRUNE_BATCH_RATIO);
    const entries = Array.from(recentNonces);
    entries.slice(0, pruneCount).forEach(n => recentNonces.delete(n));
  }

  recentNonces.add(nonce);
  return true;
}

function extractNonceFromWwwAuth(wwwAuth: string): string | null {
  const match = wwwAuth.match(/nonce="([^"]+)"/);
  return match ? match[1] : null;
}
```

### Integration in doDigestRequest() (after line 210)

```typescript
if (wwwAuth && wwwAuth.startsWith("Digest ") && !client.hasAuth) {
  client.parseAuth(wwwAuth);

  // Nonce replay prevention
  const nonce = extractNonceFromWwwAuth(wwwAuth);
  if (nonce && !isNonceValid(nonce)) {
    return { status: 401, body: "Nonce replay detected" };
  }

  // Make authenticated request with digest auth header
  const authOptions = client.addAuth(url, { method, body, headers });
  const authResp = await nodeFetch(url, { ...authOptions, agent });
  client.digest.nc++;
  return { status: authResp.status, body: await authResp.text() };
}
```

## Error Response Format

On replay detection, `doDigestRequest()` returns:

```typescript
{ status: 401, body: "Nonce replay detected" }
```

This is a well-formed response matching the function's return type `{status: number; body: string}`. The caller (`digestRequest()` wrapper) will receive this as any other 401, which may trigger retry behavior — but since the nonce is already marked as used, subsequent retries will also fail the nonce check. This is acceptable behavior indicating a potential attack.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `isNonceValid()` logic | Test fresh nonce → added, replay → rejected, pruning at threshold |
| Unit | `extractNonceFromWwwAuth()` | Test various Digest header formats |
| Integration | Replay rejection | Call `doDigestRequest()` twice with same nonce, verify second returns 401 |

## Open Questions

- None — all decisions documented above match the proposal and spec.

## Next Step

Ready for tasks (sdd-tasks).