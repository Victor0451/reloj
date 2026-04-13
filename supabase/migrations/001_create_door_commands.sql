-- Migration: Create door_commands table
-- Purpose: Queue for remote door open/close commands
-- Run this in Supabase Dashboard → SQL Editor

-- Table
CREATE TABLE IF NOT EXISTS public.door_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL,
  device_serial TEXT REFERENCES public.devices(serial_number) ON DELETE SET NULL,
  door_no INTEGER NOT NULL DEFAULT 1,
  action TEXT NOT NULL CHECK (action IN ('open', 'close', 'alwaysopen', 'alwaysclose')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for efficient polling: fetch pending commands ordered by creation time
CREATE INDEX IF NOT EXISTS idx_door_commands_status_created
  ON public.door_commands (status, created_at DESC);

-- Index for device lookup
CREATE INDEX IF NOT EXISTS idx_door_commands_device_serial
  ON public.door_commands (device_serial, status);

-- Row Level Security
ALTER TABLE public.door_commands ENABLE ROW LEVEL SECURITY;

-- System (service_role) can insert, update, and read
-- Note: service_role bypasses RLS, but policies are defined for completeness
CREATE POLICY "System can manage door commands"
  ON public.door_commands
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read door commands
CREATE POLICY "Authenticated users can view door commands"
  ON public.door_commands
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Authenticated users can create door commands (for UI trigger)
CREATE POLICY "Authenticated users can create door commands"
  ON public.door_commands
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Comment
COMMENT ON TABLE public.door_commands IS 'Queue for remote door open/close commands. Agent polls this table for pending commands.';
