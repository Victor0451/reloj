# Technical Design: Fix RLS Privacy Breach (#23)

## Status

| Field | Value |
|-------|-------|
| Change ID | `fix-rls-privacy-breach` |
| Design Version | 1.0 |
| Created | 2026-05-03 |
| Last Updated | 2026-05-03 |
| SDD Phase | design |

---

## Executive Summary

This design document specifies the implementation approach for fixing a critical RLS privacy breach where any authenticated user could read all records in `persons`, `devices`, and `access_events` tables.

**Solution**: Add `user_id` ownership columns to `persons` and `devices`, create a `SECURITY DEFINER` trigger function to auto-populate `user_id` on INSERT, and replace permissive SELECT policies with scoped policies based on ownership + role-based exemptions.

---

## Architecture Decisions

### AD-001: `user_id` Column Placement

**Decision**: Add `user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL` to both `persons` and `devices` tables.

**Rationale**:
- Direct ownership tracking at the table level
- `ON DELETE SET NULL` prevents orphaned records if a user is deleted
- `access_events` inherits visibility through `person_id` and `device_serial` joins (no direct `user_id` needed)

**Tradeoffs**:
- Pro: Simple, explicit ownership model
- Con: `access_events` queries require JOINs for RLS evaluation (mitigated with indexes)

---

### AD-002: Trigger Function Security Context

**Decision**: Use `SECURITY DEFINER` for `set_user_id_on_insert()` trigger function.

**Rationale**:
- `SECURITY DEFINER` functions execute with the privileges of the user who created them, NOT the calling user
- Combined with `SET search_path TO auth` (to prevent spoofing), this allows the trigger to access `auth.uid()` correctly
- The `WITH CHECK` policy on INSERT ensures users can only insert records where their UID matches `user_id`

**Implementation Pattern**:
```sql
CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO auth;
```

---

### AD-003: Backfill Strategy

**Decision**: Backfill existing records to the first admin user (by `created_at ASC`).

**Rationale**:
- Ensures all existing data is owned by an admin (who already has broad access)
- NULL would create orphan records visible only to admins
- Using `ORDER BY created_at ASC LIMIT 1` provides deterministic selection

**Alternative Considered**: Set `user_id` to NULL and rely on admin-only access
- Rejected because it would make existing data invisible to regular users without explicit need

---

### AD-004: Policy Evaluation Order

**Decision**: Use separate policies for ownership vs. role-based access rather than combining with OR.

**Rationale**:
- Separate policies are easier to reason about and debug
- Supabase RLS evaluates all policies with OR semantics (any matching policy allows access)
- Role-based policies are an exemption, not an extension of ownership

**Example** (`persons` SELECT):
1. Policy: `Users view own persons` → `auth.uid() = user_id`
2. Policy: `Admins view all persons` → `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`

---

## SQL Migration

**File**: `supabase/migrations/019_add_user_id_to_persons_devices.sql`

### Migration Steps (in order)

1. **Add `user_id` column to `persons`** (with FK constraint)
2. **Add `user_id` column to `devices`** (with FK constraint)
3. **Create `set_user_id_on_insert()` trigger function** (SECURITY DEFINER)
4. **Create BEFORE INSERT triggers** on both tables
5. **Backfill existing records** to first admin user
6. **Drop old permissive policies**
7. **Create new scoped policies**
8. **Ensure RLS is enabled** on modified tables

### Key SQL Patterns

**Trigger Function (SECURITY DEFINER)**:
```sql
CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO auth;
```

**BEFORE INSERT Trigger** (not AFTER — we want to set user_id before RLS WITH CHECK evaluates):
```sql
CREATE TRIGGER set_persons_user_id_on_insert
  BEFORE INSERT ON persons
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_on_insert();
```

**Backfill Query**:
```sql
UPDATE persons
SET user_id = (
  SELECT id FROM profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE user_id IS NULL;
```

---

## Trigger Implementation Details

### Timing: BEFORE INSERT

Using `BEFORE INSERT` (not `AFTER INSERT`) is critical because:
1. RLS `WITH CHECK` policies evaluate on the NEW row before insertion
2. If we used `AFTER INSERT`, the `WITH CHECK (auth.uid() = user_id)` would fail because `user_id` would be NULL at check time
3. `BEFORE INSERT` allows the trigger to set `user_id` before RLS evaluation

