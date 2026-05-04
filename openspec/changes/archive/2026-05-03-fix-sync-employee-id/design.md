# Design: fix-sync-employee-id

## Technical Approach

Fix `syncPersonsFromDevice` to unconditionally sync `device_employee_no` and conditionally sync `employee_id` (when device value differs from DB), removing these fields from the name-change guard that currently prevents any update when name is unchanged.

## Architecture Decisions

### Decision: employee_id update must compare device vs DB value

**Choice**: Use `deviceEmployeeNo !== existing.employee_id` — update only when different
**Alternatives considered**: Always overwrite employee_id with device value (too aggressive)
**Rationale**: Preserves device-assigned IDs when DB was pre-populated. Pattern matches `syncSinglePerson` line 225: `employee_id: finalEmployeeNo !== employeeNo ? finalEmployeeNo : person.employee_id`

### Decision: device_employee_no is unconditional

**Choice**: Always update `device_employee_no` on every sync pass
**Alternatives considered**: Conditional update only on employee_id change (incomplete)
**Rationale**: Spec scenario 3 explicitly requires `device_employee_no` update even when name unchanged. Device employee number is source of truth.

### Decision: Add device_employee_no to SELECT

**Choice**: Fetch `device_employee_no` alongside `employee_id` in existing person query
**Alternatives considered**: Separate query to get device_employee_no (N+1)
**Rationale**: We need the DB value to compare against device value for conditional employee_id update. Single query is efficient.

## Data Flow

```
Device Person { employeeNo: "22222" }
         │
         ▼
┌──────────────────────────────────────┐
│ Find existing by employee_id="22222" │
│ SELECT id, name, employee_id,        │
│        device_employee_no            │
└──────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Condition: name changed?             │
│   - YES: update name + device_emp    │
│   - NO:  update device_emp + emp_id  │  ← BUG: currently skips both
└──────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/sync/person-sync-loop.ts` | Modify | Restructure update block at ~line 379-394 |

## Code Changes

### Before (lines 373-394)

```typescript
const { data: existing } = await (supabase as any)
  .from("persons")
  .select("id, name, employee_id")           // ← missing device_employee_no
  .eq("employee_id", employeeNo)
  .single();

if (existing) {
  if (existing.name !== person.name) {        // ← guards ALL updates
    await (supabase as any)
      .from("persons")
      .update({
        name: person.name,
        card_number: person.cardNumber || null,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }
}
```

### After (lines 373-400)

```typescript
const { data: existing } = await (supabase as any)
  .from("persons")
  .select("id, name, employee_id, device_employee_no")  // ← ADD device_employee_no
  .eq("employee_id", employeeNo)
  .single();

if (existing) {
  const deviceEmployeeNoInt = parseInt(employeeNo, 10) || null;
  await (supabase as any)
    .from("persons")
    .update({
      name: person.name,                      // keep name change guard if needed
      card_number: person.cardNumber || null,
      device_employee_no: deviceEmployeeNoInt, // ← ALWAYS updated
      employee_id: employeeNo !== existing.employee_id ? employeeNo : existing.employee_id, // ← conditional
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  updated++;
  log.info("personSync", `Updated person from device`, { employeeNo, name: person.name });
}
```

## Key Decision

- Name-change guard CAN remain for `name` field (separate UX concern)
- `device_employee_no` and `employee_id` MUST be outside that guard
- `employee_id` is conditional: only update if device value differs from DB value

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | employee_id not updated when name changed but emp_id same | Direct function test with mock |
| Unit | employee_id updated when device value differs | Direct function test with mock |
| Integration | device_employee_no updated regardless of name | Integration test with real DB |

## Migration / Rollout

No migration required. This is a bug fix in sync logic — existing data remains valid.

## Open Questions

None — spec fully defines the expected behavior.
