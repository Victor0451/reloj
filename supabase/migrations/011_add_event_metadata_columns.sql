-- Add missing event metadata columns to access_events
-- These are used by the event sync loop but weren't in the original schema

ALTER TABLE access_events ADD COLUMN IF NOT EXISTS device_serial_no TEXT;
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS door_no INTEGER;
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS card_reader_no INTEGER;
ALTER TABLE access_events ADD COLUMN IF NOT EXISTS label TEXT;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_access_events_door_no ON access_events(door_no);
CREATE INDEX IF NOT EXISTS idx_access_events_card_reader_no ON access_events(card_reader_no);
CREATE INDEX IF NOT EXISTS idx_access_events_label ON access_events(label);