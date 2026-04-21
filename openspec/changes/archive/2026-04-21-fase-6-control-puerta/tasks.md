# Tasks: fase-6-control-puerta

## Phase 1: Wire Command Dispatcher (CRITICAL — Foundation)

- [x] 1.1 Add `startCommandDispatcher` import in `agent/src/index.ts` (import from dispatcher module)
- [x] 1.2 Call `startCommandDispatcher` for each device inside the device setup loop (alongside heartbeat, event sync, person sync)
- [x] 1.3 Register the cleanup function returned by `startCommandDispatcher` with `registerCleanup()`
- [x] 1.4 Verify agent starts without errors (check logs for dispatcher initialization messages)

## Phase 2: Fix Door Action Type Mismatch (Bug Fix)

- [ ] 2.1 Audit `DoorAction` type across files:
  - `src/types/door.types.ts` — defines `DoorAction = 'open' | 'close' | 'alwaysOpen' | 'alwaysClose'`
  - `agent/src/commands/executeDoorCommand.ts` — uses `"open" | "close" | "alwaysopen" | "alwaysclose"`
- [ ] 2.2 Normalize naming convention (recommend lowercase with camelCase aliases: `alwaysopen` / `alwaysclose`)
- [ ] 2.3 Add action normalization in `executeDoorCommand.ts` (lowercase + strip whitespace before ISAPI call)
- [ ] 2.4 Verify ISAPI receives correct casing for all 4 actions: `open`, `close`, `alwaysopen`, `alwaysclose`

## Phase 3: Test End-to-End Flow (Integration)

- [ ] 3.1 Start agent locally (or verify startup logs when device is unreachable)
- [ ] 3.2 Insert a door command via frontend UI — insert into `door_commands` with status `pending`
- [ ] 3.3 Verify flow end-to-end: INSERT → agent polls → ISAPI exec → status update → realtime broadcast → toast notification
- [ ] 3.4 Test error path: simulate ISAPI failure, verify status updates to `failed` and error toast displays

## Phase 4: UI Polish (Optional)

- [ ] 4.1 Add "Cerrar Puerta" button in door control UI if action not already present
- [ ] 4.2 Verify button is disabled during `pending` state (prevent double-send)
- [ ] 4.3 Display current door state from heartbeat when available

## Implementation Order

Wire the dispatcher (Phase 1) FIRST — without it, no door commands execute. Then fix the type mismatch (Phase 2) to ensure consistent action strings. Phase 3 validates the full flow. Phase 4 is optional polish if time permits.

**Note**: Device must be reachable for full E2E test (Phase 3). If device is offline, test will timeout at 30s per spec.
