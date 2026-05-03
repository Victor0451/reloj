# Tasks: fix-device-refresh-api

## Phase 1: Implementation

- [x] 1.1 Add Bearer auth — validate Authorization header against CRON_AUTH_TOKEN, return 401 if invalid
- [x] 1.2 Use admin client — replace createClient (anon key) with createAdminClient() from @/lib/supabase/admin
- [x] 1.3 Filter safe fields — change select('*') to select only: id, name, device_type, status, last_seen_at, created_at

## Phase 2: Verification

- [x] 2.1 Run build/typecheck — npm run build passes ✅
- [ ] 2.2 Manual curl test without auth — expect 401
- [ ] 2.3 Manual curl test with invalid token — expect 401
- [ ] 2.4 Manual curl test with valid token — expect 200 with safe device fields