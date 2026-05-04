# Tasks: Password Encryption

## Phase 1: Crypto Foundation + Config Contract

- [ ] 1.1 Create `agent/src/crypto/device-credentials.ts` with `encryptDevicePassword` and `decryptDevicePassword` using AES-256-GCM and payload format `v1:<keyId>:<iv>:<tag>:<ciphertext>`.
- [ ] 1.2 Add key-loading helpers in `agent/src/crypto/device-credentials.ts` for `DEVICE_CREDENTIAL_ACTIVE_KEY_ID` and `DEVICE_CREDENTIAL_KEYS_JSON`, with typed config/decrypt errors.
- [ ] 1.3 Implement payload parser/validator + key selection by `keyId` and legacy fallback (`!value.startsWith("v1:")`) in `agent/src/crypto/device-credentials.ts`.
- [ ] 1.4 Update `.env.example` and `agent/.env.example` documenting key ring JSON format, active key id, and rotation behavior.

## Phase 2: Write-Boundary Encryption (Persistence Layer)

- [ ] 2.1 Modify `src/actions/devices.ts` create-device flow to encrypt plaintext before writing `device_password_encrypted`.
- [ ] 2.2 Modify `src/actions/devices.ts` password-update flow to always re-encrypt with current active key when new password is provided.
- [ ] 2.3 Modify `agent/src/sync/registerDevice.ts` to encrypt `config.devicePassword` before upsert into devices table.
- [ ] 2.4 In `src/actions/devices.ts`, when updating without new password, decrypt stored value before connection testing to avoid sending ciphertext.

## Phase 3: Trusted Runtime Decryption (Read Paths)

- [ ] 3.1 Modify `agent/src/index.ts` to decrypt credentials before heartbeat/event/person loop adapter bootstrap; fail fast on decrypt/config errors.
- [ ] 3.2 Modify `src/lib/device-connectivity.ts` to decrypt credentials before batch health checks.
- [ ] 3.3 Modify `src/actions/sync.ts` and `src/actions/device-diagnostics.ts` to decrypt before adapter/ISAPI config construction.
- [ ] 3.4 Modify `src/app/api/devices/[id]/health/route.ts` to decrypt before auth and ensure response never includes plaintext.
- [ ] 3.5 Modify `scripts/sync-cron.ts` and `scripts/test-event-sync.ts` to decrypt before adapter calls.

## Phase 4: Migration + Operational Hardening

- [ ] 4.1 Create `scripts/backfill-device-password-encryption.ts` to scan device rows, skip `v1:` payloads, encrypt legacy plaintext, and update only changed rows.
- [ ] 4.2 Make backfill idempotent and rotation-safe by reusing shared crypto helper and key-id contract.
- [ ] 4.3 Add structured logging/messages in migration and runtime call sites for actionable key missing/tampered payload failures.

## Phase 5: Verification by Spec Scenarios

- [ ] 5.1 Add focused crypto verification (script or existing runner) for round-trip, malformed payload, wrong key id, missing env, and legacy fallback in `agent/src/crypto/device-credentials.ts`.
- [ ] 5.2 Validate integration scenarios in create/update/health/sync/diagnostics paths using encrypted and legacy rows (manual + script checks where applicable).
- [ ] 5.3 Perform manual E2E checks: dashboard create/update + agent startup, confirming encrypted-at-rest writes and plaintext only in-memory trusted flows.

## Dependencies & Implementation Order

- [ ] D1. Complete Phase 1 before Phases 2–4 (all paths depend on shared crypto helpers and env contract).
- [ ] D2. Complete Phase 2 before Phase 3 to guarantee new writes are encrypted before broad read-path decryption rollout.
- [ ] D3. Complete Phase 3 before running full migration verification in Phases 4–5, so mixed encrypted/legacy data works safely during rollout.
