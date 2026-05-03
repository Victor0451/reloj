-- ============================================
-- Migration: 019_add_user_id_to_persons_devices
-- Fix RLS Privacy Breach (#23)
-- ============================================
-- Description:
--   Adds user_id ownership columns to persons and devices tables,
--   creates SECURITY DEFINER trigger to auto-set user_id on INSERT,
--   replaces permissive "authenticated" RLS policies with scoped policies.
--
-- Backfill: Existing records assigned to first admin user (by created_at ASC)
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Add user_id column to persons table
-- ============================================

ALTER TABLE persons
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for RLS ownership check performance
CREATE INDEX IF NOT EXISTS idx_persons_user_id ON persons(user_id);

-- ============================================
-- STEP 2: Add user_id column to devices table
-- ============================================

ALTER TABLE devices
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for RLS ownership check performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);

-- ============================================
-- STEP 3: Create set_user_id_on_insert() trigger function
-- ============================================
-- SECURITY DEFINER: runs with creator's privileges (not calling user)
-- SET search_path TO auth: prevents schema spoofing attacks
--
-- Logic: If user_id not explicitly provided, auto-set to auth.uid()
-- This allows:
--   - Regular users: user_id defaults to their UID on INSERT
--   - Admins: can explicitly set user_id to another user's UID
--
-- BEFORE INSERT timing: Must be BEFORE so WITH CHECK policy sees the value
-- ============================================

CREATE OR REPLACE FUNCTION set_user_id_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO auth;

-- ============================================
-- STEP 4: Create BEFORE INSERT triggers on both tables
-- ============================================

-- Trigger for persons table
DROP TRIGGER IF EXISTS set_persons_user_id_on_insert ON persons;
CREATE TRIGGER set_persons_user_id_on_insert
  BEFORE INSERT ON persons
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_on_insert();

-- Trigger for devices table
DROP TRIGGER IF EXISTS set_devices_user_id_on_insert ON devices;
CREATE TRIGGER set_devices_user_id_on_insert
  BEFORE INSERT ON devices
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_on_insert();

-- ============================================
-- STEP 5: Backfill existing records to first admin user
-- ============================================
-- Strategy: Assign to first admin user (by created_at ASC) for deterministic backfill
-- If no admin exists, user_id remains NULL (admins can still see via role-based policy)
-- ============================================

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

-- ============================================
-- STEP 6: Drop old permissive policies
-- ============================================

-- persons table: Drop "Authenticated users can view persons"
DROP POLICY IF EXISTS "Authenticated users can view persons" ON persons;

-- devices table: Drop "Authenticated users can view devices"
DROP POLICY IF EXISTS "Authenticated users can view devices" ON devices;

-- access_events table: Drop "Authenticated users can view events"
DROP POLICY IF EXISTS "Authenticated users can view events" ON access_events;

-- ============================================
-- STEP 7: Create new scoped policies
-- ============================================

-- ---- PERSONS POLICIES ----

-- Policy: Users view own persons (ownership-based)
DROP POLICY IF EXISTS "Users view own persons" ON persons;
CREATE POLICY "Users view own persons" ON persons
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins view all persons (role-based exemption)
DROP POLICY IF EXISTS "Admins view all persons" ON persons;
CREATE POLICY "Admins view all persons" ON persons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Policy: Users can insert own persons (WITH CHECK auto-set via trigger)
DROP POLICY IF EXISTS "Users can insert own persons" ON persons;
CREATE POLICY "Users can insert own persons" ON persons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: HR Operators and Admins can manage persons (existing policy, kept)
DROP POLICY IF EXISTS "HR and Admins can manage persons" ON persons;
CREATE POLICY "HR and Admins can manage persons" ON persons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr_operator')
    )
  );

-- ---- DEVICES POLICIES ----

-- Policy: Users view own devices (ownership-based)
DROP POLICY IF EXISTS "Users view own devices" ON devices;
CREATE POLICY "Users view own devices" ON devices
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins and Techs view all devices (role-based exemption)
DROP POLICY IF EXISTS "Admins and Techs view all devices" ON devices;
CREATE POLICY "Admins and Techs view all devices" ON devices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'technician')
    )
  );

-- Policy: Users can insert own devices (WITH CHECK auto-set via trigger)
DROP POLICY IF EXISTS "Users can insert own devices" ON devices;
CREATE POLICY "Users can insert own devices" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Admins and Technicians can manage devices (existing policy, kept)
DROP POLICY IF EXISTS "Admins and Technicians can manage devices" ON devices;
CREATE POLICY "Admins and Technicians can manage devices" ON devices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'technician')
    )
  );

-- ---- ACCESS_EVENTS POLICIES ----

-- Policy: Users view events from their persons (via persons.user_id join)
DROP POLICY IF EXISTS "Users view own person events" ON access_events;
CREATE POLICY "Users view own person events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM persons
      WHERE id = access_events.person_id
      AND user_id = auth.uid()
    )
  );

-- Policy: Users view events from their devices (via devices.user_id join)
DROP POLICY IF EXISTS "Users view own device events" ON access_events;
CREATE POLICY "Users view own device events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE serial_number = access_events.device_serial
      AND user_id = auth.uid()
    )
  );

-- Policy: Admins and HR Ops view all events (role-based exemption)
DROP POLICY IF EXISTS "Admins and HR Ops view all events" ON access_events;
CREATE POLICY "Admins and HR Ops view all events" ON access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'hr_operator')
    )
  );

-- Policy: System can insert events (agent bridge - existing, kept)
DROP POLICY IF EXISTS "System can insert events" ON access_events;
CREATE POLICY "System can insert events" ON access_events
  FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 8: Add index for access_events device_serial join
-- ============================================
-- Required for Policy 4.2: Users view events from their devices
-- The EXISTS subquery joins on device_serial
-- ============================================

CREATE INDEX IF NOT EXISTS idx_access_events_device_serial
ON access_events(device_serial);

-- ============================================
-- STEP 9: Ensure RLS is enabled on modified tables
-- ============================================
-- RLS should already be enabled per schema.sql, but ensuring here for safety
-- ============================================

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- COMMIT or ROLLBACK
-- ============================================

COMMIT;
