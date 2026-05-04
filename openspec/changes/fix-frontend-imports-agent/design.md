# Design: fix-frontend-imports-agent

## Technical Approach

Refactor the device connectivity layer to use a server-side API route instead of importing `HikvisionAdapter` in frontend code. The API route acts as a secure bridge — it fetches encrypted credentials server-side, performs the health check via `HikvisionAdapter`, and returns only sanitized status data. Frontend code calls the API route via `fetch()`.

## Architecture Decisions

### Decision 1: API Route pattern vs Server Action

**Choice**: Route Handler (`src/app/api/devices/[id]/health/route.ts`) with `GET` method
**Alternatives considered**: Server Action (`'use server'` function) — but Server Actions are invoked via form actions or `startTransition`, not `fetch()`. For a client-side triggered health check with async response, REST API is cleaner.
**Rationale**: The existing `check-connectivity` route uses `GET` with auth header pattern. Following the same convention keeps the codebase consistent and allows reuse of auth middleware patterns.

### Decision 2: Admin client for credential fetch

**Choice**: Use `createAdminClient()` from `@/lib/supabase/admin` (service role key, bypasses RLS)
**Alternatives considered**: Use authenticated user's client — this would fail because RLS policies prevent access to `device_password_encrypted` column
**Rationale**: `admin.ts` already exists with proper config (`autoRefreshToken: false`, `persistSession: false`). Service role is required to read encrypted credentials.

### Decision 3: What functions call the API route

**Choice**: `checkStoredDeviceConnectivity(deviceId)` calls the new route; `checkDeviceConnectivity(ipAddress | DeviceConnectionInput)` keeps direct adapter usage for cases where credentials are passed explicitly (agent-to-agent, scripts)
**Alternatives considered**: Route all connectivity checks through API — would break scripts and cases where no stored credentials exist
**Rationale**: Separation aligns with proposal intent: frontend uses API, backend/scripts use direct adapter

## Data Flow

```
Client (DeviceCard)
  └── checkDeviceConnection(deviceId)
        └── checkStoredDeviceConnectivity(deviceId)
              └── GET /api/devices/[id]/health
                    │
              API Route (Node.js, server-only)
                    │
              createAdminClient()
                    │  Query: ip_address, device_username, device_password_encrypted
                    ▼
              HikvisionAdapter (Node.js context)
                    │
              healthCheck() → { reachable, latency, error, timestamp }
                    │
              sanitize → { status, latency, error, timestamp }
                    │
              JSON Response to client
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/devices/[id]/health/route.ts` | Create | Route Handler with GET method; fetches credentials via admin client, invokes HikvisionAdapter, returns sanitized result |
| `src/lib/device-connectivity.ts` | Modify | Remove HikvisionAdapter import (line 2); `checkStoredDeviceConnectivity` calls API route instead of direct adapter; `checkDeviceConnectivity` keeps direct adapter for explicit credentials |

## Interfaces / Contracts

### Health Check API Response

```typescript
// GET /api/devices/[id]/health
// Success (200)
{
  status: "online" | "offline" | "error",
  latency: number | null,
  error: string | null,
  timestamp: string // ISO8601
}

// Device not found (404)
{ error: "Device not found" }

// Database error (500)
{ error: "Internal server error" }
```

### Refactored `checkStoredDeviceConnectivity`

```typescript
// Replaces direct HikvisionAdapter usage with API call
export async function checkStoredDeviceConnectivity(deviceId: string): Promise<HealthCheckResult> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/devices/${deviceId}/health`,
      { cache: 'no-store' } // Always fresh
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        status: 'error',
        error: errorData.error || `HTTP ${response.status}`,
        timestamp: new Date(),
      }
    }

    const data = await response.json()
    return {
      status: data.status,
      latency: data.latency,
      error: data.error,
      timestamp: new Date(data.timestamp),
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Network error',
      timestamp: new Date(),
    }
  }
}
```

### API Route Implementation

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { HikvisionAdapter } from '../../../../agent/src/adapters/hikvision.adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch device credentials via admin client
    const supabase = createAdminClient()
    const { data: device, error } = await supabase
      .from('devices')
      .select('ip_address, device_username, device_password_encrypted, brand, allow_self_signed_cert')
      .eq('id', id)
      .single()

    if (error || !device) {
      return NextResponse.json(
        { error: 'Device not found' },
        { status: 404 }
      )
    }

    if (!device.ip_address || !device.device_username || !device.device_password_encrypted) {
      return NextResponse.json(
        { error: 'Device credentials not configured' },
        { status: 400 }
      )
    }

    // Perform health check via HikvisionAdapter (Node.js only)
    const adapter = new HikvisionAdapter({
      ip: device.ip_address,
      username: device.device_username,
      password: device.device_password_encrypted,
      port: 443,
      rejectUnauthorized: device.allow_self_signed_cert ? false : true,
    })

    let healthResult
    try {
      healthResult = await adapter.healthCheck()
    } finally {
      await adapter.disconnect()
    }

    // Map to API response shape
    return NextResponse.json({
      status: healthResult.reachable ? 'online' : 'offline',
      latency: healthResult.latency ?? null,
      error: healthResult.error ?? null,
      timestamp: healthResult.timestamp.toISOString(),
    })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `checkStoredDeviceConnectivity` API response mapping | Type-check only (no test runner) |
| Integration | API route against real device | Manual with device or mock |
| E2E | DeviceCard refresh button works end-to-end | Manual verification |

## Migration / Rollout

No database migration required. The change is additive:
1. Create API route
2. Deploy
3. Frontend starts using API route
4. Remove HikvisionAdapter import from `device-connectivity.ts`

## Open Questions

- [ ] Should the API route include Bearer token auth like `/api/devices/refresh`? The spec doesn't require it, but it would align with existing patterns.
- [ ] Should timeout be configurable via environment variable? Currently adapter uses default timeout.