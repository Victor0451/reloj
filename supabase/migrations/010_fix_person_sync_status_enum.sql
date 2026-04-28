-- Fix person_status enum to include sync statuses used by person-sync-loop
-- PostgreSQL requires separate ALTER TYPE statements for each new value

DO $$
BEGIN
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'sync_failed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'sync_dead_letter';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;