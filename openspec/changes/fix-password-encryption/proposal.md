# Proposal: fix-password-encryption

## Intent

Make `device_password_encrypted` truthful: passwords MUST be encrypted at rest and decrypted only inside trusted server/agent code before device auth.

## Scope

### In Scope
- Encrypt on device create/update and agent/device-service reads.
- Add shared crypto format, env-based key loading, and legacy plaintext compatibility.
- Cover existing server-side consumers that currently pass `device_password_encrypted` directly to adapters.

### Out of Scope
- Changing adapter auth flow or device firmware.
- Re-encrypting with KMS/HSM-managed keys.

## Capabilities

### New Capabilities
- `device-credential-encryption`: Encrypt/decrypt device credentials, key validation, and legacy plaintext migration behavior.

### Modified Capabilities
- None

## Approach

**Option 1 — AES-256-GCM in app/agent shared utility**: fastest, portable across Next.js + agent, supports authenticated encryption and versioned payloads; rotation needs explicit key strategy.

**Option 2 — Supabase Vault**: centralizes storage, but the separate agent must call Supabase for every decrypt/read and couples runtime behavior to Vault APIs and permissions.

**Option 3 — Hybrid envelope + shared key**: app encrypts before persist, all trusted runtimes decrypt with the same env key, using a versioned payload for future rotation. Best fit for split runtimes.

**Recommended**: Option 3 with AES-256-GCM payloads like `v1:<iv>:<tag>:<ciphertext>`. Add a shared utility used by `src/actions/devices.ts`, `agent/src/index.ts`, and other server-side readers verified in `src/lib/device-connectivity.ts`, `src/actions/sync.ts`, `src/actions/device-diagnostics.ts`, and `src/app/api/devices/[id]/health/route.ts`. During rollout, accept legacy plaintext on read, log it, and re-save encrypted on next update/backfill.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/devices.ts` | Modified | Encrypt before insert/update |
| `agent/src/index.ts` | Modified | Decrypt before bootstrapping loops |
| `src/lib/**`, `src/actions/**`, `src/app/api/devices/[id]/health/route.ts` | Modified | Replace direct password reads with shared decrypt helper |
| `src/lib` or `shared` crypto module | New | AES-GCM utility + env key handling |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Partial rollout breaks auth | High | Shared helper + update all readers in same change |
| Missing/mismatched key between app and agent | Med | Startup validation and clear fail-fast errors |
| Existing plaintext rows become unusable | Med | Legacy read compatibility + backfill path |

## Rollback Plan

Revert crypto reads/writes, keep legacy plaintext read path active, redeploy app+agent together, and restore prior behavior for new writes until key/config issues are fixed.

## Dependencies

- Shared secret env available to both Next.js and agent runtimes.

## Success Criteria

- [ ] New and updated device passwords are stored as versioned ciphertext, not plaintext.
- [ ] Agent and server-side health/sync flows decrypt successfully without adapter changes.
- [ ] Legacy plaintext rows continue working until migrated.
- [ ] Missing/invalid key fails with actionable errors, not silent auth failures.
