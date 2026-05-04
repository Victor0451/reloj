# Tasks: Fix Digest Auth Nonce Replay Vulnerability

## Phase 1: Implementation

- [ ] 1.1 Add module-level nonce tracker constants after line 75 in `agent/src/adapters/hikvision.adapter.ts`:
  - `recentNonces = new Set<string>()`
  - `MAX_NONCE_ENTRIES = 1000`
  - `PRUNE_BATCH_RATIO = 0.5`
- [ ] 1.2 Implement `isNonceValid(nonce: string): boolean` function:
  - Return `false` if nonce already in `recentNonces` (replay detected)
  - Prune oldest 50% entries when `size >= MAX_NONCE_ENTRIES` before adding
  - Add nonce to `recentNonces` and return `true` on valid
- [ ] 1.3 Implement `extractNonceFromWwwAuth(wwwAuth: string): string | null` helper using regex `/nonce="([^"]+)"/`
- [ ] 1.4 Add nonce validation in `doDigestRequest()` after line 210 (`client.parseAuth()`):
  - Call `extractNonceFromWwwAuth(wwwAuth)` to get nonce
  - If nonce exists and `!isNonceValid(nonce)`, return `{ status: 401, body: "Nonce replay detected" }`
- [ ] 1.5 Run `tsc --noEmit` to verify TypeScript compilation

## Phase 2: Testing (Manual Verification)

- [ ] 2.1 Start agent and verify it works with Hikvision device (normal authentication flow)
- [ ] 2.2 Make two identical requests to test replay rejection (if nonce replay window accessible)
- [ ] 2.3 Verify no crashes or errors in logs during normal operation
- [ ] 2.4 Monitor memory usage of `recentNonces` Set under load

## Phase 3: Verification

- [ ] 3.1 Verify nonce validation code compiles without errors
- [ ] 3.2 Verify agent still authenticates to Hikvision device successfully
- [ ] 3.3 Verify error handling returns 401 with "Nonce replay detected" on replay

## Implementation Order

1. **Phase 1** first — adds the nonce tracking infrastructure and functions. Tasks 1.1 → 1.2 → 1.3 are sequential (dependencies). Task 1.4 integrates into `doDigestRequest()` and 1.5 validates.
2. **Phase 2** runs the agent and confirms the changes don't break existing auth behavior. Manual testing because no test runner is present per `openspec/config.yaml`.
3. **Phase 3** confirms the implementation meets the spec criteria: compilation, auth works, replay rejected.

## File Reference

- `agent/src/adapters/hikvision.adapter.ts` — single file being modified
  - Lines 75–86: new nonce tracker + `isNonceValid()` function
  - Lines 88–91: `extractNonceFromWwwAuth()` helper
  - Lines 210–213: nonce validation integration in `doDigestRequest()`