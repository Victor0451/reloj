# Person Auto-Create Specification

## Purpose

Automatically create and update `persons` records in Supabase when `detectedPerson` events arrive from the event sync loop, enabling person identification without manual provisioning.

## Requirements

### Requirement: Person Creation on New Employee

The system SHALL create a new `persons` record when a `detectedPerson` event contains a previously unseen `employeeNoString`.

#### Scenario: New employee detected

- GIVEN a `detectedPerson` event with `employeeNoString="E001"` and `name="John Doe"`
- AND no `persons` record exists with `employee_no="E001"`
- WHEN the event-sync-loop processes the event
- THEN the system SHALL insert a new `persons` record with `name="John Doe"`, `employee_no="E001"`, and `status='active'`

#### Scenario: Employee already exists

- GIVEN a `detectedPerson` event with `employeeNoString="E001"` and `name="John Doe Updated"`
- AND a `persons` record exists with `employee_no="E001"` and `name="John Doe"`
- WHEN the event-sync-loop processes the event
- THEN the system SHALL update the existing `persons` record setting `name="John Doe Updated"`

### Requirement: Upsert Behavior

The system SHALL use upsert semantics: create if not exists, update `name` if exists.

#### Scenario: Same employeeNo on multiple events updates name

- GIVEN a `detectedPerson` event with `employeeNoString="E001"` and `name="John Doe"`
- AND the person already exists with `name="Previous Name"`
- WHEN the event-sync-loop processes the event
- THEN the person's `name` field SHALL be overwritten with the latest value

#### Scenario: Null identity data does not trigger upsert

- GIVEN a `detectedPerson` event with `employeeNoString=null`
- WHEN the event-sync-loop processes the event
- THEN the system SHALL NOT create or update any `persons` record

### Requirement: Person Auto-Creation in Event Sync Loop

The event-sync-loop SHALL process `detectedPerson` events and perform upsert operations against the `persons` table.

#### Scenario: Event sync loop processes detectedPerson

- GIVEN the event-sync-loop is running
- WHEN a `detectedPerson` event is received
- THEN the loop SHALL look up the person by `employeeNoString`
- AND create or update the person record accordingly

## Acceptance Criteria

- [ ] First `detectedPerson` with new `employeeNoString` creates a `persons` record
- [ ] Subsequent `detectedPerson` with same `employeeNoString` updates the person's `name`
- [ ] `detectedPerson` with null `employeeNoString` does not affect `persons` table
