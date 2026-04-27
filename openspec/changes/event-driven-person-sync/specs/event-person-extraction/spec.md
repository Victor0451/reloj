# Event Person Extraction Specification

## Purpose

Parse identity data (`name`, `employeeNoString`) from Hikvision ISAPI `minor=38` auth events emitted by DS-K1T320MFWX devices running firmware V3.5.0.

## Requirements

### Requirement: Minor=38 Event Parsing

The system SHALL extract `name` and `employeeNoString` fields from ISAPI events where `minor=38`.

#### Scenario: Valid minor=38 event with identity data

- GIVEN a Hikvision ISAPI event with `minor=38`
- WHEN the event contains non-empty `name` and `employeeNoString` fields
- THEN the adapter SHALL emit a `detectedPerson` event with `name`, `employeeNoString`, and `eventTimestamp`

#### Scenario: Minor=38 event without identity data

- GIVEN a Hikvision ISAPI event with `minor=38`
- WHEN the event lacks `name` or `employeeNoString` (empty/null)
- THEN the adapter SHALL emit a `detectedPerson` event with `name=null` and `employeeNoString=null`

#### Scenario: Non-minor=38 event

- GIVEN a Hikvision ISAPI event with `minor≠38`
- WHEN the adapter processes the event
- THEN the adapter SHALL NOT emit any `detectedPerson` event

### Requirement: DetectedPerson Event Contract

The system SHALL emit a `detectedPerson` event conforming to the following contract:

```typescript
interface DetectedPersonEvent {
  name: string | null;
  employeeNoString: string | null;
  eventTimestamp: Date;
  deviceId: string;
  rawEvent: RawEvent;
}
```

#### Scenario: Event contract completeness

- GIVEN a `detectedPerson` event is emitted
- THEN the event MUST contain `name`, `employeeNoString`, `eventTimestamp`, `deviceId`, and `rawEvent` fields
- AND `name` and `employeeNoString` MAY be `null`

## Acceptance Criteria

- [ ] `minor=38` events with identity data produce `detectedPerson` events
- [ ] `minor=38` events without identity data produce `detectedPerson` events with null fields
- [ ] Non-`minor=38` events do NOT produce `detectedPerson` events
- [ ] `detectedPerson` events include all contract fields
