# Specification: Fix RLS Privacy Breach (#23)

## Status

| Field | Value |
|-------|-------|
| Change ID | `fix-rls-privacy-breach` |
| Spec Version | 1.0 |
| Created | 2026-05-03 |
| Last Updated | 2026-05-03 |
|SDD Phase | spec |

---

## Executive Summary

This specification defines Row Level Security (RLS) policies to fix a critical privacy breach where **any authenticated user** could access **all records** in the `persons`, `devices`, and `access_events` tables. The fix introduces ownership-based access control by adding `user_id` columns and scoped RLS policies that ensure users can only see records they own or are authorized to view based on their role.

**Key Changes:**
1. Add `user_id UUID REFERENCES auth.users(id)` column to `persons` and `devices` tables
2. Create triggers to auto-set `user_id` on INSERT to `auth.uid()`
3. Replace overly-permissive policies with scoped policies based on ownership
4. Implement role-based exemptions for admin, hr_operator, and technician roles
5. Backfill existing records with a default admin user or NULL

**Severity:** CRITICAL — Physical security risk, personal data exposure, GDPR compliance violation.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Specification | `openspec/changes/fix-rls-privacy-breach/specs/rls-policies/spec.md` |
| Proposal | `openspec/changes/fix-rls-privacy-breach/proposal.md` |
| Migration | `supabase/migrations/019_add_user_id_to_persons_devices.sql` (to be created) |

---

## 1. Schema Changes

### 1.1 Add `user_id` Column to `persons` Table

The `persons` table SHALL have a `user_id` column that references the user who created the person record.

```
user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
```

**Rationale:** `ON DELETE SET NULL` prevents accidental data loss if a user is deleted.

### 1.2 Add `user_id` Column to `devices` Table

The `devices` table SHALL have a `user_id` column that references the user who registered the device.

```
user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
```

**Rationale:** Same rationale as persons — ownership tracking with safe deletion.

### 1.3 Trigger for Auto-Setting `user_id` on INSERT

A trigger function SHALL be created that automatically sets `user_id` to `auth.uid()` on INSERT for both `persons` and `devices` tables.

**Trigger Function Signature:**
```sql
CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Applied to:**
- `persons` table (AFTER INSERT)
- `devices` table (AFTER INSERT)

---

## 2. RLS Policies — `persons` Table

### 2.1 Policy: Users View Own Persons

**Scenario:** Authenticated user viewing their own persons

**Given** a user is authenticated AND is the owner (auth.uid() = persons.user_id)

**When** they SELECT from persons

**Then** they CAN see their own person records

**Implementation:**
```sql
CREATE POLICY "Users view own persons" ON persons
  FOR SELECT USING (auth.uid() = user_id);
```

---

### 2.2 Policy: Admins View All Persons

**Scenario:** Admin user viewing all persons

**Given** a user is authenticated AND has role 'admin'

**When** they SELECT from persons

**Then** they CAN see ALL persons

**Implementation:**
```sql
CREATE POLICY "Admins view all persons" ON persons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
```

---

### 2.3 Policy: Users Cannot View Others' Persons

**Scenario:** Non-owner, non-admin user attempting to view persons

**Given** a user is authenticated but is NOT admin AND does NOT own the person (auth.uid() ≠ persons.user_id)

**When** they SELECT from persons

**Then** they CANNOT see those persons

**Implementation:** Covered by the combination of Policy 2.1 and Policy 2.2. No explicit DENY policy needed — RLS defaults to deny when no policy allows.

---

### 2.4 Policy: Auto-Set user_id on Insert

**Scenario:** User creates a person record

**Given** an INSERT on persons

**When** a user creates a person record

**Then** user_id SHALL be automatically set to auth.uid()

**Implementation:**
```sql
-- Trigger automatically sets user_id
CREATE TRIGGER set_persons_user_id_on_insert
  BEFORE INSERT ON persons
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_on_insert();

CREATE POLICY "Users can insert own persons" ON persons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

