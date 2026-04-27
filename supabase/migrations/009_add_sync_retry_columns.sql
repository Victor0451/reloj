-- Add sync retry tracking columns to persons table
-- and dead-letter status for failed syncs that won't be retried

-- Add sync_attempts and sync_error columns
ALTER TABLE persons ADD COLUMN IF NOT EXISTS sync_attempts INTEGER DEFAULT 0;
ALTER TABLE persons ADD COLUMN IF NOT EXISTS sync_error TEXT;

-- Add sync_dead_letter to person_status enum if not already present
DO $$
BEGIN
  -- Try to add the new value (will fail gracefully if already exists)
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'sync_dead_letter';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
