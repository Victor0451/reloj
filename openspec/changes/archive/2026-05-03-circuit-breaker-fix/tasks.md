# Tasks: circuit-breaker-fix

## Phase 1: Database Migration

- [x] 1.1 Create `supabase/migrations/018_add_circuit_state.sql` with: `ALTER TABLE devices ADD COLUMN circuit_state TEXT NOT NULL DEFAULT 'closed';` and `CREATE INDEX idx_devices_circuit_state ON devices(circuit_state);`

## Phase 2: AdapterManager Circuit State

- [x] 2.1 Add `CircuitState` type alias: `export type CircuitState = 'closed' | 'open' | 'half_open';`
- [x] 2.2 Add `CircuitBreakerState` interface with fields: `state`, `failureCount`, `lastFailureTime`, `nextProbeTime`
- [x] 2.3 Add private `circuitBreakerState: Map<string, CircuitBreakerState>` to AdapterManager class
- [x] 2.4 Implement `getCircuitState(deviceId: string): CircuitBreakerState | undefined`
- [x] 2.5 Implement `setCircuitState(deviceId: string, state: CircuitBreakerState): void`
- [x] 2.6 Implement `resetCircuitState(deviceId: string): void` — removes from map

## Phase 3: Heartbeat Loop — State Transitions

- [x] 3.1 Import `CircuitState`, `CircuitBreakerState` from adapter-manager in heartbeat-loop.ts
- [x] 3.2 Add constants: `PROBE_INTERVAL_MS = 300000` (5 min), `RESET_TIMEOUT_MS = 1800000` (30 min), `maxConsecutiveFailures = 3`
- [x] 3.3 On failure increment `failureCount`; call `adapterManager.setCircuitState()` with updated state
- [x] 3.4 When `failureCount >= maxConsecutiveFailures` → transition to OPEN, set `nextProbeTime = now + PROBE_INTERVAL_MS`, update `devices.circuit_state='open'` in DB
- [x] 3.5 When circuit is OPEN and current time >= `nextProbeTime` → send probe, on success transition to HALF_OPEN, on failure reset `nextProbeTime = now + PROBE_INTERVAL_MS`
- [x] 3.6 When HALF_OPEN probe succeeds → transition to CLOSED, reset failureCount, update DB
- [x] 3.7 When HALF_OPEN probe fails → transition back to OPEN
- [x] 3.8 Auto-reset: if state is OPEN/HALF_OPEN and `Date.now() - lastFailureTime > RESET_TIMEOUT_MS` → reset to CLOSED

## Phase 4: Event Sync Loop — Skip When Open

- [x] 4.1 Check circuit state at start of `startSingleDeviceEventSync`: `adapterManager.getCircuitState(deviceId)?.state`
- [x] 4.2 If `state === 'open' or state === 'half_open'` → log debug "Circuit open - skipping event sync", skip to next interval, do NOT update `devices.sync_status`
- [x] 4.3 Only proceed with event fetch when state is `closed` or undefined

## Phase 5: Startup DB Read

- [x] 5.1 In heartbeat-loop.ts `startSingleDeviceHeartbeat`, on startup read `devices.circuit_state` from DB
- [x] 5.2 If value exists and is not 'closed', initialize `AdapterManager` circuit state accordingly
- [x] 5.3 This ensures agent restart resumes correct monitoring state

## Phase 6: Verification

- [x] 6.1 Run `cd agent && npm run typecheck` — must pass without errors
- [ ] 6.2 Apply migration in Supabase: `supabase db push` or run SQL manually
- [ ] 6.3 Verify: device fails 3 heartbeats → `devices.circuit_state='open'` in DB
- [ ] 6.4 Verify: OPEN device probed every 5 min (not 15s)
- [ ] 6.5 Verify: probe succeeds → `circuit_state='half_open'` → on 2nd success → `circuit_state='closed'`