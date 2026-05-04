# Design: Fix RLS Security Vulnerabilities

## Technical Approach

Restrict write access to HR tables and `door_commands` by replacing `auth.role() = 'authenticated'` RLS checks with role-based helper functions. Two SQL migrations create the helper functions, update four HR table policies, and restrict `door_commands` INSERT. The `sendDoorCommand` action gets a server-side role check as defense-in-depth since server actions bypass RLS.

## Architecture Decisions

### Decision: Use `SECURITY DEFINER` for helper functions

**Choice**: `CREATE FUNCTION ... SECURITY DEFINER`
**Alternatives considered**: `SECURITY INVOKER` (default) — would require RLS bypass within the function itself
**Rationale**: `is_admin()` already uses this pattern (migration 004). `SECURITY DEFINER` runs with the function owner's privileges, allowing the function to query `profiles` without triggering recursive RLS checks.

### Decision: One function per authorization concern

**Choice**: Separate `is_admin_or_hr()` and `can_send_door_command()` functions
**Alternatives considered**: Single `has_role(roles[])` function with parameterized roles
**Rationale**: Each call site has distinct role requirements. Separate functions are self-documenting and reduce query surface area per call site. Parameterized approach adds complexity without benefit here.

### Decision: Action-level check as secondary defense

**Choice**: Add role check in `sendDoorCommand` action after RLS update
**Alternatives considered**: RLS-only, action-only
**Rationale**: Server actions execute with elevated privileges and bypass RLS in some Supabase configurations. Spec scenario #88 explicitly requires action-level rejection — so both layers are required per spec.

## Data Flow

### RLS-Only Path (door_commands INSERT)
```
User → Supabase INSERT door_commands → RLS policy: can_send_door_command() → Success/Reject
```

### Action Path (sendDoorCommand)
```
User → sendDoorCommand() → Profile lookup by auth.uid() → Role check → INSERT door_commands → Result
```

### HR Tables Path (time_templates, schedule_assignments, holidays, attendance_overrides)
```
User → Supabase INSERT/UPDATE/DELETE → RLS policy: is_admin_or_hr() → Success/Reject
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/021_add_rls_helpers.sql` | Create | Creates `is_admin_or_hr()` and `can_send_door_command()` functions |
| `supabase/migrations/022_restrict_hr_tables.sql` | Create | Updates 4 HR table policies to use `is_admin_or_hr()` |
| `supabase/migrations/022_restrict_hr_tables.sql` | Modify | Updates `door_commands` INSERT policy to use `can_send_door_command()` |
| `src/actions/door.ts` | Modify | Add role check in `sendDoorCommand()` before INSERT |

## SQL Functions

### `is_admin_or_hr()`
```sql
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'hr_operator')
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### `can_send_door_command()`
```sql
CREATE OR REPLACE FUNCTION public.can_send_door_command()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'technician')
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

## Policy Changes

| Table | Operation | Before | After |
|-------|-----------|--------|-------|
| `time_templates` | INSERT/UPDATE/DELETE | `auth.role() = 'authenticated'` | `is_admin_or_hr()` |
| `schedule_assignments` | INSERT/UPDATE/DELETE | `auth.role() = 'authenticated'` | `is_admin_or_hr()` |
| `holidays` | INSERT/UPDATE/DELETE | `auth.role() = 'authenticated'` | `is_admin_or_hr()` |
| `attendance_overrides` | INSERT/UPDATE/DELETE | `auth.role() = 'authenticated'` | `is_admin_or_hr()` |
| `door_commands` | INSERT | `auth.role() = 'authenticated'` | `can_send_door_command()` |

SELECT policies remain unchanged — read access stays with all authenticated users.

## Action-Level Role Check

In `src/actions/door.ts`, add profile lookup and role verification before the INSERT:

```typescript
export async function sendDoorCommand(deviceSerial: string, action: DoorAction) {
  const supabase = await createClient()

  // Get current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  if (!profile || !['admin', 'technician'].includes(profile.role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await (supabase as any)
    .from('door_commands')
    .insert([{ device_serial: deviceSerial, action, status: 'pending' }])
    .select()
    .single()

  // ...
}
```

## Edge Cases

| Case | Behavior |
|------|----------|
| Profile row missing for user | `EXISTS` returns false → function returns false → access denied |
| `profiles.role` is NULL | NULL NOT IN ('admin', 'hr_operator') → returns false → access denied |
| RLS disabled on profiles | Not a concern — helper uses `SECURITY DEFINER` with direct table access |
| Server action bypassing RLS | Action-level check in `sendDoorCommand` catches this |

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | Helper functions return correct bool per role | Direct SQL SELECT on each function with different role values |
| Integration | RLS policies enforce access | INSERT as each role type, verify 201 vs 42501 |
| Integration | sendDoorCommand rejects unauthorized | Call action as viewer role, verify error response |

## Migration Order

1. `021_add_rls_helpers.sql` — create both functions (no policy dependencies yet)
2. `022_restrict_hr_tables.sql` — drop old policies, create new ones using helpers; update door_commands INSERT

Both migrations can run in sequence without data migration. No breaking changes to existing data.

## Open Questions

None — spec fully defines the expected behavior.