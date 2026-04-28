-- Fix dedup: add unique constraint on (employee_id, event_time, device_serial)
-- This prevents duplicate inserts even if the in-memory dedup fails
-- Also adds device_serial to the dedup key in the event sync loop

-- First, drop existing duplicate records (keep most recent per dedup key)
DELETE FROM access_events a USING (
  SELECT employee_id, event_time, device_serial, MIN(synced_at) as earliest_id
  FROM access_events
  GROUP BY employee_id, event_time, device_serial
  HAVING COUNT(*) > 1
) duplicates
WHERE a.employee_id = duplicates.employee_id
  AND a.event_time = duplicates.event_time
  AND a.device_serial = duplicates.device_serial
  AND a.id != (
    SELECT id FROM access_events a2
    WHERE a2.employee_id = duplicates.employee_id
    AND a2.event_time = duplicates.event_time
    AND a2.device_serial = duplicates.device_serial
    ORDER BY synced_at DESC
    LIMIT 1
  );

-- Add unique constraint to prevent future duplicates
ALTER TABLE access_events ADD CONSTRAINT access_events_employee_time_device_unique UNIQUE (employee_id, event_time, device_serial);