# Delta for encryption

## ADDED Requirements

### Requirement: Encrypt credentials on write
The system MUST encrypt `device_password_encrypted` before persistence on device create and password update operations.

#### Scenario: Creating device with encrypted password
- GIVEN a valid plaintext password and an active encryption key
- WHEN the create-device operation persists credentials
- THEN the stored password value MUST be a versioned encrypted payload
- AND the stored value MUST NOT equal the plaintext input

#### Scenario: Updating device password
- GIVEN an existing device and a new plaintext password
- WHEN the update-device password operation is executed
- THEN the new stored password MUST be re-encrypted using the active key material

### Requirement: Decrypt credentials in trusted runtime flows
The system SHALL decrypt encrypted device credentials only in trusted server/agent runtime paths that require adapter authentication.

#### Scenario: Agent reading and decrypting password
- GIVEN a device record with a valid encrypted payload
- WHEN the agent loads device credentials for sync/health loops
- THEN the agent MUST receive plaintext only in memory for adapter auth

#### Scenario: API health route decrypting password
- GIVEN a device record with a valid encrypted payload
- WHEN `GET /api/devices/{id}/health` executes device auth
- THEN the route MUST decrypt before auth and MUST NOT expose plaintext in API response

### Requirement: Legacy plaintext compatibility and migration path
The system MUST support legacy plaintext values during rollout and provide migration to encrypted-at-rest values.

#### Scenario: Fallback for legacy plaintext data
- GIVEN a stored password value that is not a recognized encrypted payload format
- WHEN a trusted runtime requests credentials
- THEN the system SHALL treat the value as legacy plaintext for compatibility
- AND the flow SHOULD emit a migration signal for re-encryption

#### Scenario: Migrating existing plaintext passwords
- GIVEN one or more legacy plaintext device rows
- WHEN migration/backfill runs or a device is next updated
- THEN each migrated row MUST be rewritten as a valid encrypted payload
- AND migration MUST be idempotent for already-encrypted rows

### Requirement: Encryption data contract and key lifecycle
The system MUST enforce a stable payload contract and deterministic key-selection behavior, including rotation handling.

#### Scenario: Encrypted payload contract validation
- GIVEN a candidate encrypted value
- WHEN decrypt is requested
- THEN the value MUST match `v<version>:<key_id>:<iv>:<tag>:<ciphertext>`
- AND invalid contract segments MUST produce a structured decrypt error

#### Scenario: Key rotation for decryption compatibility
- GIVEN a rotated active key and one or more previous valid keys
- WHEN decrypting stored payloads
- THEN the system SHALL select the key by `key_id` in the payload
- AND write operations MUST use the currently active key id/version

### Requirement: Fail-fast and actionable cryptographic errors
The system MUST fail safely with explicit operational errors for key/config/decrypt failures.

#### Scenario: Missing encryption key configuration
- GIVEN runtime startup or first crypto operation with no valid key configured
- WHEN encryption or decryption is attempted
- THEN the operation MUST fail with an actionable configuration error

#### Scenario: Bad decrypt or tampered payload
- GIVEN an encrypted payload with wrong key, corrupted bytes, or failed auth tag
- WHEN decrypt is attempted
- THEN the operation MUST return a typed decrypt failure
- AND the caller MUST stop auth flow instead of silently falling back
