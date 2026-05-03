# Tasks: Fix RLS Privacy Breach (#23)

## Phase 1: Migration

- [ ] 1.1 Apply `supabase/migrations/019_add_user_id_to_persons_devices.sql` to staging database
- [ ] 1.2 Verify `user_id` column added to `persons` table (check information_schema)
- [ ] 1.3 Verify `user_id` column added to `devices` table (check information_schema)
- [ ] 1.4 Verify trigger `set_persons_user_id_on_insert` created on `persons`
- [ ] 1.5 Verify trigger `set_devices_user_id_on_insert` created on `devices`
- [ ] 1.6 Verify existing records backfilled (query persons/devices for non-NULL user_id)
- [ ] 1.7 Verify old permissive policies dropped ("Authenticated users can view persons/devices/events")
- [ ] 1.8 Verify new scoped policies created on `persons` (ownership + admin exemptions)
- [ ] 1.9 Verify new scoped policies created on `devices` (ownership + admin/tech exemptions)
- [ ] 1.10 Verify new scoped policies created on `access_events` (person/device join + hr exemptions)
- [ ] 1.11 Verify indexes created: `idx_persons_user_id`, `idx_devices_user_id`, `idx_access_events_device_serial`

## Phase 2: Application Code Updates

- [ ] 2.1 Review `src/actions/persons.ts` — all inserts use `createAdminClient()` (bypasses RLS) → no changes needed
- [ ] 2.2 Check `agent/scripts/setup-db.ts` device insert — verify `user_id` handling if any
- [ ] 2.3 Review `src/actions/reports.ts`, `src/actions/events.ts`, `src/actions/attendance.ts` for admin-only queries that may need user_id filtering now
- [ ] 2.4 Check frontend queries via Supabase client (not admin) for persons/devices — may break if they expect all records

## Phase 3: Testing

- [ ] 3.1 Test as regular user — SELECT persons returns only records where user_id = auth.uid()
- [ ] 3.2 Test as admin — SELECT persons returns ALL records (role-based exemption works)
- [ ] 3.3 Test as regular user — SELECT devices returns only own devices
- [ ] 3.4 Test as technician — SELECT devices returns ALL devices (role-based exemption works)
- [ ] 3.5 Test INSERT on persons — `user_id` auto-set to auth.uid() via trigger (no explicit user_id needed)
- [ ] 3.6 Test INSERT on persons with mismatched explicit `user_id` — fails due to WITH CHECK policy
- [ ] 3.7 Test INSERT on devices — `user_id` auto-set to auth.uid() via trigger
- [ ] 3.8 Test access_events visibility — user sees events only via owned persons OR owned devices
- [ ] 3.9 Test as admin/hr_operator — SELECT access_events returns ALL events (role-based exemption works)
- [ ] 3.10 Test INSERT on access_events — System policy allows (agent bridge, existing policy kept)

## Phase 4: Production

- [ ] 4.1 Apply migration to production database (with backup taken prior)
- [ ] 4.2 Monitor application logs for RLS policy denies (queries returning empty unexpectedly)
- [ ] 4.3 Verify `supabase/schema.sql` updated to reflect new policies (reference file sync)
- [ ] 4.4 Update database.types.ts if `user_id` column needs to be added to generated types
