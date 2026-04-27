# Design: digest-fetch-replacement

## Technical Approach

Replace the custom `doDigestRequest` / `generateDigestAuth` implementation in `hikvision.adapter.ts` with the `digest-fetch` v2 library already present in `agent/package.json`. The `digestRequest()` wrapper (retry logic, timeout, signature) is preserved — only the underlying HTTP transport changes.

## Architecture Decisions

### Decision: digest-fetch over got / node-fetch + custom digest

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `digest-fetch` v2 | Battle-tested RFC 2617 Digest auth, ~50K weekly downloads, drop-in `DigestFetch` class | **Chosen** — already in package.json |
| `got` with digest | Heavier bundle, not purpose-built for digest auth | Rejected — overkill |
| `node-fetch` + manual digest | Same as current, requires custom 401 handling | Rejected — same problem |
| `axios` with digest | Adds significant bundle size, axios interceptors complex | Rejected — unnecessary dependency |

### Decision: Keep `digestRequest()` wrapper signature unchanged

**Choice**: Maintain `digestRequest(url, username, password, method, body?, contentType?, rejectUnauthorized?, timeoutMs?, retryCount?)` as the public API.

**Rationale**: Zero caller changes. All existing calls in `HikvisionAdapter` pass through `digestRequest` — they remain untouched.

### Decision: `rejectUnauthorized: false` for self-signed cert on 192.168.100.60

**Choice**: Pass `rejectUnauthorized: false` via the existing `config.rejectUnauthorized` mechanism.

**Rationale**: Cert on `192.168.100.60` expired Nov 2023. Hikvision devices on internal LAN justify disabling cert verification. Default remains `true` for secure-by-default.

## Data Flow

```
digestRequest(url, u, p, method, body?, contentType?, rejectUnauthorized?, timeoutMs?, retryCount?)
    │
    ├── Retry loop (attempt <= retryCount)
    │   └── doDigestRequest(...)          [TO BE REPLACED]
    │       └── makeRequest() via http(s).request
    │           └── Manual 401+Digest handling + generateDigestAuth() [TO BE REPLACED]
    │
    └── Return { status, body }

──becomes──

DigestFetch(username, password, { internal: true })
    │
    └── fetch(url, { method, body, headers: { "Content-Type" }, agent: httpsAgent })
        └── Auto 401 challenge-response handled internally by digest-fetch
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/adapters/hikvision.adapter.ts` | Modify | Replace `doDigestRequest` / `generateDigestAuth` with `DigestFetch` class |
| `agent/package.json` | — | No change — `digest-fetch@^2.0.0` already present |
| `agent/src/adapters/hikvision.adapter.ts` | Comment | Keep legacy `doDigestRequest`/`generateDigestAuth` as `digestRequestLegacy` for rollback |

## Implementation Detail

### Before / After: `digestRequest` function signature

**Before** (lines 66–108):
```typescript
async function digestRequest(
  url: string,
  username: string,
  password: string,
  method: string = "GET",
  body?: string,
  contentType?: string,
  rejectUnauthorized?: boolean,
  timeoutMs?: number,
  retryCount?: number
): Promise<{ status: number; body: string }> {
  // Calls doDigestRequest() with manual http.request + generateDigestAuth()
}
```

**After** (unchanged — same signature):
```typescript
async function digestRequest(
  url: string,
  username: string,
  password: string,
  method: string = "GET",
  body?: string,
  contentType?: string,
  rejectUnauthorized?: boolean,
  timeoutMs?: number,
  retryCount?: number
): Promise<{ status: number; body: string }> {
  // Calls DigestFetch-based implementation instead
}
```

### Before / After: `doDigestRequest` replacement

**Before** (lines 110–188 + 190–220): ~120 lines of raw Node.js `http.request`, manual 401 handling, MD5 digest calculation via `crypto`.

**After** (new implementation):
```typescript
import DigestFetch from "digest-fetch";

async function doDigestRequest(
  url: string,
  username: string,
  password: string,
  method: string,
  body?: string,
  contentType?: string,
  rejectUnauthorized?: boolean,
  timeoutMs?: number
): Promise<{ status: number; body: string }> {
  const effectiveContentType = contentType ?? "application/xml; charset=utf-8";
  const effectiveRejectUnauthorized = rejectUnauthorized ?? true;
  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Build HTTPS agent with rejectUnauthorized option
  const agent = isHttps
    ? new https.Agent({ rejectUnauthorized: effectiveRejectUnauthorized, timeout: effectiveTimeoutMs })
    : undefined;

  const client = new DigestFetch(username, password, {
    internal: true,           // Use internal _getDigestAuthHeaders() approach
    agent,
  });

  const headers: Record<string, string> = { "Content-Type": effectiveContentType };
  const response = await client.fetch(url, { method, body, headers });

  const data = await response.text();
  return { status: response.status, body: data };
}
```

### HTTPS rejection handling

```typescript
const agent = isHttps
  ? new https.Agent({ rejectUnauthorized: effectiveRejectUnauthorized, timeout: effectiveTimeoutMs })
  : undefined;
// Pass agent to DigestFetch options → TLS handshake allows self-signed cert
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `digestRequest` returns `{ status, body }` | Mock `DigestFetch.fetch` with known response |
| Integration | `healthCheck()` on 192.168.100.60 | Live request — expect `{ reachable: true }` |
| Integration | `getEvents()` on 192.168.100.60 | Live request — expect `AccessEvent[]` (can be empty) |

**Manual validation commands** (target device `192.168.100.60`):
```bash
cd agent && npm run typecheck
# Then manually:
# - healthCheck() → reachable: true, no socket hang up
# - getEvents() → returns array, no socket hang up
```

## Rollback Plan

1. **Comment out** new `doDigestRequest`, **uncomment** old `doDigestRequest` + `generateDigestAuth`
2. Remove `DigestFetch` import
3. Rollback is a 2-minute swap — same interface

**No migration required** — state is not stored; this is a drop-in HTTP transport replacement.

## Open Questions

- [ ] None — spec defines all requirements clearly

## Relevant Files

- `agent/src/adapters/hikvision.adapter.ts` — the file being modified
- `agent/package.json` — already has `digest-fetch@^2.0.0` (no changes needed)
