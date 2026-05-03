# Proposal: fix-device-refresh-api

## Intent

Fix critical security vulnerability in `/api/devices/refresh` that exposes device credentials. The endpoint uses a public browser-readable key and has zero authentication, returning all device fields including encrypted passwords. This allows anyone to retrieve sensitive device credentials for any device ID.

## Scope

### In Scope
- Secure the `/api/devices/refresh` endpoint with Bearer token authentication
- Return only safe, non-sensitive device fields (exclude `device_password_encrypted`)
- Use server-side admin client (`createAdminClient()`) instead of public anon key

### Out of Scope
- Changes to device authentication flow
- Database schema changes
- Changes to other endpoints

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `device-refresh-api`: Require Bearer token auth and return only client-safe fields.

## Approach

1. Add Bearer token validation using `CRON_AUTH_TOKEN` env var (same pattern as `/api/check-connectivity`)
2. Replace `createClient()` with anon key with `createAdminClient()` from `@/lib/supabase/admin`
3. Modify query to explicitly select only safe fields: `id, device_name, device_type, status, last_seen_at, created_at`
4. Return 401 if auth header is missing or invalid
5. Return 400 if deviceId is missing

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/devices/refresh/route.ts` | Modified | Add auth check, use admin client, limit returned fields |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing callers without auth token | Low | This is a security fix; callers must be updated |
| CRON_AUTH_TOKEN not set in environment | Low | Check env var presence; return 500 with clear message if missing |

## Rollback Plan

Revert `src/app/api/devices/refresh/route.ts` to previous version via `git checkout HEAD~1 -- src/app/api/devices/refresh/route.ts`. This restores the vulnerable but functional state pending proper fix.

## Dependencies

- `CRON_AUTH_TOKEN` environment variable must be set (same used by `/api/check-connectivity`)

## Success Criteria

- [ ] Requests without `Authorization: Bearer <token>` header receive 401
- [ ] Requests with invalid token receive 401
- [ ] Valid requests return only safe device fields (no `device_password_encrypted`)
- [ ] Missing deviceId returns 400
- [ ] Build succeeds with `npm run build`