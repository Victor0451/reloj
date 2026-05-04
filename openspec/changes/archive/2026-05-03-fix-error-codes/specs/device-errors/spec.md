# Delta for Device Error Classification

## MODIFIED Requirements

### Requirement: isRealError classification logic

The system SHALL classify device errors as real errors or transient failures using enum-based error codes instead of string matching. The `isRealError` function MUST accept `IsapiError | Error` and evaluate based on `TransientError` enum values and HTTP status codes.

(Previously: Used fragile `errorMessage.includes("not available")` string matching)

#### Scenario: Device returns "not available" error

- GIVEN device reports a transient error with message containing "not available"
- WHEN `isRealError()` evaluates the error
- THEN the error is classified as `TransientError.NOT_AVAILABLE`
- AND the error is NOT marked as a real error
- AND retry is allowed without adapter eviction

#### Scenario: Device returns HTTP 401 authentication error

- GIVEN device returns HTTP status code 401 (Unauthorized)
- WHEN `isRealError()` evaluates the error
- THEN the error is classified as a fatal auth error
- AND `isRealError` returns `true`
- AND the adapter is evicted via `adapterManager.removeAdapter()`
- AND sync_status is set to "error"

#### Scenario: Device returns HTTP 500 internal error

- GIVEN device returns HTTP status code 500 (Internal Server Error)
- WHEN `isRealError()` evaluates the error
- THEN the error is classified as potentially transient
- AND retry is allowed with circuit breaker handling

#### Scenario: Device returns "NO MATCH" on empty event query

- GIVEN device returns "NO MATCH" response for an event query with no matching records
- WHEN `isRealError()` evaluates the response
- THEN this is NOT classified as an error
- AND sync continues normally
- AND sync_status remains "synced"

## ADDED Requirements

### Requirement: TransientError enum

The system MUST define a `TransientError` enum in a shared errors module with the following values:

| Value | Meaning |
|-------|---------|
| `NOT_AVAILABLE` | Device reports resource unavailable |
| `DEVICE_BUSY` | Device is busy, retry later |
| `NO_MATCH` | No matching records (not an error) |
| `MORE_DATA` | More data available (not an error) |

The enum MUST be used for error classification instead of string matching.

### Requirement: isRealError function signature

The system MUST update `isRealError()` to accept `IsapiError | Error` instead of a string parameter. The function MUST inspect `IsapiError.statusCode` when available and return a boolean indicating whether the error is a real error requiring attention.

### Requirement: Both implementations updated

The system MUST update BOTH `isRealError` implementations in `event-sync-loop.ts`:
- Line ~235: First sync loop error handler
- Line ~460: Second sync loop error handler

Both locations MUST use the new enum-based classification.

### Requirement: HTTP 401 is fatal (not transient)

HTTP status code 401 (Unauthorized) MUST be treated as a fatal authentication error. The system MUST NOT retry on 401 and MUST evict the adapter to force re-authentication on next cycle.

### Requirement: Extensible error classification

When a new transient error variant appears in device responses, the system MUST allow classification by adding a new value to the `TransientError` enum — WITHOUT requiring string patching or modifying error-handling logic.

## Error Scenarios

### Scenario: Real error message accidentally contains "not available"

- GIVEN a real error message that legitimately contains the substring "not available" (e.g., "Database not available due to maintenance")
- WHEN the enum-based classification evaluates the error
- THEN the error is NOT falsely classified as transient
- AND the error is correctly marked as a real error based on its actual error code

### Scenario: New transient error variant in device response

- GIVEN device returns a new transient error code that is not yet in the enum
- WHEN the error is processed
- THEN the system logs an unclassified error
- AND the error is treated as potentially transient
- AND a new `TransientError` value SHOULD be added to the enum to explicitly handle it