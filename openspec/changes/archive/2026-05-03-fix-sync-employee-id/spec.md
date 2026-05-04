# Delta for Person Sync

## MODIFIED Requirements

### Requirement: Device-to-DB Person Sync — Employee ID Preservation

When syncing a device person to an existing DB person (matched by `employee_id`), the system MUST update both `employee_id` and `device_employee_no` based on device data, regardless of whether the person's name has changed.

The system SHALL update `device_employee_no` unconditionally on every sync with the device's `employeeNo` value.

The system SHALL update `employee_id` ONLY when the device's `employeeNo` differs from the DB's current `employee_id` value.

(Previously: `employee_id` and `device_employee_no` were only updated when `existing.name !== person.name`)

#### Scenario: Existing person with null employee_id gets device's employeeNo

- GIVEN an existing DB person with `employee_id` = null and `device_employee_no` = null
- WHEN `syncPersonsFromDevice` syncs a device person with `employeeNo` = "12345"
- THEN the DB person is updated with `employee_id` = "12345" and `device_employee_no` = 12345

#### Scenario: Existing person with mismatched employee_id (device changed)

- GIVEN an existing DB person with `employee_id` = "11111" and `device_employee_no` = 11111
- WHEN `syncPersonsFromDevice` syncs a device person with `employeeNo` = "22222" (same name)
- THEN the DB person is updated with `employee_id` = "22222" and `device_employee_no` = 22222

#### Scenario: Existing person with matching employee_id and name unchanged

- GIVEN an existing DB person with `employee_id` = "12345", `device_employee_no` = 12345, `name` = "Juan"
- WHEN `syncPersonsFromDevice` syncs a device person with `employeeNo` = "12345" and `name` = "Juan"
- THEN the DB person is NOT updated for name, BUT `device_employee_no` is still updated to 12345

#### Scenario: Device returns null employeeNo on existing person

- GIVEN an existing DB person with `employee_id` = "12345"
- WHEN `syncPersonsFromDevice` syncs a device person with `employeeNo` = null
- THEN the sync skips that person (null employeeNo check at line 366-370)
- AND `employee_id` and `device_employee_no` remain unchanged

#### Scenario: DB update fails during device-to-DB sync

- GIVEN an existing DB person matched by `employee_id`
- WHEN `syncPersonsFromDevice` attempts to update but the DB returns an error
- THEN the error is logged via existing error handler at line 426
- AND the sync continues to next device person