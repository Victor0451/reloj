# Delta for events-export

## ADDED Requirements

### Requirement: exportEventsCsv Server Action

The system MUST provide an `exportEventsCsv(filter)` server action that returns a CSV string (not a file download) with the following behavior:

- **Same filter options as listEvents**: `dateFrom`, `dateTo`, `eventType`, `employeeId`
- **CSV columns**: `event_time` (ISO 8601), `employee_id`, `person_name`, `event_type`, `verify_mode`, `device_name`
- **No row limit** — exports all matching events
- **Person name fallback**: If join yields no match, person_name column shows `employee_id` value or empty string

The returned CSV string SHALL include a header row and use comma delimiter with proper escaping for fields containing commas or quotes.

#### Scenario: Export all events

- GIVEN no filter provided
- WHEN `exportEventsCsv({})` is called
- THEN returns CSV with header row: event_time,employee_id,person_name,event_type,verify_mode,device_name
- AND contains all events in database
- AND ordered by event_time DESC

#### Scenario: Export filtered events

- GIVEN `dateFrom` = "2026-04-01", `eventType` = "check_in"
- WHEN `exportEventsCsv({dateFrom, eventType})` is called
- THEN CSV contains only events matching both filters
- AND header row is present

#### Scenario: Export with no matches

- GIVEN filter matches no events
- WHEN `exportEventsCsv(filter)` is called
- THEN returns CSV string with only the header row
- AND no data rows are present