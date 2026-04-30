# Spec: TypeScript Type Sync

## Overview

Synchronizes the TypeScript types in `src/types/person.types.ts` with the actual database schema. The DB was updated with migration 009 to add `sync_attempts`, `sync_error`, and new status values, but the TypeScript types were never updated.

## Current Behavior

**Before this change:**
- `PersonRecord.status` only includes: `'active' | 'inactive' | 'pending_sync'`
- Missing statuses: `'sync_failed'`, `'sync_dead_letter'`
- Missing fields: `sync_attempts`, `sync_error`
- TypeScript will compile but type safety is broken for these fields

```typescript
// Current (incomplete) types
export interface PersonRecord {
  id: string
  employee_id: string | null
  name: string
  department: string | null
  card_number: string | null
  face_photo_url: string | null
  device_employee_no: number | null
  status: 'active' | 'inactive' | 'pending_sync'  // ❌ Missing sync_failed, sync_dead_letter
  created_at: string
  updated_at: string
  // ❌ Missing: sync_attempts: number
  // ❌ Missing: sync_error: string | null
}
```

## Expected Behavior

**After this change:**
- `PersonRecord.status` includes all status values
- `sync_attempts: number` is defined (defaults to 0)
- `sync_error: string | null` is defined
- `CreatePersonInput` and `UpdatePersonInput` may need updates for new fields
- All components using PersonRecord get proper type checking

## Scenarios

### Scenario 1: PersonRecord type matches DB
```
Given the DB schema has: status, sync_attempts, sync_error, device_employee_no
When TypeScript compiles src/types/person.types.ts
Then PersonRecord interface includes all these fields with correct types
```

### Scenario 2: Status union includes all values
```
Given the app uses status="sync_failed" on a PersonRecord
When TypeScript type-checks the assignment
Then it passes (status is in the union type)
```

### Scenario 3: New developer imports PersonRecord
```
Given a new developer reads src/types/person.types.ts
When they see the PersonRecord interface
Then all available fields and status values are documented
```

## Acceptance Criteria

- [ ] `PersonRecord.status` includes: `'active' | 'inactive' | 'pending_sync' | 'sync_failed' | 'sync_dead_letter'`
- [ ] `PersonRecord` includes `sync_attempts: number`
- [ ] `PersonRecord` includes `sync_error: string | null`
- [ ] `PersonRecord` includes `device_employee_no: number | null` (already present, verified)
- [ ] `PersonRecord` includes `created_at: string` (already present, verified)
- [ ] `PersonRecord` includes `updated_at: string` (already present, verified)
- [ ] TypeScript compilation passes with no errors
- [ ] Components can safely access `person.sync_attempts` and `person.sync_error`

## Technical Notes

### File: src/types/person.types.ts

```typescript
// Updated PersonRecord interface
export interface PersonRecord {
  id: string
  employee_id: string | null
  name: string
  department: string | null
  card_number: string | null
  face_photo_url: string | null
  device_employee_no: number | null
  status: PersonStatus  // Use union type alias
  sync_attempts: number      // NEW: tracks sync retry count
  sync_error: string | null  // NEW: last error message
  created_at: string
  updated_at: string
}

// NEW: PersonStatus union type
export type PersonStatus = 
  | 'active' 
  | 'inactive' 
  | 'pending_sync' 
  | 'sync_failed' 
  | 'sync_dead_letter'

// CreatePersonInput - may need sync_attempts/sync_error? No, these are system-managed
export interface CreatePersonInput {
  name: string
  employee_id?: string
  department?: string
  card_number?: string
  face_photo_url?: string
}

// UpdatePersonInput - partial update
export interface UpdatePersonInput extends Partial<CreatePersonInput> {}

// Extended person with computed/optional fields for UI
export interface PersonWithSync extends PersonRecord {
  // UI-only computed fields (not stored in DB)
  lastSyncAt?: string
  isRetrying?: boolean
}
```

### DB Schema Reference (from migration 009)
```sql
-- persons table relevant columns:
id              UUID PRIMARY KEY
employee_id     TEXT
name            TEXT NOT NULL
department      TEXT
card_number     TEXT
face_photo_url  TEXT
device_employee_no INTEGER  -- maps to Hikvision employeeNo
status          TEXT DEFAULT 'pending_sync'
sync_attempts   INTEGER DEFAULT 0
sync_error      TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### Consistency with database.types.ts
Check if there's a `database.types.ts` or Supabase generated types that also need updating:
```bash
grep -r "sync_attempts\|sync_error" src/types/
```

If Supabase generates types, may need to:
1. Regenerate types: `npx supabase gen types typescript`
2. Or manually override with local type augmentation

### Type Augmentation (if using Supabase)
If Supabase client generates types, use module augmentation:
```typescript
// src/types/database.extensions.ts
import { Database } from './database.types'

export type PersonRecord = Database['public']['Tables']['persons']['Row'] & {
  // Add any client-side only fields
}

export type PersonStatus = PersonRecord['status']
```

### Verification
After update, verify:
```bash
cd /media/vlongo/Archivos/Projectos/reloj
npx tsc --noEmit src/types/person.types.ts
```

Should compile without errors.
