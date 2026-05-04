# Design: Password Encryption

## Technical Approach

Encrypt `device_password_encrypted` at every write boundary and decrypt only inside trusted server/agent code. Use a shared Node `crypto` helper imported by Next.js server code and the standalone agent so both runtimes follow one payload contract, one key-loading rule, and one legacy-plaintext fallback.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Crypto algorithm | AES-256-GCM, Supabase Vault, custom hashing | AES-256-GCM | Authenticated encryption fits reversible device auth and works in both Node runtimes without extra network hops. |
| Shared module location | `src/lib`, root package, `agent/src` | `agent/src/crypto/device-credentials.ts` | App already imports agent code; agent cannot safely import app `src` because its `tsconfig` is rooted at `agent/src`. |
| Key config | Single raw key env, per-row DB key, env key ring | Env key ring + active key id | Satisfies current single-key rollout while supporting spec-required `key_id` selection during rotation. |
| Migration | Big-bang SQL rewrite, lazy only, hybrid | Hybrid: lazy compatibility + explicit backfill script | Avoids downtime and keeps old rows working while giving ops a deterministic cleanup path. |

## Data Flow

Write path:

`Dashboard action -> plaintext validation/test -> encrypt(password) -> Supabase devices.device_password_encrypted`

Read path:

`DB row -> trusted runtime helper -> decrypt or legacy-pass-through -> adapter/isapi config`

For updates without a new password, `src/actions/devices.ts` MUST decrypt the stored value before connection testing; otherwise the current code would send ciphertext to the adapter.

## File Changes

| File | Action | Description |
|---|---|---|
| `agent/src/crypto/device-credentials.ts` | Create | AES-256-GCM encrypt/decrypt, env key loading, payload parsing, typed errors, legacy detection. |
| `src/actions/devices.ts` | Modify | Encrypt on insert/update; decrypt existing stored password when reusing credentials for connection tests. |
| `agent/src/sync/registerDevice.ts` | Modify | Encrypt `config.devicePassword` before upsert so agent-side registration is also safe at rest. |
| `agent/src/index.ts` | Modify | Decrypt before bootstrapping heartbeat/event/person loops; fail fast on invalid key/payload. |
| `src/lib/device-connectivity.ts` | Modify | Decrypt before batch health checks. |
| `src/actions/sync.ts` | Modify | Decrypt before building adapters and ISAPI config. |
| `src/actions/device-diagnostics.ts` | Modify | Decrypt before adapter diagnostics and probe configs. |
| `src/app/api/devices/[id]/health/route.ts` | Modify | Decrypt before health check; keep response secret-free. |
| `scripts/sync-cron.ts` | Modify | Decrypt before cron-driven adapter calls. |
| `scripts/test-event-sync.ts` | Modify | Decrypt before local test sync to preserve developer tooling. |
| `.env.example` / `agent/.env.example` | Modify | Document shared crypto envs and rotation format. |
| `scripts/backfill-device-password-encryption.ts` | Create | Idempotent migration script for plaintext rows. |

## Interfaces / Contracts

```ts
type EncryptedPassword = `v1:${string}:${string}:${string}:${string}`
// v1:<keyId>:<iv>:<tag>:<ciphertext> (base64url segments)
```

- `encryptDevicePassword(plaintext): EncryptedPassword`
- `decryptDevicePassword(value): { plaintext: string; legacy: boolean; keyId?: string }`
- If value does not start with `v1:`, treat it as legacy plaintext.
- If `v1:` exists but parsing/auth fails, throw a typed decrypt error and stop the auth flow.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Round-trip encrypt/decrypt, malformed payloads, wrong key id, missing env, legacy plaintext fallback | Add focused TypeScript tests where runner exists; otherwise validate with narrow script coverage during apply/verify. |
| Integration | `createDevice`, `updateDeviceConnection`, health/sync/diagnostic reads | Exercise server paths against seeded rows containing encrypted and legacy plaintext values. |
| E2E | Dashboard create/update and agent startup | Manual operational check because no E2E runner is configured. |

## Migration / Rollout

Keys live only in env, never in Supabase. Use `DEVICE_CREDENTIAL_ACTIVE_KEY_ID` plus `DEVICE_CREDENTIAL_KEYS_JSON` (JSON map of key ids to base64 32-byte keys) in both app and agent runtimes. Writes always use the active key id; reads select the key by payload `keyId`.

Rollout order: set envs in both runtimes, deploy app+agent together, keep legacy read fallback on, then run `scripts/backfill-device-password-encryption.ts`. The script selects device rows, skips values already matching `v1:`, encrypts plaintext rows, and updates only changed records so reruns are safe.

## Open Questions

- [ ] None blocking; final env variable names should match ops conventions during apply.