**Note:** The `WITH CHECK` policy ensures users can only insert records where user_id matches their auth.uid(), and the trigger ensures user_id is populated automatically if not explicitly provided.

---

## 3. RLS Policies — `devices` Table

### 3.1 Policy: Users View Own Devices

**Scenario:** Authenticated user viewing their own devices

**Given** a user is authenticated AND is the owner (auth.uid() = devices.user_id)

**When** they SELECT from devices

**Then** they CAN see their own device records

**Implementation:**
```sql
CREATE POLICY "Users view own devices" ON devices
  FOR SELECT USING (auth.uid() = user_id);
```

---

### 3.2 Policy: Admins and Technicians View All Devices

**Scenario:** Admin or technician user viewing all devices

**Given** a user is authenticated AND has role 'admin' OR 'technician'

**When** they SELECT from devices

**Then** they CAN see ALL devices

**Implementation:**
```sql
CREATE POLICY "Admins and Techs view all devices" ON devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'technician')
    )
  );
```

---

### 3.3 Policy: Users Cannot View Others' Devices

**Scenario:** Non-owner, non-admin/technician user attempting to view devices

**Given** a user is authenticated but is NOT admin/technician AND does NOT own the device (auth.uid() ≠ devices.user_id)

**When** they SELECT from devices

**Then** they CANNOT see those devices

**Implementation:** Covered by the combination of Policy 3.1 and Policy 3.2.

---

### 3.4 Policy: Auto-Set user_id on Insert

**Scenario:** User creates a device record

**Given** an INSERT on devices

**When** a user creates a device record

**Then** user_id SHALL be automatically set to auth.uid()

**Implementation:**
```sql
-- Trigger automatically sets user_id
CREATE TRIGGER set_devices_user_id_on_insert
  BEFORE INSERT ON devices
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_on_insert();

CREATE POLICY "Users can insert own devices" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

---

## 4. RLS Policies — `access_events` Table

### 4.1 Policy: Users View Events from Their Persons

**Scenario:** User viewing events for persons they own

**Given** a user is authenticated AND owns the person linked to the event (persons.user_id = auth.uid())

**When** they SELECT from access_events

**Then** they CAN see those events (via persons.user_id join)

**Implementation:**
```sql
CREATE POLICY "Users view own person events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM persons
      WHERE id = access_events.person_id
      AND user_id = auth.uid()
    )
  );
```

---

### 4.2 Policy: Users View Events from Their Devices

**Scenario:** User viewing events for devices they own

**Given** a user is authenticated AND owns the device linked to the event (devices.user_id = auth.uid())

**When** they SELECT from access_events

**Then** they CAN see those events (via devices.user_id join)

**Implementation:**
```sql
CREATE POLICY "Users view own device events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE serial_number = access_events.device_serial
      AND user_id = auth.uid()
    )
  );
```

---

### 4.3 Policy: Admins and HR Operators View All Events

**Scenario:** Admin or HR operator viewing all access events

**Given** a user is authenticated AND has role 'admin' OR 'hr_operator'

**When** they SELECT from access_events

**Then** they CAN see ALL events

**Implementation:**
```sql
CREATE POLICY "Admins and HR Ops view all events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr_operator')
    )
  );
