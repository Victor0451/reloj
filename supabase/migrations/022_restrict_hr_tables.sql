-- Migration 022: Restrict HR tables and door_commands to authorized roles
-- Purpose: Replace permissive RLS policies with role-based policies using helper functions

-- ============================================
-- time_templates
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage time_templates" ON time_templates;
CREATE POLICY "admins and HR can manage time_templates" ON time_templates
  FOR ALL USING (is_admin_or_hr());

-- ============================================
-- schedule_assignments
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage schedule_assignments" ON schedule_assignments;
CREATE POLICY "admins and HR can manage schedule_assignments" ON schedule_assignments
  FOR ALL USING (is_admin_or_hr());

-- ============================================
-- holidays
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage holidays" ON holidays;
CREATE POLICY "admins and HR can manage holidays" ON holidays
  FOR ALL USING (is_admin_or_hr());

-- ============================================
-- attendance_overrides
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can manage attendance_overrides" ON attendance_overrides;
CREATE POLICY "admins and HR can manage attendance_overrides" ON attendance_overrides
  FOR ALL USING (is_admin_or_hr());

-- ============================================
-- door_commands
-- ============================================
-- Replace authenticated user policies with role-restricted policies
DROP POLICY IF EXISTS "Authenticated users can create door commands" ON door_commands;
DROP POLICY IF EXISTS "Authenticated users can view door commands" ON door_commands;

CREATE POLICY "authorized users can send door commands" ON door_commands
  FOR INSERT WITH CHECK (can_send_door_command());

CREATE POLICY "authorized users can view door commands" ON door_commands
  FOR SELECT USING (can_send_door_command());

CREATE POLICY "authorized users can update door commands" ON door_commands
  FOR UPDATE USING (can_send_door_command());
