-- Add columns for better attendance event tracking
ALTER TABLE access_events
  ADD COLUMN IF NOT EXISTS device_serial_no TEXT,
  ADD COLUMN IF NOT EXISTS door_no INTEGER,
  ADD COLUMN IF NOT EXISTS card_reader_no INTEGER,
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Add indexes for the new columns (common query patterns)
CREATE INDEX IF NOT EXISTS idx_access_events_label ON access_events(label);
CREATE INDEX IF NOT EXISTS idx_access_events_card_reader_no ON access_events(card_reader_no);