# Spec: Minimum Required Fields

## Overview

Enforces that every person must have at least one device-identifier field: either `employee_id` (device employee number already assigned) OR `card_number` (to be assigned on device). A person with NEITHER cannot exist in the system because the biometric device requires `employeeNo` to link check-in/check-out events to a person record.

## Current Behavior

**Before this change:**
- Only `name` is validated as required on person creation
- `employee_id` and `card_number` are both optional (nullable in DB)
- A person can be created with `name` only, leaving both `employee_id` and `card_number` as null
- This creates a broken state: the sync loop generates an `AUTO_` placeholder, but the DB has no way to know the device-assigned `employeeNo`, breaking event linking

## Expected Behavior

**After this change:**
- `createPerson` and `updatePerson` validate that at least one of `employee_id` OR `card_number` is present (not null/empty)
- If only `card_number` is provided (no `employee_id`), the sync agent must auto-assign an `employeeNo` on the device using `getNextAvailableEmployeeNo()`
- Validation error returns clear message: "Person must have either employee_id or card_number"
- Edit is blocked if both fields become null (e.g., user clears both)

## Scenarios

### Scenario 1: Create with employee_id only
```
Given the person form with name="Juan Perez", employee_id="EMP001", card_number=""
When the user submits the form
Then the person is created with status "pending_sync"
And employee_id "EMP001" is used as device employeeNo on sync
```

### Scenario 2: Create with card_number only
```
Given the person form with name="Juan Perez", employee_id="", card_number="123456"
When the user submits the form
Then the person is created with status "pending_sync"
And the sync agent assigns an employeeNo via getNextAvailableEmployeeNo()
And the card is assigned to that employeeNo on the device
```

### Scenario 3: Create with both employee_id AND card_number
```
Given the person form with name="Juan Perez", employee_id="EMP001", card_number="123456"
When the user submits the form
Then the person is created with status "pending_sync"
And employee_id "EMP001" is used as device employeeNo
And the card is assigned to employeeNo "EMP001" on the device
```

### Scenario 4: Create with neither employee_id nor card_number
```
Given the person form with name="Juan Perez", employee_id="", card_number=""
When the user submits the form
Then the submission is rejected with error "Person must have either employee_id or card_number"
And no person record is created
```

### Scenario 5: Edit removes both fields
```
Given an existing person with employee_id="EMP001", card_number=null
When the user edits the person and clears employee_id
Then the edit is rejected with error "Person must have either employee_id or card_number"
And the person's employee_id remains "EMP001"
```

### Scenario 6: Edit transitions from employee_id to card_number
```
Given an existing person with employee_id="EMP001", card_number=null
When the user edits and sets employee_id to "" and card_number to "654321"
Then the edit is allowed
And status is set to "pending_sync"
And sync agent will assign a new employeeNo if needed
```

## Acceptance Criteria

- [ ] `createPerson` rejects creation when both `employee_id` AND `card_number` are null/empty
- [ ] `updatePerson` rejects edit when both `employee_id` AND `card_number` become null/empty
- [ ] Error message clearly states: "Person must have either employee_id or card_number"
- [ ] If only `card_number` is provided, sync agent auto-assigns `employeeNo` via `getNextAvailableEmployeeNo()`
- [ ] Existing persons with null/empty both fields cannot be saved (validation fires on edit attempt)
- [ ] PersonDialog UI shows inline validation error when both fields are empty

## Technical Notes

### Implementation Location
- `src/actions/persons.ts` — `createPerson` and `updatePerson` functions

### Validation Logic
```typescript
const hasEmployeeId = Boolean(input.employee_id?.trim())
const hasCardNumber = Boolean(input.card_number?.trim())

if (!hasEmployeeId && !hasCardNumber) {
  return { success: false, error: 'Person must have either employee_id or card_number' }
}
```

### Sync Agent Behavior
When syncing a person with only `card_number` (no `employee_id`):
1. Call `getNextAvailableEmployeeNo()` to get next sequential number
2. Create user on device with that `employeeNo`
3. Store returned `employeeNo` in `device_employee_no` (or update `employee_id` if it was empty)
4. Call `assignCardToDevice(cardNumber, employeeNo)`

### DB Schema Note
The `employee_id` column should remain nullable to support the auto-assignment flow. The uniqueness constraint on `employee_id` is deferred (out of scope for this change).
