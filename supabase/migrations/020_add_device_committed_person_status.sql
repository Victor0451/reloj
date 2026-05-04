-- Add device_committed and synced statuses for transactional person sync
-- device_committed: tracks when device sync succeeded but DB update is pending
-- synced: final success state after both device and DB confirm
-- Enables rollback/compensation if DB update fails after device success

DO $$
BEGIN
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'device_committed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'synced';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
