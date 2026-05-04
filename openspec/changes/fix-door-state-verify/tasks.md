# Tasks: Fix Door State Verification

## Phase 1: Foundation

- [ ] D1. Read `executeDoorCommand.ts` to understand current flow
- [ ] D1.1 Locate file in the codebase and review controlDoor/getDoorStatus usage

## Phase 2: Core Implementation

- [ ] D2. Add 500ms settle delay after successful ISAPI call
- [ ] D2.1 Add `setTimeout(resolve, 500)` after `controlDoor` success
- [ ] D3. Call getDoorStatus to verify actual door state
- [ ] D3.1 Call `adapter.getDoorStatus()` after settle delay
- [ ] D4. Add retry once if state mismatch
- [ ] D4.1 Implement retry with second `setTimeout(500)` and second `getDoorStatus` call
- [ ] D5. Return failure with context if retry also fails
- [ ] D5.1 Return error with expected vs actual state info

## Phase 3: Verification

- [ ] D6. Verify TypeScript compiles
- [ ] D6.1 Run `npx tsc --noEmit` and fix any type errors

## Implementation Order

1. **D1** — Read the file first; all other tasks depend on understanding the current flow
2. **D2-D3** — Add settle delay and first state check
3. **D4-D5** — Add retry logic and failure handling
4. **D6** — Final compilation check

## Files

- `executeDoorCommand.ts` — Primary file to modify