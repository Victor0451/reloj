# Delta Spec: fix-person-sync-status-enum

## Change ID
`fix-person-sync-status-enum`

## Status
Draft → Approved

---

## Context

### Current Enum State
The Supabase `person_status` enum in `supabase/schema.sql` (line 7) is defined as:

```sql
CREATE TYPE person_status AS ENUM ('active', 'inactive', 'pending_sync');
```

### Missing Values
The `person-sync-loop.ts` sync loop queries for two statuses that **do not exist** in the enum:

| Status | Line Reference | Usage |
|--------|----------------|-------|
| `sync_failed` | Line 89 (query filter), Line 249 (status update) | Filters persons with `pending_sync` OR `sync_failed` for retry |
| `sync_dead_letter` | Line 234 (status update) | Final state after 3 failed sync attempts |

### Root Cause
PostgreSQL error `22P02` (invalid input value for enum) is thrown when the query `.or("status.eq.pending_sync,status.eq.sync_failed")` is executed, because `sync_failed` is not a valid enum value. This causes `syncPendingPersons()` to return early on error, skipping all pending persons.

---

## Given/When/Then Scenarios

### Scenario 1: Enum contains all required values after migration

**Given** the Supabase `person_status` enum has values `active`, `inactive`, `pending_sync`

**When** the migration `fix-person-sync-status-enum` is applied

**Then** the enum SHALL contain `sync_failed` as a valid value

**And** the enum SHALL contain `sync_dead_letter` as a valid value

**And** the enum SHALL retain all existing values: `active`, `inactive`, `pending_sync`

---

### Scenario 2: Pending persons are processed after migration

**Given** there are persons with `status = 'pending_sync'` in the database

**And** the agent service has restarted after migration

**When** the sync loop runs

**Then** `syncPendingPersons()` SHALL query for persons with status `pending_sync` OR `sync_failed`

**And** those persons SHALL be processed within 15 seconds of agent start

**And** `sync_attempts` SHALL increment from 0 on first attempted sync

---

### Scenario 3: Failed sync transitions to sync_failed

**Given** a person has `status = 'pending_sync'`

**When** the sync loop attempts to sync the person to the device and the attempt fails

**Then** the person's `status` SHALL be updated to `sync_failed`

**And** `sync_attempts` SHALL be incremented

**And** `sync_error` SHALL store the error message

---

### Scenario 4: Three failed attempts transition to sync_dead_letter

**Given** a person has `status = 'sync_failed'` with `sync_attempts >= 2`

**When** the sync loop attempts to sync the person and the attempt fails again

**Then** the person's `status` SHALL be updated to `sync_dead_letter`

**And** further sync attempts SHALL NOT be made for this person

---

### Scenario 5: Successful sync transitions to active

**Given** a person has `status = 'pending_sync'` or `status = 'sync_failed'`

**When** the sync loop successfully syncs the person to the device

**Then** the person's `status` SHALL be updated to `active`

**And** `sync_attempts` SHALL remain unchanged

---

## Technical Specification

### Migration File
Create: `supabase/migrations/010_fix_person_sync_status_enum.sql`

```sql
-- Fix person_status enum to include sync statuses used by person-sync-loop
-- PostgreSQL requires separate ALTER TYPE statements for each new value

DO $$
BEGIN
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'sync_failed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE person_status ADD VALUE IF NOT EXISTS 'sync_dead_letter';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

### Code Dependencies (NO changes needed)
- `agent/src/sync/person-sync-loop.ts` — already handles these statuses correctly
- `src/types/database.types.ts` — MUST be updated separately to reflect new enum values (out of scope per proposal)

### Rollback
Supabase does not support removing enum values directly. Rollback requires type recreation:

```sql
-- WARNING: This is a destructive operation requiring table rewrite
ALTER TYPE person_status RENAME TO person_status_old;
CREATE TYPE person_status AS ENUM ('active', 'inactive', 'pending_sync');
ALTER TABLE persons ALTER COLUMN status TYPE person_status USING status::text;
DROP TYPE person_status_old;
```

---

## Success Criteria

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| 1 | `sync_failed` exists in `person_status` enum | Query Supabase: `SELECT enumlabel FROM pg_enum WHERE enumtypid = 'person_status'::regtype;` |
| 2 | `sync_dead_letter` exists in `person_status` enum | Same query as above |
| 3 | Pending persons (roxy id:e6f3ed1d, Ernesto id:895b4e36) are processed within 15 seconds of agent start | Agent startup logs |
| 4 | `sync_attempts` increments from 0 on first attempted sync | Database query after first failed sync |
| 5 | After 3 failed attempts, status transitions to `sync_dead_letter` | Database query after 3rd failure |

---

## Notes

- Migration `009_add_sync_retry_columns.sql` already attempted to add `sync_dead_letter` using `IF NOT EXISTS`, but may have failed silently on older PostgreSQL versions (pre-14)
- `sync_failed` was NEVER added to the enum — this is a new requirement
- TypeScript `database.types.ts` line 289 will need updating to reflect new union type — handled separately as it's client-side
