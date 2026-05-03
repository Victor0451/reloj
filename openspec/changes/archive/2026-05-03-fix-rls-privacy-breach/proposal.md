# Proposal: Fix RLS Privacy Breach (#23)

## Summary

The RLS policies on `persons`, `access_events`, and `devices` tables allow **any authenticated user** to read **all records**. This is a critical privacy breach — a malicious insider could access all employee attendance data, personal information, and infrastructure details.

## Problem Analysis

### Current State (from schema.sql)

**persons table (lines 130-132)**:
```sql
CREATE POLICY "Authenticated users can view persons" ON persons
  FOR SELECT USING (auth.role() = 'authenticated');
```
→ Any authenticated user can view ALL 25+ persons in the system.

**access_events table (lines 148-150)**:
```sql
CREATE POLICY "Authenticated users can view events" ON access_events
  FOR SELECT USING (auth.role() = 'authenticated');
```
→ Any authenticated user can see every employee's entry/exit history.

**devices table (lines 160-162)**:
```sql
CREATE POLICY "Authenticated users can view devices" ON devices
  FOR SELECT USING (auth.role() = 'authenticated');
```
→ Any authenticated user can see all device IPs, serial numbers, firmware versions.

### Root Cause

There is **no user-data relationship** in the schema:
- `persons` table has no `user_id` column (who created/owns the person)
- `devices` table has no `user_id` column (who registered/owns the device)
- `access_events` has no link to determine which user can see which event

### Impact

- **Physical security risk**: Anyone can see when any employee enters/exits
- **Personal data exposure**: Names, card numbers, departments, face photos
- **Infrastructure mapping**: All device IPs, serial numbers, firmware exposed
- **Compliance risk**: GDPR/privacy laws may apply

## Proposed Solution

### Architecture Change

Add `user_id` ownership columns and scoped RLS policies:

1. **persons**: Add `user_id` column — person created by which user
2. **devices**: Add `user_id` column — device registered by which user
3. **access_events**: Inherit visibility from the associated `person_id` OR `device_serial`

### New RLS Policies

**persons** — Users see only their own persons:
```sql
-- Users can view persons they created
CREATE POLICY "Users view own persons" ON persons
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert persons (user_id set automatically via trigger)
CREATE POLICY "Users can insert own persons" ON persons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins view all persons" ON persons
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

**devices** — Users see only their own devices:
```sql
-- Users can view devices they registered
CREATE POLICY "Users view own devices" ON devices
  FOR SELECT USING (auth.uid() = user_id);

-- Admins and Technicians can view all
CREATE POLICY "Admins and Techs view all devices" ON devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'technician')
    )
  );
```

**access_events** — Users see events from persons/devices they have access to:
```sql
-- Users can view events where they own the person OR own the device
CREATE POLICY "Users view accessible events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM persons WHERE id = person_id AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM devices WHERE serial_number = device_serial AND user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'hr_operator')
    )
  );
```

## Migration Required

New migration file with:
1. Add `user_id UUID REFERENCES auth.users(id)` to `persons` table
2. Add `user_id UUID REFERENCES auth.users(id)` to `devices` table
3. Create trigger to auto-set `user_id` on insert (current user)
4. Backfill existing records with a default user or NULL
5. Drop old overly-permissive policies
6. Create new scoped policies

## Scope

**Files to create/modify**:
- `supabase/migrations/019_add_user_id_to_persons_devices.sql` — new migration
- `supabase/schema.sql` — updated policies (for reference)
- `src/app/api/persons/route.ts` — may need adjustment
- `src/app/api/devices/route.ts` — may need adjustment

**Breaking Changes**:
- Existing applications assuming all persons/devices are visible may break
- Need to verify all queries respect new policies

## Risks

1. **Data access loss**: Existing queries might return empty results if user_id doesn't match
2. **Backfill complexity**: Existing records need valid user_id or default handling
3. **Performance**: Subqueries in RLS policies may slow queries (mitigate with indexes)

## Rollback Plan

If issues arise:
1. Disable new RLS policies
2. Re-enable old permissive policies (for debugging)
3. Fix and re-apply

Alternative: Add feature flag in sync_config to toggle between old/new policies.