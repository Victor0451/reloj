-- Migration: Add brand field to devices table for multi-device support

-- 1. Add brand column with default
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS brand TEXT NOT NULL DEFAULT 'hikvision';

-- 2. Add model column if not exists (some devices may not have it)
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS model TEXT;

-- 3. Create index for brand queries
CREATE INDEX IF NOT EXISTS idx_devices_brand ON devices(brand);

-- 4. Add comment
COMMENT ON COLUMN devices.brand IS 'Device brand: hikvision, zkteco, suprema, etc.';

-- Supported brands reference:
-- hikvision  - Hikvision DS-K1T320MFWX and similar
-- zkteco     - ZKTeco devices
-- suprema    - Suprema devices
-- Dahua      - Dahua devices
