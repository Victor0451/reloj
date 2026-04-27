# Attendance Control Specification

## Purpose

Track employee attendance against per-person schedules, calculate deviation minutes, flag attendance status (`ON_TIME`, `LATE`, `EARLY_LEAVE`, `ABSENT`), and provide dashboard/reports.

## Requirements

### Requirement: Schedule Definition

The system SHALL store per-person schedule configuration: `schedule_start`, `schedule_end`, and `tolerance_minutes`.

#### Scenario: Default schedule values

- GIVEN a new `persons` record is created
- THEN the record SHALL have `schedule_start='09:00:00'`, `schedule_end='18:00:00'`, and `tolerance_minutes=5`

#### Scenario: Custom schedule per person

- GIVEN a `persons` record exists
- WHEN `updatePersonSchedule` is called with custom values
- THEN the person's `schedule_start`, `schedule_end`, and `tolerance_minutes` SHALL be updated

### Requirement: Check-In Deviation Calculation

On the first `access_events` entry for a person on a given day, the system SHALL calculate `deviation_minutes` and `status`.

#### Scenario: On-time check-in

- GIVEN a person with `schedule_start='09:00:00'` and `tolerance_minutes=5`
- WHEN the first event for the day occurs at `09:02:00`
- THEN `deviation_minutes` SHALL be `0` or negative
- AND `status` SHALL be `'ON_TIME'`

#### Scenario: Late check-in

- GIVEN a person with `schedule_start='09:00:00'` and `tolerance_minutes=5`
- WHEN the first event for the day occurs at `09:10:00`
- THEN `deviation_minutes` SHALL be `5` (minutes late beyond tolerance)
- AND `status` SHALL be `'LATE'`

### Requirement: Check-Out Deviation Calculation

On the last `access_events` entry for a person on a given day, the system SHALL calculate `deviation_minutes` and `status`.

#### Scenario: On-time check-out

- GIVEN a person with `schedule_end='18:00:00'`
- WHEN the last event for the day occurs at `18:00:00` or later
- THEN `deviation_minutes` SHALL be `0` or positive
- AND `status` SHALL be `'ON_TIME'`

#### Scenario: Early leave

- GIVEN a person with `schedule_end='18:00:00'`
- WHEN the last event for the day occurs at `17:30:00`
- THEN `deviation_minutes` SHALL be `30` (minutes early)
- AND `status` SHALL be `'EARLY_LEAVE'`

### Requirement: Absent Detection

The system SHALL flag persons as `'ABSENT'` when they have no events on a given day.

#### Scenario: End-of-day absent check

- GIVEN a cron job runs at `23:59` daily
- WHEN a person has no `access_events` records for the current day
- THEN the system SHALL update the person's latest event status to `'ABSENT'`
- OR create an `ABSENT` attendance record for reporting purposes

### Requirement: Attendance Dashboard Display

The system SHALL display attendance events with person name, time, deviation, and status badge.

#### Scenario: Dashboard color coding

- GIVEN an attendance event with `status='ON_TIME'`
- WHEN rendered in the dashboard
- THEN the row/badge SHALL be colored green

- GIVEN an attendance event with `status='LATE'`
- WHEN rendered in the dashboard
- THEN the row/badge SHALL be colored red

- GIVEN an attendance event with `status='EARLY_LEAVE'`
- WHEN rendered in the dashboard
- THEN the row/badge SHALL be colored orange

- GIVEN an attendance record with `status='ABSENT'`
- WHEN rendered in the dashboard
- THEN the row/badge SHALL be colored gray

#### Scenario: Dashboard filters

- GIVEN the dashboard is loaded
- WHEN a user applies filters for `person`, `date_range`, or `status`
- THEN the displayed events SHALL be limited to matching records

### Requirement: Attendance Reports

The system SHALL generate weekly and monthly attendance reports per person.

#### Scenario: Weekly report

- GIVEN a date range of 7 consecutive days for person `P`
- WHEN the report is generated
- THEN the report SHALL list each day with `check_in_time`, `check_out_time`, `deviation_minutes`, and `status`
- AND include a `late_count` aggregate and `total_deviation_minutes`

#### Scenario: Monthly report

- GIVEN a date range of a calendar month for person `P`
- WHEN the report is generated
- THEN the report SHALL include aggregated statistics: total late days, total early leaves, total absent days, average deviation

#### Scenario: Excel export

- GIVEN a filtered report view
- WHEN the user requests Excel export
- THEN the system SHALL export all columns: `person_name`, `date`, `check_in_time`, `check_out_time`, `deviation_minutes`, `status`

### Requirement: API Contracts

The system SHALL expose the following API contracts:

#### Scenario: Update person schedule

- GIVEN a client calls `updatePersonSchedule(input: {person_id, schedule_start, schedule_end, tolerance})`
- THEN the system SHALL update the `persons` record matching `person_id`

#### Scenario: Get attendance report

- GIVEN a client calls `getAttendanceReport(person_id?, start_date, end_date)`
- WHEN `person_id` is provided
- THEN the report SHALL be scoped to that person
- WHEN `person_id` is omitted
- THEN the report SHALL include all persons
