-- Phase 1: Add person_id foreign key to access_events
-- Links access events to persons table via employee_id lookup
-- This enables event-driven person sync from minor=38 events

-- Add person_id column (UUID, nullable for now - events before migration have no person)
ALTER TABLE access_events ADD COLUMN person_id UUID;

-- Create index for person lookup queries
CREATE INDEX idx_access_events_person_id ON access_events(person_id);

-- Add foreign key constraint (deferrable initially to avoid blocking existing data)
ALTER TABLE access_events
ADD CONSTRAINT fk_access_events_person_id
FOREIGN KEY (person_id)
REFERENCES persons(id)
ON DELETE SET NULL;

-- Also add employee_id index if it doesn't exist (commonly used for joins)
CREATE INDEX IF NOT EXISTS idx_access_events_employee_id ON access_events(employee_id);