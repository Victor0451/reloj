# Tasks: fix-person-sync-status-enum

## Task 1: Create and Apply DB Migration

**File**: `supabase/migrations/010_fix_person_sync_status_enum.sql`

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

**Apply via**: `supabase db push` or run manually in Supabase SQL editor

**Completion Criteria**: 
- Migration file created at `supabase/migrations/010_fix_person_sync_status_enum.sql`
- Enum contains all 5 values: `active`, `inactive`, `pending_sync`, `sync_failed`, `sync_dead_letter`

**Verification Method**:
```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'person_status'::regtype;
```

---

## Task 2: Verify Sync Behavior

**Steps**:
1. Restart agent service
2. Observe logs — pending persons (roxy id:e6f3ed1d, Ernesto id:895b4e36) should be picked up within 15s
3. Trigger failed sync → verify `sync_attempts` increments and status becomes `sync_failed`
4. Trigger 3rd failure → verify status becomes `sync_dead_letter`
5. Trigger successful sync → verify status becomes `active`

**Completion Criteria** (per spec):
- [ ] `sync_failed` and `sync_dead_letter` exist in `person_status` enum
- [ ] Pending persons processed within 15s of agent start
- [ ] `sync_attempts` increments on first failed attempt
- [ ] After successful sync, status changes to `active`
- [ ] After 3 failed attempts, status changes to `sync_dead_letter`

**Verification Method**: Agent logs + database queries on `persons` table

---

## Summary

| Task | Effort | Risk |
|------|--------|------|
| 1. DB Migration | 5 min | Low — `IF NOT EXISTS` handles idempotency |
| 2. Verification | 10-15 min | Low — functional test via agent logs |
