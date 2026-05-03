# Design: circuit-breaker-fix

## Technical Approach

Implement circuit breaker pattern per device in the agent sync loops. State machine: CLOSED → OPEN → HALF_OPEN → CLOSED. State persisted to `devices.circuit_state` column for restart recovery. Probing at 5min interval when OPEN instead of continuous 15s polling.

## Architecture Decisions

### Decision: CircuitBreakerState lives in AdapterManager, not in sync loops

**Choice**: Store circuit state in `AdapterManager` as a `Map<deviceId, CircuitBreakerState>`
**Alternatives considered**: Store in sync loops directly (duplicated state), store in DB only (too slow)
**Rationale**: Single source of truth for device state; sync loops query the same state; allows `AdapterManager.getCircuitState()` for external inspection

### Decision: Probe interval of 5 minutes when circuit OPEN

**Choice**: `PROBE_INTERVAL_MS = 5 * 60 * 1000` (300000ms)
**Alternatives considered**: 1min (too aggressive), 10min (too slow to detect recovery)
**Rationale**: Balance between responsiveness (device back online detected within 5min) and resource savings (not hammering failing device every 15s)

### Decision: Auto-reset after 30 minutes regardless of state

**Choice**: `RESET_TIMEOUT_MS = 30 * 60 * 1000`
**Alternatives considered**: No auto-reset (circuit stuck forever), shorter timeout (defeats purpose)
**Rationale**: Device might be down for extended period (maintenance, power issue); after 30min assume transient issue and let normal polling resume to detect recovery

### Decision: event-sync-loop skips entirely when circuit OPEN

**Choice**: No event fetch, no DB writes when circuit is OPEN or HALF_OPEN
**Alternatives considered**: Fetch with shorter timeout and catch failures gracefully
**Rationale**: Simpler — if device is unreachable, no events to fetch; saves network calls; event sync recovery handled by heartbeat probe cycle

## Data Flow

```
heartbeat-loop                          AdapterManager
      │                                      │
      ▼                                      ▼
┌─────────────────────────────────────────────────────────┐
│  CircuitBreakerState Map                                │
│  {                                                     │
│    "device-uuid": {                                    │
│      state: "closed" | "open" | "half_open",          │
│      failureCount: number,                            │
│      lastFailureTime: Date,                           │
│      nextProbeTime: Date                              │
│    }                                                   │
│  }                                                     │
└─────────────────────────────────────────────────────────┘
      ▲                                      │
      │                                      │
      │  getCircuitState(deviceId)           │
      │  setCircuitState(deviceId, state)     │
      │                                      │
      └──────────────────────────────────────┘
                    ▲
                    │
              sync loops
              query state
              before each
              operation
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/018_add_circuit_state.sql` | Create | Adds `circuit_state` column (default 'closed') and index |
| `agent/src/core/adapter-manager.ts` | Modify | Add `CircuitBreakerState` interface and `circuitBreakerState` Map; add `getCircuitState()` and `setCircuitState()` methods |
| `agent/src/sync/heartbeat-loop.ts` | Modify | Import `CircuitBreakerState`; add state transition logic; add probe interval when OPEN |
| `agent/src/sync/event-sync-loop.ts` | Modify | Check circuit state before syncing; skip if OPEN or HALF_OPEN |

## Interfaces / Contracts

```typescript
// agent/src/core/adapter-manager.ts

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: Date;
  nextProbeTime: Date;
}

// On AdapterManager:
private circuitBreakerState: Map<string, CircuitBreakerState> = new Map();

getCircuitState(deviceId: string): CircuitBreakerState | undefined;
setCircuitState(deviceId: string, state: CircuitBreakerState): void;
resetCircuitState(deviceId: string): void;
```

```sql
-- supabase/migrations/018_add_circuit_state.sql
ALTER TABLE devices ADD COLUMN circuit_state TEXT NOT NULL DEFAULT 'closed';
CREATE INDEX idx_devices_circuit_state ON devices(circuit_state);
```

## Migration / Rollback

**Migration** (`018_add_circuit_state.sql`):
1. Add `circuit_state TEXT NOT NULL DEFAULT 'closed'` column
2. Add index on `circuit_state` for efficient queries
3. Default 'closed' ensures existing devices start in normal operation

**Rollback**:
1. Drop column: `ALTER TABLE devices DROP COLUMN circuit_state;`
2. Remove index: `DROP INDEX idx_devices_circuit_state;`
3. Revert adapter-manager.ts and sync loops to previous versions

**Ordering constraint**: Migration must be applied BEFORE agent code deployment. If agent deploys first, `circuit_state` column doesn't exist → SQL errors. Recommend: run migration via Supabase dashboard or `supabase db push` before restarting agent.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | CircuitBreakerState transitions | Test state machine: closed→open at 3 failures, open→half_open after 5min, etc. |
| Unit | AdapterManager circuit state methods | Mock existing tests, add new assertions for getCircuitState/setCircuitState |
| Integration | Heartbeat loop with failing device | Not feasible without mock device; focus on typecheck + manual testing |

## Open Questions

- [ ] Should we surface circuit_state to frontend UI? (Currently out of scope per proposal, but could be added later)
- [ ] Should we log circuit state transitions to sync_logs for debugging? (Currently logging only at WARN level for OPEN, INFO for CLOSED recovery)

None that block implementation.