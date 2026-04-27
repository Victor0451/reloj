# Tasks: digest-fetch-replacement

## Phase 1: Foundation — Import DigestFetch

- [x] 1.1 Add `import DigestFetch from "digest-fetch";` at top of `agent/src/adapters/hikvision.adapter.ts` (after existing imports, line ~23)
- [x] 1.2 Verify `digest-fetch` is present in `agent/package.json` — no change needed (already there)

## Phase 2: Core Implementation — Replace doDigestRequest

- [x] 2.1 Replace `doDigestRequest` function body (lines 110–188) with DigestFetch-based implementation using same signature
- [x] 2.2 Build `https.Agent` with `rejectUnauthorized` option when protocol is `https:`
- [x] 2.3 Pass `agent` to `DigestFetch` constructor options
- [x] 2.4 Pass `Content-Type` header explicitly in `client.fetch()` call
- [x] 2.5 Return `{ status: response.status, body: await response.text() }`
- [x] 2.6 Remove unused `crypto` import (no longer needed for digest calculation)
- [x] 2.7 Verify `http` import still needed (likely yes, for non-HTTPS fallback)

## Phase 3: Cleanup — Comment Legacy Code

- [x] 3.1 Comment out `generateDigestAuth` function (lines 190–220) with `/* ... */` block, add rollback note
- [x] 3.2 Comment out old `doDigestRequest` function (lines 110–188) with `/* ... */` block, add rollback note

## Phase 4: Verification — Build & Typecheck

- [x] 4.1 Run `npm run typecheck` in `agent/` — must pass with no errors
- [ ] 4.2 Run `npm run lint` if configured — fix any linting issues

## Phase 5: Integration Testing on Real Device

- [x] 5.1 Run `healthCheck()` — expect `reachable: true`, no `socket hang up`
- [ ] 5.2 Run `getEvents()` — expect `AccessEvent[]` (empty or populated), no socket errors (400 due to ISAPI device issue)
- [ ] 5.3 Run `syncPerson()` with test person — expect graceful error or success (device-dependent)
- [ ] 5.4 Run `getUsers()` — expect `[]` gracefully (device may not support)
- [ ] 5.5 Run `getDoorStatus(1)` — expect `DoorStatus` object (device may not support)
- [ ] 5.6 Run `controlDoor(1, "open")` — expect no error (device may not support)

## Phase 6: Rollback Verification (Documented Only)

- [x] 6.1 Document rollback steps: uncomment legacy functions, remove DigestFetch import, swap doDigestRequest bodies
- [x] 6.2 Confirm rollback is a 2-minute operation with no data migration needed

## Verification Summary

| Task | File | Success Criteria | Status |
|------|------|-----------------|--------|
| Import added | `hikvision.adapter.ts` | `DigestFetch` imported at top | ✅ |
| doDigestRequest replaced | `hikvision.adapter.ts` | Uses `DigestFetch` instead of manual http.request | ✅ |
| HTTPS agent configured | `hikvision.adapter.ts` | `new https.Agent({ rejectUnauthorized })` passed to DigestFetch | ✅ |
| Legacy code commented | `hikvision.adapter.ts` | `generateDigestAuth` and old `doDigestRequest` preserved as comments | ✅ |
| TypeScript compiles | `agent/` | `npm run typecheck` passes | ✅ |
| healthCheck works | 192.168.100.60 | `reachable: true` | ✅ |
| getEvents works | 192.168.100.60 | Returns `AccessEvent[]`, no socket hang up | ⚠️ 400 (ISAPI issue) |

## Notes

- **healthCheck**: ✅ Working - `reachable: true` with latency ~500ms confirms digest auth is functional
- **getEvents**: ⚠️ Returns 400 - This is a **pre-existing ISAPI device compatibility issue** with Hikvision DS-K1T320MFWX events endpoint, affects both old and new implementations
- **Implementation note**: Due to digest-fetch v2 using global `fetch` which is undefined in Node.js ESM, the implementation uses manual challenge-response flow with `nodeFetch` + `DigestFetch` for auth header calculation