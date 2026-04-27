# Delta for hikvision-adapter

## Intent

Replace custom digest authentication in `agent/src/adapters/hikvision.adapter.ts` with the `digest-fetch` library to fix "socket hang up" errors on DS-K1T320MFWX devices. The custom `digestRequest` implementation is incompatible with Hikvision's ISAPI — curl works but Node.js HTTP client fails with socket hang up.

---

## MODIFIED Requirements

### Requirement: HTTP Client with Digest Authentication

The system SHALL use the `digest-fetch` library to perform HTTP requests with Digest authentication against Hikvision ISAPI endpoints.

(Previously: Custom `doDigestRequest` / `generateDigestAuth` implementation using Node.js `http`/`https` modules)

#### Scenario: GET request with digest auth

- GIVEN a Hikvision device at `https://192.168.100.60` with valid credentials
- WHEN the adapter calls `healthCheck()`
- THEN the system SHALL use `DigestFetch` client to perform a GET request to `/ISAPI/System/deviceInfo`
- AND the system SHALL automatically handle 401 challenge-response with Digest auth
- AND return `{ status: number, body: string }` with the response body

#### Scenario: POST request with JSON body and digest auth

- GIVEN a Hikvision device with valid credentials
- WHEN the adapter calls `getEvents({ startTime, endTime })`
- THEN the system SHALL use `DigestFetch` client to POST JSON to `/ISAPI/AccessControl/AcsEvent?format=json`
- AND automatically handle Digest auth challenge-response
- AND return parsed `AccessEvent[]`

#### Scenario: HTTPS with self-signed certificate

- GIVEN a Hikvision device with self-signed certificate
- WHEN any HTTP request is made
- THEN the system SHALL set `rejectUnauthorized: false` on the HTTPS agent
- AND complete the TLS handshake without rejecting the cert

#### Scenario: Retry on transient socket errors

- GIVEN a Hikvision device that responds slowly or drops connections
- WHEN a request fails with `socket hang up`, `ETIMEDOUT`, `ECONNRESET`, or `ENOTFOUND`
- THEN the system SHALL retry up to 2 times with exponential backoff (1s, 2s)
- AND throw the error if all retries fail

---

## ADDED Requirements

### Requirement: API Contract Compatibility

The system SHALL maintain the same `digestRequest()` function signature so callers require no changes.

The function MUST accept: `(url, username, password, method, body?, contentType?, rejectUnauthorized?)` and return `Promise<{ status: number; body: string }>`.

#### Scenario: Interface compatibility

- GIVEN existing calls to `digestRequest` throughout the adapter
- WHEN the implementation is replaced with `DigestFetch`
- THEN all callers SHALL receive the same `{ status, body }` response shape
- AND no caller code changes are required

---

## REMOVED Requirements

### Requirement: Custom Digest Auth Implementation

(Reason: Replaced by `digest-fetch` library — `doDigestRequest` and `generateDigestAuth` functions are removed)

Functions removed:
- `doDigestRequest()` — raw Node.js HTTP/HTTPS implementation
- `generateDigestAuth()` — manual Digest MD5 calculation
- Manual 401 challenge-response handling in `doDigestRequest`

---

## Acceptance Criteria

| ID | Criterion | Validated By |
|----|-----------|--------------|
| AC1 | `healthCheck()` returns `reachable: true` on 192.168.100.60 | Manual or integration test |
| AC2 | `getEvents()` returns `AccessEvent[]` (empty or populated) — no socket hang up | Manual test |
| AC3 | `getUsers()` returns `[]` gracefully when endpoint not supported | Manual test |
| AC4 | `syncPerson()` returns error gracefully when device returns 4xx/5xx | Manual test |
| AC5 | `npm run typecheck` passes with no errors | CI gate |

---

## Test Scenarios

| # | Scenario | Expected Result |
|---|----------|-----------------|
| T1 | `healthCheck()` on DS-K1T320MFWX | `{ reachable: true, latency: <5000ms }` |
| T2 | `getEvents()` returns array | `AccessEvent[]` (can be empty, no socket errors) |
| T3 | `getUsers()` on unsupported device | `[]` (not throw) |
| T4 | `syncPerson()` on unsupported device | `{ success: false, error: string }` (not throw) |
| T5 | HTTPS with `rejectUnauthorized: false` | TLS handshake succeeds on self-signed cert |
| T6 | Retry on `socket hang up` | Retries 2x, then throws with original error |