# Tasks: Fix Frontend HikvisionAdapter Import

## Phase 1: Create Device Health API Route

- [ ] 1.1 Create `src/app/api/devices/[id]/health/route.ts` with GET handler
- [ ] 1.2 Inject `createAdminClient()` from `@/lib/supabase/admin` for server-side credential fetch
- [ ] 1.3 Fetch device credentials (ip_address, device_username, device_password_encrypted, brand, allow_self_signed_cert) from `devices` table using service role
- [ ] 1.4 If device not found, return `NextResponse.json({ error: 'Device not found' }, { status: 404 })`
- [ ] 1.5 If credentials incomplete, return `NextResponse.json({ status: 'error', error: '...' }, { status: 422 })`
- [ ] 1.6 Instantiate `HikvisionAdapter` from `agent/src/adapters/hikvision.adapter` with credentials
- [ ] 1.7 Call `adapter.healthCheck()`, measure latency, disconnect adapter
- [ ] 1.8 Return JSON: `{ status, latency, error, timestamp }` with appropriate HTTP status

## Phase 2: Refactor Frontend device-connectivity.ts

- [ ] 2.1 Remove line 2: `import { HikvisionAdapter } from '../../agent/src/adapters/hikvision.adapter'`
- [ ] 2.2 Update `checkStoredDeviceConnectivity(deviceId)` to use `fetch('/api/devices/' + deviceId + '/health')` instead of calling `checkDeviceConnectivity` with DB credentials
- [ ] 2.3 Keep `performDeviceConnectionCheck` unchanged — still uses HikvisionAdapter for direct credential calls (agent-to-agent, scheduled jobs)
- [ ] 2.4 Keep `checkDeviceConnectivity` unchanged — backward-compatible wrapper for external callers
- [ ] 2.5 Verify `HealthCheckResult` type still exports correctly (no adapter dependency)

## Phase 3: Verification

- [ ] 3.1 Run `npx tsc --noEmit` — verify no TypeScript errors
- [ ] 3.2 Run `npm run lint` — verify no lint errors
- [ ] 3.3 Verify build: `npm run build` succeeds without errors
- [ ] 3.4 Test API route manually: `curl -X GET http://localhost:3000/api/devices/{id}/health` returns valid JSON
- [ ] 3.5 Confirm browser bundle no longer includes `agent/src/adapters/` code (check build output)