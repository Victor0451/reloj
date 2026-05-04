# Dedup Key Specification

## Purpose

Define a single, canonical deduplication key contract used by all event ingestion paths so the same physical access event is evaluated consistently.

## Requirements

### Requirement: Canonical Event Identity

The system MUST uniquely identify an access event by `employeeId`, `eventTimeMs` (Unix epoch in milliseconds), and `cardReaderNoNormalized`.

`major`, `minor`, `event_type`, and other payload fields MUST NOT be part of the dedup identity for this change.

#### Scenario: Event arrives via event-sync-loop (primary path)

- GIVEN an event is fetched in `event-sync-loop`
- WHEN a dedup key is generated before insert
- THEN the key MUST represent `employeeId + eventTimeMs + cardReaderNoNormalized`
- AND duplicate detection MUST use that same generated key

#### Scenario: Event arrives via person-sync (if applicable)

- GIVEN a person-sync or any auxiliary flow emits/saves access events
- WHEN that flow needs dedup evaluation
- THEN it SHALL use the same canonical key contract
- AND it SHALL NOT introduce a path-specific key shape

### Requirement: Canonical Key Format Consistency

The system MUST use one exact string format across `dedup.ts` and `event-sync-loop.ts`.

#### Data Contract

- Format: `<employeeId>-<eventTimeMs>-<cardReaderNoNormalized>`
- `employeeId`: non-empty string as received from event
- `eventTimeMs`: integer milliseconds from `event.eventTime.getTime()`
- `cardReaderNoNormalized`: decimal string; fallback MUST be `0` when `cardReaderNo` is null/undefined/empty

Example: `E12345-1714748400123-0`

#### Scenario: Key format consistency between dedup.ts and event-sync-loop.ts

- GIVEN the same event payload
- WHEN key generation is executed in `dedup.ts` and in `event-sync-loop.ts`
- THEN both MUST produce byte-for-byte identical keys
- AND a mismatch MUST be treated as a contract violation

### Requirement: Duplicate and Unique Processing Outcomes

The system MUST deterministically handle duplicate vs unique events using the canonical key.

#### Scenario: Duplicate event detected

- GIVEN a canonical key already exists in the in-memory dedup set for the active loop
- WHEN another event with the same canonical key arrives
- THEN the event MUST be marked as skipped duplicate
- AND the system MUST NOT attempt a second insert for that event

#### Scenario: Unique event processed

- GIVEN a canonical key is not present in the dedup set
- WHEN an event arrives with that key
- THEN the key MUST be added to the dedup set
- AND the system MUST proceed with normal event insertion flow

### Requirement: Error Handling

The system MUST fail safely when key generation input is invalid or inconsistent.

#### Scenario: Missing required identity fields

- GIVEN `employeeId` is missing or `eventTime` cannot be converted to milliseconds
- WHEN key generation is attempted
- THEN the system MUST reject dedup evaluation for that event
- AND it MUST log a structured error including device/context and reason

#### Scenario: Contract violation between generators

- GIVEN key generators produce different formats for equivalent input
- WHEN inconsistency is detected (via guardrails/tests/runtime checks)
- THEN the event MUST be handled conservatively as non-deduplicated
- AND the system MUST emit an explicit contract-violation error for remediation
