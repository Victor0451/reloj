# Spec: Circuit Breaker

## Purpose

Implements circuit breaker pattern per device in the agent sync loops to prevent continuous polling of unreachable devices. When a device fails repeatedly, the system transitions to a probe mode with reduced frequency instead of infinite retries at full speed.

## States

| State | Description | Poll Interval |
|-------|-------------|---------------|
| `closed` | Normal operation. Device reachable. | 15s (heartbeat) / 30s (events) |
| `open` | Device unreachable after max failures. Probing at reduced frequency. | 5 min |
| `half_open` | After probe success in OPEN. Testing if device recovered. | 15s |

## Transitions

| From | To | Trigger |
|------|-----|---------|
| closed | open | `consecutiveFailures >= maxConsecutiveFailures` |
| open | half_open | `timeSinceLastFailure >= probeIntervalMs` (5 min) |
| half_open | open | Probe request fails |
| half_open | closed | Probe request succeeds |
| any | closed | `timeSinceLastFailure >= resetTimeoutMs` (30 min, auto-reset) |

## Requirements

### Requirement: Circuit state tracking

The system MUST track circuit state per deviceId in the AdapterManager with fields:
- `state`: 'closed' | 'open' | 'half_open'
- `failureCount`: number of consecutive failures
- `lastFailureTime`: timestamp of last failure

### Requirement: State persistence

The system MUST persist circuit state to `devices.circuit_state` column so that agent restarts can resume correct monitoring state.

### Requirement: Heartbeat respects circuit state

When circuit state is `open`:
- The heartbeat loop MUST skip the standard 15s interval
- The heartbeat loop MUST instead poll at probe interval (5 min)
- If probe succeeds, transition to `half_open`
- If probe fails, remain in `open` and reset probe timer

### Requirement: Event sync respects circuit state

When circuit state is `open` or `half_open`:
- The event sync loop MUST skip fetching events (no DB writes)
- This prevents unnecessary network traffic to failing device

### Requirement: Automatic reset

The system MUST automatically close the circuit if the device has been in `open` or `half_open` state for more than 30 minutes, regardless of failure count.

### Requirement: Initial state on startup

On agent startup, for each device:
- Read `devices.circuit_state` from DB
- If state is `open` or `half_open`, respect reduced poll interval
- Resume normal monitoring if state is `closed`

## Scenarios

### Scenario: Normal operation (circuit closed)

```
Given a device with circuit_state="closed" and consecutiveFailures=0
When heartbeat interval triggers
Then send heartbeat to device
And if successful, log debug message "Device online"
And update last_seen_at in DB
And keep circuit_state="closed"
```

### Scenario: Failure increments counter (circuit stays closed)

```
Given a device with circuit_state="closed" and consecutiveFailures=1
When heartbeat fails
Then increment failureCount to 2
And log warning "Heartbeat failed (2/3)"
And if failureCount < maxConsecutiveFailures, keep circuit_state="closed"
```

### Scenario: Circuit opens after max failures

```
Given a device with circuit_state="closed" and consecutiveFailures=2
When heartbeat fails (3rd consecutive)
Then set circuit_state="open"
And set failureCount=0
And update devices.circuit_state="open" in DB
And log warn "Device marked OFFLINE: [serial]"
And set next probe time to now + 5 min
```

### Scenario: Open circuit probed at reduced frequency

```
Given a device with circuit_state="open"
When heartbeat interval triggers before probe time
Then skip heartbeat (do nothing)
When heartbeat interval triggers after probe time
Then send single probe request
If probe succeeds:
  Set circuit_state="half_open"
  Set failureCount=0
  Update devices.circuit_state="half_open"
  Resume normal 15s polling
If probe fails:
  Keep circuit_state="open"
  Set next probe time to now + 5 min
  Increment failureCount
```

### Scenario: Half-open recovers to closed

```
Given a device with circuit_state="half_open"
When probe heartbeat succeeds
Then set circuit_state="closed"
And set failureCount=0
And update devices.circuit_state="closed"
And update devices.status="online"
And log info "Device recovered: [serial]"
And resume normal 15s polling
```

### Scenario: Half-open fails and returns to open

```
Given a device with circuit_state="half_open"
When probe heartbeat fails
Then set circuit_state="open"
And increment failureCount
And update devices.circuit_state="open"
And set next probe time to now + 5 min
```

### Scenario: Auto-reset after 30 minutes

```
Given a device with circuit_state="open" and lastFailureTime more than 30 min ago
When any heartbeat trigger occurs
Then set circuit_state="closed"
And set failureCount=0
And update devices.circuit_state="closed"
And log info "Circuit auto-reset after timeout"
And resume normal polling
```

### Scenario: Event sync skips when circuit open

```
Given a device with circuit_state="open"
When event sync interval triggers
Then skip event fetch entirely
And do not update devices.sync_status
And log debug "Circuit open - skipping event sync"
```

## Acceptance Criteria

- [ ] Device fails 3 consecutive heartbeats → circuit_state="open" in DB
- [ ] OPEN device heartbeat polled every 5 min, not 15s
- [ ] OPEN device event sync skipped entirely (no DB writes)
- [ ] Probe succeeds → circuit_state="half_open" → 15s polling resumes
- [ ] Probe fails → circuit_state="open" → 5 min probe interval continues
- [ ] Device offline > 30 min → auto-reset to closed
- [ ] Agent restart reads DB state → correctly sets initial circuit state
- [ ] `npm run typecheck` passes for agent