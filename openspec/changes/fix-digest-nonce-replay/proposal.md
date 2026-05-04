# Proposal: Fix Digest Auth Nonce Replay Vulnerability

## Intent

Fix a security vulnerability in the Hikvision ISAPI adapter's digest authentication where replay attacks are possible because nonce freshness is not validated. An attacker intercepting a 401 response could replay the Authorization header within the device's nonce validity window.

## Scope

### In Scope
- Add module-level nonce tracker using a `Set<string>` in `hikvision.adapter.ts`
- Implement replay detection (reject already-used nonces)
- Add periodic pruning of stale nonces to bound memory usage
- Integrate nonce validation into `doDigestRequest()`

### Out of Scope
- Database-backed nonce persistence (pure in-memory only)
- nonce-count (`nc`) tracking per RFC 2617
- Max-age enforcement from server (requires server timestamp parsing)
- Changes to other adapters

## Capabilities

### New Capabilities
- `digest-nonce-replay-prevention`: In-memory replay attack prevention using Set-based nonce tracking with bounded memory usage.

### Modified Capabilities
- None at spec level (implementation-only change to existing digest auth behavior).

## Approach

1. Add module-level `recentNonces = new Set<string>()` and `NONCE_MAX_AGE_MS = 300000` (5 min) constants
2. Create `isNonceValid(nonce: string): boolean` function that:
   - Checks if nonce already used → reject replay
   - Adds nonce to set on valid use
   - Prunes oldest 50% of entries when size > 1000
3. Call `isNonceValid()` after `client.parseAuth()` extracts the nonce from www-authenticate
4. If nonce invalid (replay detected), return error with appropriate status

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/adapters/hikvision.adapter.ts` | Modified | Add nonce replay prevention to `doDigestRequest()` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Memory leak if pruning fails | Low | Size-bounded Set with automatic pruning at 1000 entries |
| False positives under concurrent requests | Low | Set-based tracking handles concurrent access in single-threaded Node |
| Performance overhead | Low | O(1) Set operations, pruning only when size threshold hit |

## Rollback Plan

Remove the nonce validation checks in `doDigestRequest()` and return `true` always. Alternatively, comment out the `isNonceValid()` call and clear the `recentNonces` set initialization to restore original behavior.

## Dependencies

- `digest-fetch` library must continue to expose nonce via challenge parsing

## Success Criteria

- [ ] Replay of captured Authorization header is rejected with error
- [ ] Legitimate requests with fresh nonces succeed
- [ ] Memory usage remains bounded (max ~1000 nonces tracked)
- [ ] No regressions in existing digest auth functionality
