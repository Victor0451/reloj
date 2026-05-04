-- Migration 021: Add RLS helper functions for role-based access control
-- Purpose: Centralized role check functions used by RLS policies

-- is_admin_or_hr()
-- Returns true if the current user has admin or hr_operator role
CREATE OR REPLACE FUNCTION is_admin_or_hr()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'hr_operator')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- can_send_door_command()
-- Returns true if the current user has admin or technician role
CREATE OR REPLACE FUNCTION can_send_door_command()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'technician')
  );
$$ LANGUAGE sql SECURITY DEFINER;