```

---

### 4.4 Policy: Users Cannot View Unauthorized Events

**Scenario:** User attempting to view events they don't have access to

**Given** a user is authenticated but owns neither the person NOR the device related to the event

**When** they SELECT from access_events

**Then** they CANNOT see those events

**Implementation:** Covered by the combination of Policy 4.1, Policy 4.2, and Policy 4.3.

---

## 5. Migration Requirements

### 5.1 Migration Script Structure

The migration file `019_add_user_id_to_persons_devices.sql` SHALL contain the following steps in order:

1. **Add `user_id` column to `persons` table**
2. **Add `user_id` column to `devices` table**
3. **Create trigger function `set_user_id_on_insert()`**
4. **Create triggers on `persons` and `devices`**
5. **Backfill existing records**
6. **Drop old permissive policies**
7. **Create new scoped policies**
8. **Enable RLS on modified tables**

### 5.2 Backfill Strategy

**Given** existing records in `persons` and `devices` tables

**When** migration runs

**Then** the migration MUST handle existing records by:
- Setting `user_id` to the first admin user in `profiles` table, OR
- Setting `user_id` to NULL if no admin user exists
- Including a comment documenting this decision

**Implementation:**
```sql
-- Backfill persons: assign to first admin user
UPDATE persons
SET user_id = (
  SELECT id FROM profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE user_id IS NULL;

-- Backfill devices: assign to first admin user
UPDATE devices
SET user_id = (
  SELECT id FROM profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
)
WHERE user_id IS NULL;
```

### 5.3 Old Policies to Drop

The following overly-permissive policies SHALL be dropped:

| Table | Policy to Drop |
|-------|---------------|
| `persons` | "Authenticated users can view persons" |
| `devices` | "Authenticated users can view devices" |
| `access_events` | "Authenticated users can view events" |

### 5.4 RLS Enablement

After creating new policies, RLS SHALL be enabled on:
- `persons` table (if not already enabled)
- `devices` table (if not already enabled)

Note: `access_events` should already have RLS enabled, but policies need updating.

---

## 6. Breaking Changes

| Change | Impact |
|--------|--------|
| Existing queries assuming all persons visible | Will now return only owned persons (or empty) |
| Existing queries assuming all devices visible | Will now return only owned devices (or empty) |
| Existing queries assuming all events visible | Will now return only authorized events (or empty) |
| Applications relying on admin access | Must verify role-based exemptions work correctly |

---

## 7. Verification Criteria

### 7.1 persons Table

- [ ] Authenticated user with matching user_id CAN see their persons
- [ ] Authenticated admin CAN see ALL persons
- [ ] Authenticated non-owner, non-admin CANNOT see others' persons
- [ ] INSERT automatically sets user_id to auth.uid()
- [ ] INSERT with explicit user_id matching auth.uid() SUCCEEDS
- [ ] INSERT with user_id NOT matching auth.uid() FAILS

### 7.2 devices Table

- [ ] Authenticated user with matching user_id CAN see their devices
- [ ] Authenticated admin/technician CAN see ALL devices
- [ ] Authenticated non-owner, non-admin/technician CANNOT see others' devices
- [ ] INSERT automatically sets user_id to auth.uid()

### 7.3 access_events Table

- [ ] User CAN see events where they own the linked person
- [ ] User CAN see events where they own the linked device
- [ ] Admin/hr_operator CAN see ALL events
- [ ] User CANNOT see events where they own neither person nor device

### 7.4 Migration

- [ ] Migration adds user_id column to persons
- [ ] Migration adds user_id column to devices
- [ ] Migration creates trigger function
- [ ] Migration applies triggers to both tables
- [ ] Migration backfills existing records
- [ ] Migration drops old permissive policies
- [ ] Migration creates new scoped policies

---

## 8. Rollback Plan

If issues arise after deployment:

1. **Immediate rollback:** Disable new RLS policies and re-enable old permissive policies (keep migration for debugging)
2. **Data integrity:** Existing user_id values are preserved; no data loss
3. **Recovery:** Re-run the old permissive policy DDL from schema.sql history

---

## 9. Dependencies

- `profiles` table with `role` column must exist
- `auth.users` integration must be functional
- Supabase auth.uid() must be available

---

## 10. Non-Goals (Out of Scope)

- Modifying API route handlers (handled in separate change if needed)
- Adding user_devices relationship table
- Modifying access_events to add direct user_id column
- Changing the `persons` foreign key relationships to devices

---

## 11. RFC 2119 Keywords

| Keyword | Definition |
|---------|------------|
| SHALL | Required — must be implemented as specified |
| MUST | Required — same as SHALL |
| SHOULD | Strongly recommended — implement unless compelling reason not to |
| MAY | Optional — implement at discretion |

In this specification, **SHALL** is used for all mandatory requirements that must be satisfied for the fix to be considered complete.
