# Delta for dashboard

## MODIFIED Requirements

### Requirement: Recent Events Widget

(Previously: Placeholder with "Sin eventos" empty state)

The system SHALL display the last 10 access events in the dashboard's recent events section, with the following behavior:

- **Query**: `access_events` ordered by `event_time` DESC, LIMIT 10
- **Join**: LEFT JOIN with `persons` on `employee_id` to show person name
- **Display**: Each row shows: event_time (formatted), person_name (or employee_id fallback), event_type badge
- **Empty state**: Shows `EmptyState` component with Shield icon when no events exist
- **Navigation**: Clicking any event row navigates to `/dashboard/events` page with appropriate filter pre-selected

The dashboard recent events section SHALL auto-refresh via the same Supabase Realtime subscription used by the events-list capability.

#### Scenario: Dashboard with events

- GIVEN at least 1 event exists in `access_events`
- WHEN dashboard page loads
- THEN recent events widget shows up to 10 events
- AND each event displays event_time, person_name, and event_type
- AND events are ordered newest first

#### Scenario: Dashboard with no events

- GIVEN `access_events` table is empty
- WHEN dashboard page loads
- THEN EmptyState is displayed with icon Shield, title "Sin eventos registrados aún"
- AND description mentions bridge agent setup

#### Scenario: New event arrives — list updates automatically

- GIVEN dashboard is displayed with existing events
- WHEN a new event is inserted into `access_events`
- THEN the recent events list updates to include the new event at top
- AND list remains capped at 10 items (oldest drops off)

#### Scenario: Click event — navigates to events page

- GIVEN dashboard recent events shows events
- WHEN user clicks on an event row
- THEN browser navigates to `/dashboard/events` page
- AND URL includes filter params for that specific employee_id and date range