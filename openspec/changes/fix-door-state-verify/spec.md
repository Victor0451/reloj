# Door State Verification — Specification

## Purpose

Ensure that door commands actually achieve their intended state by verifying the physical door status after ISAPI command execution. Without verification, a command may silently fail (mechanism jam, hardware issue) and the system would incorrectly report success.

## Requirements

### Requirement: Door state verification after ISAPI controlDoor

After a successful ISAPI `controlDoor` call completes (HTTP 200), the system **MUST** wait 500ms for the door mechanism to settle, then call `getDoorStatus` to read the actual physical door state.

#### Scenario: Open command results in open door — success

- GIVEN a door command with `action = "open"` has been sent via ISAPI and returned HTTP 200
- WHEN the system waits 500ms and calls `getDoorStatus`
- THEN the returned door status **MUST** be `open`
- AND the command **MUST** be marked as `completed`

#### Scenario: Close command results in closed door — success

- GIVEN a door command with `action = "close"` has been sent via ISAPI and returned HTTP 200
- WHEN the system waits 500ms and calls `getDoorStatus`
- THEN the returned door status **MUST** be `closed`
- AND the command **MUST** be marked as `completed`

#### Scenario: Open command results in wrong state but retry succeeds

- GIVEN a door command with `action = "open"` has been sent via ISAPI and returned HTTP 200
- AND after 500ms, `getDoorStatus` returns `closed` (state mismatch)
- WHEN the system waits 500ms and calls `getDoorStatus` again (retry)
- THEN if the second call returns `open`, the command **MUST** be marked as `completed`

#### Scenario: Open command stays in wrong state after retry — failure

- GIVEN a door command with `action = "open"` has been sent via ISAPI and returned HTTP 200
- AND after 500ms, `getDoorStatus` returns `closed` (state mismatch)
- AND after a second 500ms wait and retry, `getDoorStatus` still returns `closed`
- THEN the command **MUST** be marked as `failed`
- AND the error message **MUST** include: expected `open`, got `closed`, retry count: 1

### Requirement: getDoorStatus failure causes command failure

If the verification call to `getDoorStatus` fails (network error, device unreachable), the command **MUST** be marked as `failed` with an error message describing the verification failure.

#### Scenario: getDoorStatus fails after successful ISAPI call

- GIVEN a door command has been sent via ISAPI and returned HTTP 200
- WHEN the system attempts to call `getDoorStatus` for verification
- AND the call throws an error (device unreachable)
- THEN the command **MUST** be marked as `failed`
- AND the error message **MUST** indicate verification was impossible

### Requirement: ISAPI failure skips verification

If the initial ISAPI `controlDoor` call fails (non-200 response, connection error), the existing error handling applies and **NO** state verification is performed.

#### Scenario: ISAPI call fails — no verification

- GIVEN a door command's ISAPI `controlDoor` call throws an exception or returns non-200
- THEN the command **MUST** be marked as `failed` immediately
- AND no state verification **MUST** be attempted

### Requirement: Unlock action state mapping

For `action = "unlock"` commands, the expected verification state **MUST** be `unlocked` (or equivalent Hikvision representation). If the adapter's `DoorStatusType` does not include `unlocked`, the system **SHOULD** treat `open` as an acceptable proxy for `unlocked` on hardware that does not distinguish these states.

#### Scenario: Unlock command verification on compatible hardware

- GIVEN a door command with `action = "unlock"` has been sent via ISAPI and returned HTTP 200
- WHEN the system waits 500ms and calls `getDoorStatus`
- THEN if `DoorStatusType` includes `unlocked`, the door status **MUST** be `unlocked`
- OR if `DoorStatusType` does not include `unlocked`, the door status **MUST** be `open`
- AND the command **MUST** be marked as `completed`

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| 500ms settle delay | Mechanical doors need time to complete movement; 500ms is sufficient for most hardware |
| 1 retry attempt | Single retry handles transient state-read timing issues without excessive delay |
| DoorStatus type compatibility | Use `getDoorStatus` from the adapter — returns `DoorStatus` interface from `agent/src/core/interfaces.ts` |
| Unlock → open fallback | Some Hikvision devices don't distinguish unlock vs open; treat open as acceptable proxy |
| Failure includes context | Error message must state expected vs actual state and retry count for debugging |

## Out of Scope

- Verification for `alwaysopen` / `alwaysclose` actions (these are持久 states, not single movements)
- Adding `unlock` to the `DoorAction` type if not already present (only if adapter supports it)
- Retry logic for the initial ISAPI call (existing `withRetry` in `executeDoorCommand.ts` already handles this)