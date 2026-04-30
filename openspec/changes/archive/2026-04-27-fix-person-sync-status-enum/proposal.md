# Proposal: fix-person-sync-status-enum

## Intent

Fix broken DB→Device person sync by adding missing `sync_failed` and `sync_dead_letter` values to the Supabase `person_status` enum type. The sync loop queries for these values, but they don't exist in the DB, causing PostgreSQL error `22P02` and silent failure for all pending persons.

## Scope

### In Scope
- Add `sync_failed` to `person_status` enum via `ALTER TYPE`
- Add `sync_dead_letter` to `person_status` enum via `ALTER TYPE`
- Verify end-to-end sync flow works after migration

### Out of Scope
- HikvisionAdapter response validation improvements (separate concern)
- Any UI or API changes
- New sync scenarios beyond the existing flow

## Capabilities

### New Capabilities
- `person-sync-status-enum`: Tracks full person sync lifecycle: `pending_sync` → `sync_failed` (on first failure) → `sync_dead_letter` (after 3 attempts)

### Modified Capabilities
- None — existing sync behavior just needs the missing enum values

## Approach

1. Run `ALTER TYPE person_status ADD VALUE 'sync_failed'` in Supabase
2. Run `ALTER TYPE person_status ADD VALUE 'sync_dead_letter'` in Supabase
3. Restart agent — `syncPendingPersons()` will now process pending persons
4. Verify `sync_attempts` increments on failure and status transitions to `sync_dead_letter` after 3 failures

The code in `person-sync-loop.ts` already handles these statuses — this is purely a DB schema fix.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/schema.sql` | Modified | Add `ALTER TYPE` statements for `person_status` enum |
| `agent/src/sync/person-sync-loop.ts` | None | No code change needed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Enum value already exists | Low | Check current enum values before ALTER |
| Supabase RLS policy blocks update | Low | Verify RLS permissions on `persons` table |
| Other code references these statuses | Low | Grep confirms only `person-sync-loop.ts` uses them |

## Rollback Plan

```sql
-- Revert enum values (Supabase requires recreation of type)
ALTER TYPE person_status RENAME TO person_status_old;
CREATE TYPE person_status AS ENUM ('active', 'inactive', 'pending_sync');
ALTER TABLE persons ALTER COLUMN status TYPE person_status USING status::text;
DROP TYPE person_status_old;
```

## Dependencies

- Supabase admin access to run `ALTER TYPE`
- Agent service restart after migration

## Success Criteria

- [ ] `sync_failed` exists in `person_status` enum
- [ ] `sync_dead_letter` exists in `person_status` enum
- [ ] Pending persons (roxy id:e6f3ed1d, Ernesto id:895b4e36) are processed within 15 seconds of agent start
- [ ] `sync_attempts` increments from 0 on first attempted sync
- [ ] After 3 failed attempts, status transitions to `sync_dead_letter`
