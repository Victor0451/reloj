# Proposal: digest-fetch-replacement

## Intent

Replace custom digest authentication in `agent/src/adapters/hikvision.adapter.ts` with the `digest-fetch` library to fix "socket hang up" errors when connecting to Hikvision DS-K1T320MFWX devices. The current custom `digestRequest` implementation is incompatible with Hikvision's ISAPI — curl works but Node.js HTTP client fails with socket hang up.

## Scope

### In Scope
- Replace `digestRequest` / `doDigestRequest` / `generateDigestAuth` functions in `agent/src/adapters/hikvision.adapter.ts` with `DigestFetch` client
- Maintain same public interface (health check, event sync, person sync unchanged)
- Ensure `rejectUnauthorized: false` for self-signed certs on 192.168.100.60

### Out of Scope
- Other adapters or functionality
- Changes to agent bridge or Supabase sync logic

## Capabilities

### Modified Capabilities
- `hikvision-adapter` (existing): replacing digest auth implementation only — same interface, same behavior

## Approach

1. Import `DigestFetch` from `digest-fetch` (already in `agent/package.json`)
2. Create `DigestFetch` client per device instance with `rejectUnauthorized: false`
3. Replace raw HTTP calls in `digestRequest` with `digestFetchClient.fetch()` calls
4. Keep same function signature so all callers (`getDeviceInfo`, `getEvents`, `syncPerson`, etc.) are unchanged
5. Retain retry logic for retryable errors (socket hang up, ETIMEDOUT, ECONNRESET)

**Device config**: 192.168.100.60, credentials `admin / evol@2601`, self-signed cert

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/adapters/hikvision.adapter.ts` | Modified | Replace custom digest with DigestFetch |
| `agent/package.json` | None | `digest-fetch@^2.0.0` already present |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking existing health check / event sync | Low | Same interface; wrapper function preserves behavior |
| Certificate rejection if `rejectUnauthorized` wrong | Medium | Explicitly set to `false` for this device |
| `digest-fetch` doesn't handle Hikvision quirks | Low | Keep retry logic; can fallback to custom impl if needed |

## Rollback Plan

Revert `agent/src/adapters/hikvision.adapter.ts` to pre-change state (custom `digestRequest` implementation). No dependency changes needed since `digest-fetch` is already in package.json. Rollback restores custom implementation which causes socket hang up — this is intentional: if rollback is needed, the issue requires deeper investigation.

## Dependencies

- `digest-fetch@^2.0.0` — already in `agent/package.json`

## Success Criteria

- [ ] Health check succeeds on DS-K1T320MFWX (192.168.100.60) via Node.js
- [ ] Event sync returns events (not empty + no socket errors)
- [ ] Person sync (PUT) works if device supports it
- [ ] `npm run typecheck` passes
- [ ] Socket hang up errors no longer appear in logs