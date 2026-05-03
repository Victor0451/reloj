# Design: fix-device-refresh-api

## 1. Technical Approach

The fix secures the `/api/devices/refresh` endpoint by:
1. Adding Bearer token authentication using `CRON_AUTH_TOKEN` env var
2. Using `createAdminClient()` from `@/lib/supabase/admin` instead of anon key client
3. Selecting only safe fields: `id, device_name, device_type, status, last_seen_at, created_at`
4. Using constant-time comparison (`timingSafeEqual`) to prevent timing attacks

## 2. Architecture Decisions

### Decision 1: Bearer token pattern vs session auth

**What we chose**: Bearer token validation via `Authorization: Bearer <token>` header, matching the pattern used by `/api/check-connectivity`.

**Alternatives considered**:
- Session-based auth with cookies — overkill for machine-to-machine API calls
- OAuth2 with client credentials — adds complexity; this is internal cron job API

**Rationale**: Simple, proven pattern already in use. Token stored in env var, checked on each request.

### Decision 2: Timing-safe comparison for token check

**What we chose**: Use `crypto.timingSafeEqual()` with `String.prototype.padEnd()` to ensure constant-time comparison.

**Alternatives considered**:
- Simple string equality (`===`) — vulnerable to timing attacks
- Third-party timing-safe libs — unnecessary dependency

**Rationale**: The `api-auth` spec explicitly requires timing-safe comparison. The `padEnd` approach handles unequal length strings safely (throws if lengths differ, per Node.js crypto docs).

### Decision 3: Using `createAdminClient()` from `admin.ts` instead of inline `createClient`

**What we chose**: Import and use `createAdminClient()` from `@/lib/supabase/admin`.

**Alternatives considered**:
- Create admin client inline with service role key — violates DRY, duplicates config
- Use existing `createClient` from `@/lib/supabase/server` — this is for authenticated user context, not admin

**Rationale**: `admin.ts` already exists with proper typed client, auth config (`autoRefreshToken: false`, `persistSession: false`), and handles the service role key properly. Reusing it follows project conventions.

## 3. File Changes Table

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/devices/refresh/route.ts` | Modify | Add Bearer auth, use admin client, limit fields to safe subset |

## 4. Interfaces/Contracts

### Fixed Route Pattern

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'crypto'
import { toBuffer } from '@/lib/utils'

export async function POST(request: NextRequest) {
  // 1. Check CRON_AUTH_TOKEN is configured
  const expectedToken = process.env.CRON_AUTH_TOKEN
  if (!expectedToken) {
    return NextResponse.json(
      { error: 'CRON_AUTH_TOKEN not configured' },
      { status: 500 }
    )
  }

  // 2. Validate Bearer token with timing-safe comparison
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const token = authHeader.slice(7) // Strip 'Bearer ' prefix
  const expectedBuffer = Buffer.from(expectedToken.padEnd(32, '\0'))
  const tokenBuffer = Buffer.from(token.padEnd(32, '\0'))

  if (expectedBuffer.length !== tokenBuffer.length ||
      !timingSafeEqual(expectedBuffer, tokenBuffer)) {
    return new Response('Unauthorized', { status: 401 })
  }

  // 3. Check deviceId present
  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get('id')
  if (!deviceId) {
    return NextResponse.json({ error: 'No device ID' }, { status: 400 })
  }

  // 4. Use admin client, select only safe fields
  const supabase = createAdminClient()
  const { data: device, error } = await supabase
    .from('devices')
    .select('id, device_name, device_type, status, last_seen_at, created_at')
    .eq('id', deviceId)
    .single()

  if (error || !device) {
    return NextResponse.json(
      { error: error?.message || 'Device not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(device)
}
```

### Helper Function (if needed)

The `toBuffer` helper and `padEnd` pattern from `check-connectivity` doesn't use timingSafeEqual properly for variable-length tokens. The design above shows the correct approach using `padEnd(32, '\0')` to ensure equal length buffers.

**Note**: If `toBuffer` utility doesn't exist, the inline approach works. The key is ensuring both buffers are same length before `timingSafeEqual`.

## 5. Testing Strategy

### Manual Testing

```bash
# Test 1: Request without auth (expect 401)
curl -X POST http://localhost:3000/api/devices/refresh?id=123

# Test 2: Request with invalid token (expect 401)
curl -X POST http://localhost:3000/api/devices/refresh?id=123 \
  -H "Authorization: Bearer wrong-token"

# Test 3: Request with valid token (expect 200 + safe fields)
curl -X POST http://localhost:3000/api/devices/refresh?id=<valid-uuid> \
  -H "Authorization: Bearer $CRON_AUTH_TOKEN"

# Test 4: Verify sensitive fields absent (should NOT contain device_password_encrypted)
```

### Automated Test (future)

```typescript
// tests/api/devices/refresh.test.ts
describe('GET /api/devices/refresh', () => {
  it('returns 401 without auth header', async () => { ... })
  it('returns 401 with invalid token', async () => { ... })
  it('returns only safe fields with valid token', async () => { ... })
  it('does not include device_password_encrypted', async () => { ... })
})
```

## 6. Open Questions

1. **`toBuffer` utility exists?** The `check-connectivity` route imports `toBuffer` but it wasn't visible in the file read. Need to verify if this utility function exists or if the inline `Buffer.from()` approach should be used.

2. **Does `check-connectivity` route have timing-safe comparison?** The current implementation uses simple `!==` comparison at line 11. The design fixes this — the `device/refresh` route should use proper `timingSafeEqual`. This may indicate `check-connectivity` needs the same fix (out of scope for this change, but worth noting).

3. **Tasks file location**: `tasks.md` doesn't exist yet in `openspec/changes/fix-device-refresh-api/`. The orchestrator will create this during the tasks phase.