# Delta: Fix RLS Security Vulnerabilities

## MODIFIED Requirements

### Requirement: HR Table Write Access (time_templates, schedule_assignments, holidays, attendance_overrides)

The system MUST restrict INSERT, UPDATE, and DELETE operations on `time_templates`, `schedule_assignments`, `holidays`, and `attendance_overrides` tables to users with `admin` or `hr_operator` role only. SELECT operations remain available to all authenticated users.
(Previously: Any authenticated user could write to these tables)

#### Scenario: HR operator creates holiday — success

- GIVEN a user authenticated as `hr_operator`
- WHEN they INSERT a row into `holidays`
- THEN the operation MUST succeed
- AND the row is created with the user's ID as `created_by`

#### Scenario: HR operator updates schedule assignment — success

- GIVEN a user authenticated as `hr_operator`
- WHEN they UPDATE a row in `schedule_assignments`
- THEN the operation MUST succeed

#### Scenario: Data entry operator creates holiday — rejected at RLS level

- GIVEN a user authenticated as `data_entry` (role not in admin/hr_operator)
- WHEN they INSERT a row into `holidays`
- THEN the operation MUST be rejected by RLS policy
- AND Supabase returns error `42501: permission denied`

#### Scenario: Admin creates time template — success

- GIVEN a user authenticated as `admin`
- WHEN they INSERT a row into `time_templates`
- THEN the operation MUST succeed

#### Scenario: Authenticated user deletes attendance override — rejected

- GIVEN a user authenticated with role `authenticated` (no specific role)
- WHEN they DELETE a row from `attendance_overrides`
- THEN the operation MUST be rejected by RLS policy

#### Scenario: Unauthenticated request — rejected

- GIVEN no authenticated session
- WHEN any INSERT/UPDATE/DELETE is attempted on these tables
- THEN the operation MUST be rejected

#### Scenario: SELECT still available to all authenticated users

- GIVEN a user authenticated as `viewer`
- WHEN they SELECT from `holidays`
- THEN the operation MUST succeed (read access unchanged)

### Requirement: Door Command Access

The system MUST restrict INSERT operations on `door_commands` table to users with `admin` or `technician` role only. SELECT remains available to authenticated users for monitoring purposes.
(Previously: Any authenticated user could insert door commands)

#### Scenario: Admin sends door command — success

- GIVEN a user authenticated as `admin`
- WHEN they INSERT a row into `door_commands`
- THEN the operation MUST succeed
- AND `requested_by` is set to the user's ID

#### Scenario: Technician sends door command — success

- GIVEN a user authenticated as `technician`
- WHEN they INSERT a row into `door_commands`
- THEN the operation MUST succeed

#### Scenario: Regular authenticated user sends door command — rejected at RLS level

- GIVEN a user authenticated with role `authenticated` only (not admin/technician)
- WHEN they INSERT a row into `door_commands`
- THEN the operation MUST be rejected by RLS policy
- AND Supabase returns error `42501: permission denied`

#### Scenario: sendDoorCommand action — authorized role succeeds

- GIVEN an authenticated `admin` user calls `sendDoorCommand('DEVICE001', 'open')`
- WHEN the action executes
- THEN it MUST insert a pending command into `door_commands`
- AND return `{ success: true, commandId: <uuid> }`

#### Scenario: sendDoorCommand action — unauthorized role rejected at action level

- GIVEN an authenticated `viewer` user calls `sendDoorCommand('DEVICE001', 'open')`
- WHEN the action executes
- THEN it MUST return `{ success: false, error: 'Unauthorized' }`
- AND no row is inserted into `door_commands`

### Requirement: Role Helper Functions

The system MUST provide SQL helper functions to encapsulate role checks.

#### Scenario: is_admin_or_hr() returns true for admin

- GIVEN a user authenticated as `admin`
- WHEN `is_admin_or_hr()` is called
- THEN it MUST return `true`

#### Scenario: is_admin_or_hr() returns true for hr_operator

- GIVEN a user authenticated as `hr_operator`
- WHEN `is_admin_or_hr()` is called
- THEN it MUST return `true`

#### Scenario: is_admin_or_hr() returns false for other roles

- GIVEN a user authenticated as `data_entry`
- WHEN `is_admin_or_hr()` is called
- THEN it MUST return `false`

#### Scenario: can_send_door_command() returns true for admin

- GIVEN a user authenticated as `admin`
- WHEN `can_send_door_command()` is called
- THEN it MUST return `true`

#### Scenario: can_send_door_command() returns true for technician

- GIVEN a user authenticated as `technician`
- WHEN `can_send_door_command()` is called
- THEN it MUST return `true`

#### Scenario: can_send_door_command() returns false for other roles

- GIVEN a user authenticated as `hr_operator`
- WHEN `can_send_door_command()` is called
- THEN it MUST return `false` (hr_operator cannot send door commands)

### Requirement: Error Handling

#### Scenario: RLS policy blocks write — specific error returned

- GIVEN a user without proper role attempts INSERT/UPDATE/DELETE
- WHEN the operation is blocked by RLS
- THEN Supabase MUST return error code `42501` (permission denied)
- AND error message indicates the operation is not permitted

#### Scenario: User with no role — treated as least privileged (rejected)

- GIVEN a user session where `auth.uid()` exists but `profiles.role` is NULL
- WHEN any restricted operation is attempted
- THEN the operation MUST be rejected
- AND helper functions MUST return `false`

## Status Transitions

| State | Before | After |
|-------|--------|-------|
| `holidays` INSERT | authenticated | admin OR hr_operator |
| `time_templates` INSERT | authenticated | admin OR hr_operator |
| `schedule_assignments` INSERT | authenticated | admin OR hr_operator |
| `attendance_overrides` INSERT | authenticated | admin OR hr_operator |
| `door_commands` INSERT | authenticated | admin OR technician |
| `sendDoorCommand` action | unchecked | check role admin OR technician |

## Files Affected

| File | Change |
|------|--------|
| `supabase/migrations/0XX_rls_security_fix.sql` | Add `is_admin_or_hr()`, `can_send_door_command()`, update 5 RLS policies |
| `src/actions/door.ts` | Add role check before inserting door command |