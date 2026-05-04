# Digest Nonce Replay Prevention Specification

## Purpose

Prevent replay attacks against HTTP Digest authentication by tracking used nonces in an in-memory Set with bounded memory consumption. This is a NEW capability added to the Hikvision ISAPI adapter.

## Assumptions

- Node.js single-threaded runtime; Set operations are thread-safe for synchronous access
- Nonces are string values extracted from WWW-Authenticate header's `nonce` parameter
- Memory bound of ~1000 entries is acceptable for the nonce replay table

---

## Requirements

### Requirement: Nonce Tracker Bounded Memory

The system SHALL bound memory usage of the nonce tracker to approximately 1000 entries.

| Parameter | Value |
|-----------|-------|
| `MAX_NONCE_ENTRIES` | 1000 |
| `PRUNE_BATCH_RATIO` | 0.50 |

The nonce tracker SHALL be implemented as a `Set<string>` at module level in `hikvision.adapter.ts`.

---

### Requirement: Replay Detection

The system SHALL detect and reject replayed nonces.

When `isNonceValid(nonce: string): boolean` is called:

1. If `nonce` is already in `recentNonces` Set → return `false` (rejected as replay)
2. If `nonce` is not in `recentNonces` Set → add `nonce` to `recentNonces` and return `true` (valid)

#### Scenario: Fresh nonce accepted

- GIVEN a nonce tracker initialized as `Set<string>`
- WHEN `isNonceValid("abc123")` is called
- THEN `"abc123"` is NOT in `recentNonces`
- AND `"abc123"` is added to `recentNonces`
- AND `true` is returned

#### Scenario: Replay attempt rejected

- GIVEN `recentNonces = Set{"abc123"}`
- WHEN `isNonceValid("abc123")` is called
- THEN `"abc123"` IS in `recentNonces`
- AND `recentNonces` remains unchanged
- AND `false` is returned

---

### Requirement: Periodic Pruning

The system SHALL automatically prune oldest entries when the nonce set exceeds the memory bound.

When `isNonceValid()` is called and `recentNonces.size > MAX_NONCE_ENTRIES` (1000):

1. Calculate `pruneCount = Math.floor(recentNonces.size * PRUNE_BATCH_RATIO)` (removes oldest 50%)
2. Remove `pruneCount` oldest entries from `recentNonces`
3. Proceed with nonce validation

#### Scenario: Pruning triggers at threshold

- GIVEN `recentNonces` contains exactly 1001 entries
- WHEN `isNonceValid("new-nonce")` is called
- THEN `pruneCount = Math.floor(1001 * 0.50) = 500` entries are removed
- AND `recentNonces` now contains approximately 501 entries
- AND `"new-nonce"` is added to `recentNonces`

---

### Requirement: Integration in doDigestRequest

The system SHALL validate nonces before making authenticated requests after a 401 response.

When `doDigestRequest()` receives a 401 and parses `www-authenticate`:

1. `client.parseAuth()` extracts the `nonce` from the challenge
2. `isNonceValid(nonce)` SHALL be called
3. If `isNonceValid(nonce)` returns `false` → return error `{ status: 401, body: "Nonce replay detected" }`
4. If `isNonceValid(nonce)` returns `true` → proceed with authenticated request

#### Scenario: Valid nonce proceeds to authenticated request

- GIVEN a 401 response with `www-authenticate: Digest nonce="xyz789"`
- WHEN `doDigestRequest()` calls `client.parseAuth()` and extracts `nonce="xyz789"`
- AND `isNonceValid("xyz789")` returns `true`
- THEN the authenticated request SHALL be made with the Authorization header
- AND the response is returned to caller

#### Scenario: Replay detected returns error

- GIVEN a 401 response with `www-authenticate: Digest nonce="xyz789"`
- WHEN `doDigestRequest()` calls `client.parseAuth()` and extracts `nonce="xyz789"`
- AND `isNonceValid("xyz789")` returns `false` (nonce was already used)
- THEN no authenticated request SHALL be made
- AND an error object `{ status: 401, body: "Nonce replay detected" }` is returned
- AND no crash or unhandled exception occurs

---

### Requirement: Graceful Degradation

The system SHALL handle replay detection failures gracefully without crashing.

When a replay is detected:

1. The error `{ status: 401, body: "Nonce replay detected" }` SHALL be returned
2. The original digest-fetch behavior SHALL NOT be silently bypassed
3. No uncaught exceptions or promise rejections SHALL occur

#### Scenario: Graceful error handling on replay

- GIVEN a replayed nonce is detected
- WHEN `isNonceValid()` returns `false`
- THEN `doDigestRequest()` returns `{ status: 401, body: "Nonce replay detected" }`
- AND the caller receives a well-formed error response
- AND the process continues normally without crash

---

## Success Criteria

- [ ] Replay of captured Authorization header is rejected with 401 and "Nonce replay detected"
- [ ] Legitimate requests with fresh nonces succeed
- [ ] Memory usage remains bounded (max ~1000 nonces tracked)
- [ ] No regressions in existing digest auth functionality
- [ ] Pruning occurs automatically when threshold exceeded