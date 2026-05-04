# Design: Fix Door State Verification

## Technical Approach

After `controlDoor` (ISAPI) succeeds, verify the physical door reached the expected state by polling `getDoorStatus`. This catches scenarios where the command was accepted but the door mechanism failed to move.

```
executeDoorCommand()
  └── controlDoor()  ← ISAPI command (current behavior)
  └── [NEW] wait 500ms
  └── [NEW] getDoorStatus()  ← verify physical state
        └── match → return success
        └── mismatch → wait 500ms, retry getDoorStatus
              └── match → return success
              └── mismatch → return failed
```

## Architecture Decisions

### Decision: Verify state, not command retry

**Choice**: Retry the *verification* (getDoorStatus) once, not the control command
**Alternatives considered**: Retry `controlDoor` on mismatch (rejected — device already processed the command; resending may cause inconsistent state)
**Rationale**: The spec explicitly says "retry once" after the *first* verification fails. The ISAPI command succeeded; we're confirming the physical outcome.

### Decision: Use 500ms settle delay

**Choice**: `setTimeout(resolve, 500)` before first verification
**Alternatives considered**: 0ms (immediate), 1000ms (safer but slower)
**Rationale**: Door mechanisms have mechanical inertia. 500ms is a practical balance — enough for most doors to settle, not so long as to frustrate users.

### Decision: Single retry for verification

**Choice**: Max 1 retry (2 total getDoorStatus calls: initial + retry)
**Alternatives considered**: No retry (too fragile), 3 retries (diminishing returns, adds latency)
**Rationale**: If the door didn't reach expected state after 1s total (500ms + first check + 500ms + second check), something is genuinely wrong. Further retries won't help.

### Decision: Use `core/interfaces.ts` DoorStatus as canonical type

**Choice**: Import `DoorStatus` from `core/interfaces` (not from `isapi/methods`)
**Alternatives considered**: Use ISAPI's `DoorStatus` directly
**Rationale**: `core/interfaces` is the project-wide abstraction layer. Using it consistently avoids type drift between adapter and ISAPI implementations. The ISAPI types are an implementation detail.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/commands/executeDoorCommand.ts` | Modify | Add state verification after `controlDoor` succeeds |
| `agent/src/isapi/methods.ts` | No change | Already exports `getDoorStatus`, type is compatible |

## Action-to-State Mapping

| Action | Expected Door Status |
|--------|---------------------|
| `open` | `open` |
| `close` | `closed` |
| `alwaysopen` | `open` |
| `alwaysclose` | `closed` |

**Note**: `DoorCommand.action` does not include `unlock`. The spec references unlock but it is not a valid action in this codebase. Treating unlock as `open` is a reasonable fallback if unlock is added later.

## Edge Cases

| Case | Handling |
|------|----------|
| `getDoorStatus` returns null/undefined | Return `failed` with error message including context |
| Action has no state mapping | Return `failed` with "unknown action" error (fail-safe) |
| `controlDoor` throws | Existing behavior: return `failed` (no verification needed) |
| Door status is `alarm` | Treat as mismatch — alarm is not a valid end state for open/close commands |

## Data Flow

```
executeDoorCommand(command)
  → withRetry(controlDoor(config, doorNo, action))  ← existing
  → setTimeout(500ms)
  → getDoorStatus(config, doorNo)  ← verify
      ├── status === expected → return "success"
      └── status !== expected
          → setTimeout(500ms)
          → getDoorStatus(config, doorNo)  ← retry
              ├── status === expected → return "success"
              └── status !== expected → return "failed"
```

## Open Questions

- [ ] The spec mentions `unlock` action but `DoorCommand.action` type does not include it. Should unlock be added as a valid action, or is this spec drift from a different context?
- [ ] Should `alarm` status during verification be treated as a distinct failure reason (vs. generic mismatch)? This affects logging and user-facing error messages.

## Risks

- **Timing assumption**: 500ms may be insufficient for some door hardware. Monitor production logs for intermittent verification failures.
- **State volatility**: If the door is manually operated during the verification window, we may report false failures. This is acceptable for now; physical access control should not rely on automated verification alone.

## Next Step

Ready for `sdd-tasks` to break down implementation into actionable items.