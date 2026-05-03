# Delta for sync-status-indicators

## MODIFIED Requirements

### Requirement: Sync status is also shown in edit dialog (added in prior change)

(Previously: Sync status is also shown in edit dialog — no mention of circuit_state)

The requirement text remains unchanged. This delta adds a new **scenario** to surface circuit breaker state alongside sync status indicators.

### Scenario: Device circuit state shown in status banner

```
Given a person linked to device with circuit_state="open" or "half_open"
When the user opens the person in edit dialog
Then the status banner SHOULD display:
  "⚡ Device unreachable (circuit [open/half_open])"
And if circuit_state="open", show estimated recovery time
And if circuit_state="half_open", show "Testing connection..."
```

## ADDED Requirements

### Requirement: Circuit state color coding

The system MUST display circuit breaker state using color-coded badges in the device status section:
- `closed` → green badge "Connected"
- `open` → red badge "Disconnected (circuit open)"
- `half_open` → amber badge "Testing connection"

---

*This delta adds circuit breaker state to the existing sync-status-indicators spec. No existing scenarios or acceptance criteria are modified.*