# Tasks: Fix RLS Security Vulnerabilities

## Phase 1: Database Migrations (Foundation)

- [ ] 1.1 Create `supabase/migrations/021_add_rls_helpers.sql` with `is_admin_or_hr()` function (SECURITY DEFINER, checks profiles.role IN ('admin', 'hr_operator'))
- [ ] 1.2 Add `can_send_door_command()` function to same migration (SECURITY DEFINER, checks profiles.role IN ('admin', 'technician'))

## Phase 2: RLS Policy Updates

- [ ] 2.1 Create `supabase/migrations/022_restrict_hr_tables.sql` — drop and recreate `time_templates` policies for INSERT/UPDATE/DELETE using `is_admin_or_hr()`
- [ ] 2.2 Update `schedule_assignments` policies (INSERT/UPDATE/DELETE) to use `is_admin_or_hr()`
- [ ] 2.3 Update `holidays` policies (INSERT/UPDATE/DELETE) to use `is_admin_or_hr()`
- [ ] 2.4 Update `attendance_overrides` policies (INSERT/UPDATE/DELETE) to use `is_admin_or_hr()`
- [ ] 2.5 Update `door_commands` INSERT policy to use `can_send_door_command()` instead of `auth.role() = 'authenticated'`

## Phase 3: Action-Level Authorization

- [ ] 3.1 In `src/actions/door.ts` — add profile lookup before INSERT in `sendDoorCommand` function
- [ ] 3.2 Add role validation: return `{ success: false, error: 'Unauthorized' }` if profile.role not in ['admin', 'technician']

## Phase 4: Verification

- [ ] 4.1 Run `npx tsc --noEmit` to verify TypeScript compiles without errors
- [ ] 4.2 Validate migration SQL syntax: run each .sql file through `psql --set ON_ERROR_STOP=1` or equivalent syntax check