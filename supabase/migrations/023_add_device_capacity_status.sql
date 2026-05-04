-- Issue #30: Person sync doesn't check Hikvision device capacity before creating persons
-- Add device_capacity_status column to track device capacity state

ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_capacity_status TEXT DEFAULT 'unknown'
CHECK (device_capacity_status IN ('ok', 'near_full', 'full', 'unknown'));