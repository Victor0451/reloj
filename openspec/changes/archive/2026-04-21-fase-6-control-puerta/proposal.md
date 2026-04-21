# Proposal: fase-6-control-puerta

## Intent

Wire the command dispatcher into agent startup, fix DoorAction type inconsistency between frontend/agent, and validate the complete door control flow. The dispatcher exists but was **never connected** — it's a one-line import + call to fix a broken flow.

## Scope

### In Scope
- Import `startCommandDispatcher` in `agent/src/index.ts`
- Call it per device alongside heartbeat/event/person sync loops
- Fix `DoorAction` type mismatch (frontend camelCase vs agent lowercase)
- Add conversion layer so ISAPI receives correct casing
- Test full door control flow (command → insert → poll → execute → status update → realtime)

### Out of Scope
- New UI buttons (close/lock) — deferred to Phase 7
- Multiple door support — single door for now
- Door status polling — rely on existing heartbeat

## Capabilities

### New Capabilities
- `door-command-dispatcher`: Agent polls `door_commands` table and executes via ISAPI

### Modified Capabilities
- `door-control`: Type alignment between frontend and agent; conversion to ISAPI lowercase format

## Approach

1. **Wire dispatcher** (agent/src/index.ts): Add import + call `startCommandDispatcher` per device in the device setup loop
2. **Fix type mismatch**: Create shared `DoorAction` type or add conversion in `executeDoorCommand.ts`
3. **Conversion layer**: `alwaysOpen` → `alwaysopen`, `alwaysClose` → `alwaysclose` before ISAPI call
4. **Test**: Send door command via frontend, verify it executes and status updates

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/index.ts` | Modified | Wire `startCommandDispatcher` into device setup loop |
| `src/types/door.types.ts` | Modified | Sync with agent types |
| `agent/src/core/interfaces.ts` | Modified | Sync with frontend types |
| `agent/src/commands/executeDoorCommand.ts` | Modified | Add casing conversion before ISAPI call |
| `agent/src/commands/dispatcher.ts` | Existing | Already exists, just needs to be called |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dispatcher conflicts with other loops | Low | Uses separate interval, registered cleanup |
| Device unreachable during test | Medium | Test with local mock or accessible device |
| Type sync breaks existing code | Low | Incremental changes, test each step |

## Rollback Plan

1. Remove `startCommandDispatcher` import and call from `agent/src/index.ts`
2. Revert type changes in `door.types.ts` and `interfaces.ts`
3. Remove conversion in `executeDoorCommand.ts`
4. Restart agent — dispatcher stays silent without the call

## Dependencies

- Database `door_commands` table exists (confirmed)
- ISAPI `accessControl PTZ` endpoint available (confirmed)
- Supabase realtime configured (confirmed)

## Success Criteria

- [ ] Agent logs show dispatcher started per device
- [ ] Frontend sends `open` command → DB insert → agent polls → executes ISAPI
- [ ] Command status updates to `completed` in DB
- [ ] Realtime updates propagate to frontend
- [ ] No type errors in TypeScript compile