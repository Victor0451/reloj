# Proposal: circuit-breaker-fix

## Intent

Implementar Circuit Breaker en los sync loops del agent para evitar que un dispositivo caído reciba requests infinitos. Currently, when a device goes offline the agent continues polling every 30s/60s indefinitely, wasting resources and potentially worsening network conditions.

## Scope

### In Scope
- Add circuit breaker state tracking per device in `AdapterManager`
- Modify `heartbeat-loop.ts` to open circuit after `maxConsecutiveFailures` and probe at reduced frequency
- Modify `event-sync-loop.ts` to respect circuit breaker state and skip sync when open
- Add `circuit_state` field to `devices` table to persist state across agent restarts
- Create migration for new column

### Out of Scope
- Frontend UI changes (device status display)
- Notification/alerts when circuit opens
- Multi-brand adapter support (only Hikvision tested initially)

## Capabilities

### New Capabilities
- `circuit-breaker`: Standard circuit breaker pattern per device with states: CLOSED (normal), OPEN (failing), HALF_OPEN (probing)

### Modified Capabilities
- `sync-status-indicators`: May need to surface circuit state in status (existing spec: `openspec/specs/sync-status-indicators/spec.md`)

## Approach

1. **AdapterManager** — add `circuitBreakerState` map storing `{failureCount, state, lastFailureTime}` per deviceId
2. **Heartbeat loop** — on consecutive failure threshold, transition to OPEN state, poll at 5min instead of 15s
3. **Event sync loop** — if circuit is OPEN, skip sync cycle entirely (no DB writes)
4. **HALF_OPEN probe** — after 5min in OPEN, send single probe request; on success close circuit, on failure reopen
5. **DB persistence** — `devices.circuit_state` column stores 'closed'|'open'|'half_open' for restart recovery

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/core/adapter-manager.ts` | Modified | Add circuit state tracking per device |
| `agent/src/sync/heartbeat-loop.ts` | Modified | Implement state transitions and probe mode |
| `agent/src/sync/event-sync-loop.ts` | Modified | Skip sync when circuit OPEN |
| `supabase/migrations/` | New | Add `circuit_state` column to devices table |
| `agent/src/sync/dedup.ts` | None | Not used in single-device mode |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Device temporarily unreachable (flaky network) | Medium | Use `maxConsecutiveFailures = 3` before opening circuit |
| Circuit stuck OPEN if device truly down for days | Low | Auto-reset after 30min regardless |
| State not persisted — agent restart loses circuit state | Medium | Persist to DB column, read on startup |

## Rollback Plan

1. Delete migration `0XX_add_circuit_state.sql`
2. Revert `adapter-manager.ts` to remove `circuitBreakerState` map
3. Revert heartbeat and event sync loops to original polling behavior
4. Restart agent — no persistent changes remain

## Dependencies

- Supabase migration must be applied before agent code deployment
- Agent deployment must be atomic (if code deployed before migration, device state shows "unknown" until migration runs)

## Success Criteria

- [ ] Device that fails 3 consecutive heartbeats enters OPEN state (no events polled for 5min)
- [ ] OPEN device probed every 5min instead of 15s
- [ ] Device responds to probe → transitions to HALF_OPEN → on success → CLOSED
- [ ] Agent restart reads circuit state from DB → correctly resumes monitoring
- [ ] `npm run typecheck` passes for agent