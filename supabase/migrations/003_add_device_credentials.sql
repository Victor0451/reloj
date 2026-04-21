-- Migration: Add device credentials and sync tracking

-- 1. Add credential columns to devices
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS device_username TEXT,
ADD COLUMN IF NOT EXISTS device_password_encrypted TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS sync_error TEXT,
ADD COLUMN IF NOT EXISTS sync_last_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_events_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_event_synced_at TIMESTAMPTZ;

-- 2. Create sync_logs table
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  events_processed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_devices_sync_status ON devices(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_device_id ON sync_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at DESC);

-- 4. Add updated_at to devices if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE devices ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- 5. Create trigger function
CREATE OR REPLACE FUNCTION public.handle_device_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger
DROP TRIGGER IF EXISTS set_updated_at_devices ON devices;
CREATE TRIGGER set_updated_at_devices
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_device_updated_at();
