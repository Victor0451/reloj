# Apply Progress: fix-person-sync-status-enum

## Status: Awaiting User Confirmation

### Task 1: DB Migration ✅ COMPLETED
- **Created**: `supabase/migrations/010_fix_person_sync_status_enum.sql`
- **Contents**: Two DO $$ blocks that add `sync_failed` and `sync_dead_letter` with IF NOT EXISTS for idempotency
- **User Action Required**: Execute migration in Supabase SQL Editor

### Task 2: Verify Sync Behavior 🔲 PENDING
- Pending persons (roxy id:e6f3ed1d, Ernesto id:895b4e36) to be processed after migration
- Requires restart of person-sync-loop agent

---

## SQL to Execute in Supabase

```sql
-- ============================================
-- Fix person_status enum
-- Run this in Supabase SQL Editor
-- ============================================

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

---

## Verification Query (run AFTER migration)

```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'person_status'::regtype;
```

**Expected result**: `active`, `inactive`, `pending_sync`, `sync_failed`, `sync_dead_letter`

---

## Next Steps After Migration

1. Restart the person-sync-loop agent
2. Watch logs for pending persons being picked up within 15s
3. Test failed sync → status becomes `sync_failed`
4. Test 3rd failure → status becomes `sync_dead_letter`
5. Test successful sync → status becomes `active`