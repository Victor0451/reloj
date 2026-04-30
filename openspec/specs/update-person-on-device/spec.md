# Spec: Update Person On Device Fix

## Overview

Fixes the HikvisionAdapter.updatePersonOnDevice() method to properly handle card changes. After updating user info on the device, if the card_number has changed, the adapter must call assignCardToDevice() to update the card assignment.

## Current Behavior

**Before this change:**
- `updatePersonOnDevice` only sends `UserInfo` (PUT /ISAPI/AccessControl/UserInfo/Record)
- It sends: `employeeNo`, `name`, `validity`, `doorRight`
- It NEVER calls `assignCardToDevice` for the updated card
- Result: card_number changes in DB are never reflected on the device

## Expected Behavior

**After this change:**
- `updatePersonOnDevice` sends the updated `UserInfo` to device
- After successful PUT, if `cardNumber` was changed:
  - Fetch current card on device (optional, for comparison)
  - If card changed → call `assignCardToDevice(newCardNumber, employeeNo)`
  - If person had old card but new card is empty → optionally unassign old card
- Handle edge cases: card already exists on device, card belongs to another user

## Scenarios

### Scenario 1: Card number changed
```
Given a person with employeeNo="EMP001", cardNumber="123456" on device
And DB has card_number="654321" (changed)
When updatePersonOnDevice is called
Then PUT /ISAPI/AccessControl/UserInfo/Record is called with updated name/info
And assignCardToDevice("654321", "EMP001") is called
And the device now has card "654321" assigned to employeeNo "EMP001"
```

### Scenario 2: Card number unchanged
```
Given a person with employeeNo="EMP001", cardNumber="123456" on device
And DB has card_number="123456" (unchanged)
When updatePersonOnDevice is called
Then PUT /ISAPI/AccessControl/UserInfo/Record is called
And assignCardToDevice is NOT called (no change needed)
```

### Scenario 3: New card added to person without card
```
Given a person with employeeNo="EMP001", no card on device
And DB has card_number="789012" (new card)
When updatePersonOnDevice is called
Then PUT /ISAPI/AccessControl/UserInfo/Record is called
And assignCardToDevice("789012", "EMP001") is called
```

### Scenario 4: Card already exists on different user
```
Given a person with employeeNo="EMP001", trying to assign cardNumber="999999"
And card "999999" already belongs to employeeNo="EMP002" on device
When assignCardToDevice is called
Then handle existing card: DELETE from EMP002, CREATE on EMP001
Or return error with clear message for retry
```

## Acceptance Criteria

- [ ] `updatePersonOnDevice` calls `assignCardToDevice` when card_number changed
- [ ] `assignCardToDevice` is called AFTER successful UserInfo PUT
- [ ] No extra `assignCardToDevice` call when card_number unchanged
- [ ] Adapter handles card conflict (card assigned to another user)
- [ ] Adapter handles card removal case (empty card_number)
- [ ] Errors from `assignCardToDevice` propagate and increment sync_attempts
- [ ] TypeScript types reflect `cardNumber` parameter on update method

## Technical Notes

### Implementation Location
- `agent/src/adapters/hikvision.adapter.ts` — `updatePersonOnDevice` method

### Method Signature Change
```typescript
async updatePersonOnDevice(
  person: PersonRecord,
  previousCardNumber?: string | null  // passed to detect change
): Promise<void> {
  // 1. Update UserInfo
  await this.put('/ISAPI/AccessControl/UserInfo/Record', {
    employeeNo: person.employee_id || person.device_employee_no,
    name: person.name,
  })

  // 2. If card changed, assign it
  const currentCard = previousCardNumber ?? null
  if (person.card_number !== currentCard) {
    if (person.card_number) {
      await this.assignCardToDevice(person.card_number, person.employee_id || person.device_employee_no!)
    }
  }
}
```

### Card Conflict Handling
```typescript
async assignCardToDevice(cardNo: string, employeeNo: string): Promise<void> {
  // First check if card exists on another employee
  const existingOwner = await this.findEmployeeByCard(cardNo)
  if (existingOwner && existingOwner !== employeeNo) {
    // Remove from previous owner
    await this.deleteCardInfo(existingOwner, cardNo)
  }
  
  // Assign to new owner
  await this.post('/ISAPI/AccessControl/CardInfo/Record', {
    employeeNo,
    cardNo,
    cardType: 1, // Normal card
  })
}
```

### ISAPI Endpoints Used
- PUT `/ISAPI/AccessControl/UserInfo/Record` — update user info
- POST `/ISAPI/AccessControl/CardInfo/Record` — assign card
- DELETE `/ISAPI/AccessControl/CardInfo/Record` — remove card (for conflict handling)
- GET `/ISAPI/AccessControl/CardInfo/Record` — optional, check current card