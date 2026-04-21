# Delta for events-realtime

## ADDED Requirements

### Requirement: Supabase Realtime Subscription on access_events

The system SHALL subscribe to INSERT events on the `access_events` table via Supabase Realtime channel `supabase.channel('events')`. When a new INSERT is received, the component MUST trigger a data refresh and prepend the new event to the top of the list.

The subscription MUST be cleaned up on component unmount by calling `channel.unsubscribe()`.

#### Scenario: New event inserted by agent

- GIVEN the events table is displayed with events list
- WHEN a new row is inserted into `access_events` by the bridge agent
- THEN the new event appears at the top of the list within 1 second
- AND a subtle visual highlight (fade-in animation) is shown on the new row

#### Scenario: High volume events — throttle updates

- GIVEN more than 1 new event arrives per second
- WHEN events arrive rapidly via Realtime
- THEN updates are throttled to maximum 1 refresh per second
- AND UI remains responsive without freezing

#### Scenario: Component unmount — subscription cleaned up

- GIVEN the events table component is mounted
- WHEN the component is unmounted (navigation away)
- THEN the Supabase Realtime channel is unsubscribed
- AND no memory leaks or orphaned subscriptions remain

#### Scenario: Realtime connection lost — graceful fallback

- GIVEN the Realtime connection drops (network issue)
- WHEN connection status changes to disconnected
- THEN no error is thrown to user
- AND component continues to function with last known data
- AND manual refresh button is available to reload data