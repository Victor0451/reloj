# Delta for events-list

## ADDED Requirements

### Requirement: listEvents Server Action

The system MUST provide a `listEvents(filter, cursor)` server action that queries the `access_events` table with the following behavior:

- **Filter options**: `dateFrom` (start date), `dateTo` (end date), `eventType`, `employeeId` (partial match)
- **Cursor**: Uses `event_time` DESC as cursor; cursor value is the `event_time` of the last item from previous page
- **Default limit**: 50 events per page
- **Join**: LEFT JOIN with `persons` on `employee_id` to resolve `person_name`
- **Ordering**: `event_time` DESC (newest first)

The server action SHALL return an object with shape: `{ events: EventWithPerson[], nextCursor: string | null, prevCursor: string | null, total: number }`.

#### Scenario: List all events (no filter)

- GIVEN no filter parameters provided
- WHEN `listEvents({}, null)` is called
- THEN returns first 50 events ordered by event_time DESC
- AND `nextCursor` is set if more pages exist
- AND `prevCursor` is null

#### Scenario: Filter by date range

- GIVEN `dateFrom` = "2026-04-01" and `dateTo` = "2026-04-21"
- WHEN `listEvents({dateFrom, dateTo}, null)` is called
- THEN returns only events where event_time >= dateFrom AND event_time <= dateTo (inclusive)
- AND ordering remains event_time DESC

#### Scenario: Filter by event type

- GIVEN `eventType` = "check_in"
- WHEN `listEvents({eventType}, null)` is called
- THEN returns only events where event_type = 'check_in'

#### Scenario: Search by employee ID (partial match)

- GIVEN `employeeId` = "1005"
- WHEN `listEvents({employeeId}, null)` is called
- THEN returns events where employee_id LIKE '%1005%'
- AND match is case-insensitive

#### Scenario: Pagination — next page

- GIVEN cursor from last event of page 1 (event_time = "2026-04-15T10:30:00")
- WHEN `listEvents(filter, cursor)` is called with page 2 cursor
- THEN returns events with event_time < cursor value
- AND ordering is event_time DESC

#### Scenario: Pagination — previous page

- GIVEN cursor from first event of page 2 (event_time = "2026-04-16T10:30:00")
- WHEN `listEvents(filter, cursor)` is called with prevCursor
- THEN returns events with event_time > cursor value
- AND ordering is event_time DESC

#### Scenario: Empty result

- GIVEN filter matches no events
- WHEN `listEvents(filter, null)` is called
- THEN returns events array empty
- AND `nextCursor` and `prevCursor` are null