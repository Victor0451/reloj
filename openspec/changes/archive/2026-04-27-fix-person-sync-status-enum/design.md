# Design: fix-person-sync-status-enum

## Technical Approach

Add two missing values to the `person_status` enum via Supabase migration: `sync_failed` and `sync_dead_letter`. The `person-sync-loop.ts` already queries for these values — the DB schema is the only problem. Migration 009 attempted `sync_dead_letter` but may have silently failed on older PostgreSQL; `sync_failed` was never attempted.

## Architecture Decisions

This is a trivial DB migration — no architectural decisions required.

## SQL Migration

File: `supabase/migrations/010_fix_person_sync_status_enum.sql`

```sql
-- Fix person_status enum to include sync statuses used by person-sync-loop.ts
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

**Why separate `DO $$` blocks**: PostgreSQL requires each `ALTER TYPE ADD VALUE` to be in its own transaction context when run via `DO $$` — grouping them can cause implicit transaction issues.

**Why `IF NOT EXISTS` + exception handler**: Prevents failure if the value was partially added by migration 009 on some PostgreSQL versions.

## Verification

### 1. Enum values exist (immediate)

```sql
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'person_status'::regtype;
-- Expected: active, inactive, pending_sync, sync_failed, sync_dead_letter
```

### 2. Agent processes pending persons (within 15s of restart)

Start agent, observe logs. Pending persons (roxy id:e6f3ed1d, Ernesto id:895b4e36) should be picked up and processed.

### 3. End-to-end sync test

With agent running: create a new person from frontend → verify it syncs to device within 15s → status changes to `active`.

### 4. Failed sync transitions

Trigger a failed sync → verify status becomes `sync_failed` and `sync_attempts` increments.
After 3 failures → verify status becomes `sync_dead_letter`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/010_fix_person_sync_status_enum.sql` | Create | Adds `sync_failed` and `sync_dead_letter` to `person_status` enum |
| `supabase/schema.sql` | Modify | Line 7: update enum definition to include all 5 values |

## Risks & Gotchas

| Risk | Mitigation |
|------|------------|
| Migration 009 partially added `sync_dead_letter` on some DBs | `IF NOT EXISTS` handles this gracefully |
| Supabase hosted PostgreSQL may be older than v14 | `IF NOT EXISTS` supported since PG10, safe |
| Enum value already exists | Exception handler catches `duplicate_object` |
| RLS blocks agent updates | Policy already allows service role full access |

## Rollback

Supabase does not support `DROP VALUE` for enums. Rollback requires type recreation:

```sql
ALTER TYPE person_status RENAME TO person_status_old;
CREATE TYPE person_status AS ENUM ('active', 'inactive', 'pending_sync');
ALTER TABLE persons ALTER COLUMN status TYPE person_status USING status::text;
DROP TYPE person_status_old;
```

This is destructive — requires table rewrite. Rollback is only for emergencies, not routine operations.

## Open Questions

None — the fix is straightforward DB DDL.

## Next Step

Ready for `sdd-tasks` — execution is a single SQL migration with no code changes.