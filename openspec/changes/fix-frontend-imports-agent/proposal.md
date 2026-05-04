# Proposal: Fix Frontend HikvisionAdapter Import

## Intent

Remove the direct import of `HikvisionAdapter` from `src/lib/device-connectivity.ts`, which incorrectly imports Node.js agent code into the browser/Next.js frontend context. This creates a build context mismatch, bundle pollution, dependency mismatch, and security risk. The solution introduces a server-side API route that performs device health checks without exposing adapter internals to client code.

## Scope

### In Scope
- Create `src/app/api/devices/[id]/health/route.ts` — Next.js Route Handler with server-side health check
- Modify `src/lib/device-connectivity.ts` — remove `HikvisionAdapter` import, add API fetch logic
- Frontend calls `/api/devices/[id]/health` instead of instantiating `HikvisionAdapter` directly

### Out of Scope
- Changes to `agent/` codebase
- Database schema modifications
- New capabilities beyond the API route

## Capabilities

### New Capabilities
- `device-health-check-api`: Server-side Route Handler that performs health checks via stored device credentials, returning `{ status, latency, error, timestamp }` to clients

### Modified Capabilities
- None — existing capabilities are not changing at spec level

## Approach

1. **Create API Route** at `src/app/api/devices/[id]/health/route.ts`:
   - Accepts `GET` requests with device ID as route param
   - Uses server-side Supabase client to fetch encrypted credentials
   - Instantiates `HikvisionAdapter` server-side (Node.js context)
   - Returns JSON response with health check result
   - Uses service role to avoid exposing credentials to client

2. **Refactor `device-connectivity.ts`**:
   - Remove line 2 (`import { HikvisionAdapter } from '../../agent/src/adapters/hikvision.adapter'`)
   - Export a new `checkDeviceHealthAPI(deviceId)` function that fetches from `/api/devices/[deviceId]/health`
   - Keep existing `performDeviceConnectionCheck` for cases where credentials are passed directly (agent-to-agent calls)

3. **No changes to client-side API shape** — `HealthCheckResult` type and function signatures remain compatible

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/device-connectivity.ts` | Modified | Removed adapter import; added API fetch wrapper |
| `src/app/api/devices/[id]/health/route.ts` | New | Route Handler for device health checks |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| API route timing out on slow devices | Medium | Add timeout to adapter healthCheck call |
| Credentials fetch fails silently | Low | Return `{ status: 'error', error: '...' }` with appropriate message |
| Breaking existing callers of `performDeviceConnectionCheck` | Low | Function signature unchanged; only import removed |

## Rollback Plan

1. Revert `src/lib/device-connectivity.ts` to add back `HikvisionAdapter` import
2. Delete `src/app/api/devices/[id]/health/route.ts`
3. No database migration needed

## Dependencies

- Next.js 16.2.3 (App Router) — required for Route Handler pattern
- Supabase server client — already used in existing code

## Success Criteria

- [ ] `npm run build` succeeds without errors
- [ ] `npm run lint` passes
- [ ] TypeScript compile check passes (`tsc --noEmit`)
- [ ] No browser bundle includes `agent/src/adapters/` code
- [ ] API route returns valid `HealthCheckResult` JSON shape