### Trigger Function Logic

```sql
NEW.user_id := COALESCE(NEW.user_id, auth.uid());
```

- If caller explicitly provides `user_id`, use it (allows admins to insert on behalf of others)
- If caller doesn't provide `user_id`, default to `auth.uid()`
- This makes explicit INSERT by non-owners fail due to `WITH CHECK` policy

### SECURITY DEFINER + search_path

Two security layers prevent privilege escalation:
1. `SECURITY DEFINER` — function runs with creator's privileges
2. `SET search_path TO auth` — prevents malicious table creation in public schema

---

## Index Recommendations

To mitigate RLS performance overhead from subqueries, these indexes are recommended:

### Required Indexes

| Index | Table | Columns | Rationale |
|-------|-------|---------|-----------|
| `idx_persons_user_id` | `persons` | `user_id` | speeds up RLS ownership check |
| `idx_devices_user_id` | `devices` | `user_id` | speeds up RLS ownership check |
| `idx_access_events_person_id` | `access_events` | `person_id` | already exists, but critical for 4.1 policy |
| `idx_access_events_device_serial` | `access_events` | `device_serial` | NEW — needed for 4.2 policy JOIN |

### Query Patterns Being Optimized

**Policy 4.1** (`access_events` via `persons`):
```sql
EXISTS (SELECT 1 FROM persons WHERE id = access_events.person_id AND user_id = auth.uid())
```
→ Requires `persons.user_id` index and `access_events.person_id` index

**Policy 4.2** (`access_events` via `devices`):
```sql
EXISTS (SELECT 1 FROM devices WHERE serial_number = access_events.device_serial AND user_id = auth.uid())
```
→ Requires `devices.user_id` index and `access_events.device_serial` index

---

## Testing Strategy

### Unit Tests (Postgres)

1. **Trigger Function Tests**:
   - Verify `set_user_id_on_insert()` sets correct UID
   - Verify explicit user_id is preserved (not overwritten)
   - Verify `SECURITY DEFINER` context is correct

2. **RLS Policy Tests**:
   - Test each policy with different user contexts
   - Test ownership scenarios (uid = user_id)
   - Test role exemption scenarios (admin, technician, hr_operator)

### Integration Tests (Supabase)

```sql
-- Test 1: Regular user can only see their own persons
SELECT * FROM persons WHERE user_id = auth.uid();

-- Test 2: Admin can see all persons
SELECT * FROM persons; -- with admin context

-- Test 3: INSERT auto-sets user_id
INSERT INTO persons (name) VALUES ('Test Person') RETURNING user_id; -- should equal auth.uid()

-- Test 4: INSERT with mismatched user_id fails
INSERT INTO persons (name, user_id) VALUES ('Test', 'different-uid'); -- should fail

-- Test 5: Backfill assigns to admin
SELECT user_id FROM persons WHERE id = 'existing-person-id'; -- should be admin UID
```

### Migration Verification

```sql
-- Verify column exists
SELECT column_name FROM information_schema.columns WHERE table_name = 'persons' AND column_name = 'user_id';

-- Verify trigger exists
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'set_persons_user_id_on_insert';

-- Verify policies dropped
SELECT polname FROM pg_policy WHERE polrelid = 'persons'::regclass;

-- Verify RLS enabled
SELECT relrowsecurity FROM pg_class WHERE relname = 'persons';
```

---

## File Artifacts

| File | Action |
|------|--------|
| `openspec/changes/fix-rls-privacy-breach/design.md` | Created |
| `supabase/migrations/019_add_user_id_to_persons_devices.sql` | Created |

---

## Next Recommended

1. **Apply migration** to staging environment
2. **Run verification queries** (Section 7.4 of spec.md)
3. **Test API routes** (`/api/persons`, `/api/devices`) for broken queries
4. **Update schema.sql** reference file if needed
5. **Monitor query performance** after RLS policy changes (index impact)

---

## Appendix: Full Migration SQL

See `supabase/migrations/019_add_user_id_to_persons_devices.sql` for complete implementation.
