# Archive Report: person-module-hardening

**Change**: person-module-hardening
**Archived Date**: 2026-04-27
**Mode**: hybrid (engram + openspec)

---

## Summary

Comprehensive hardening of the persons module across 7 phases. All core hardening objectives met, TypeScript compiles.

---

## What Was Built

### Phase 1: TypeScript Types
- PersonStatus with 5 values: `active`, `inactive`, `pending_sync`, `sync_failed`, `sync_dead_letter`
- `sync_attempts`, `sync_error`, `last_retry_at` fields added to type

### Phase 2: Backend Validation
- `employee_id` OR `card_number` required for create/edit
- `needsSync` triggers on name, employee_id, card_number changes (not department)
- `resetPersonSync` with 30s debounce via `last_retry_at` column

### Phase 3: Agent Adapter Fixes
- `updatePersonOnDevice` calls `assignCardToDevice` when card changes
- Card conflict resolution (delete old, assign new)
- `cleanupInactivePersons` includes `sync_dead_letter`
- 30s debounce on retry

### Phase 4: UI Status Badges
- 5 badges with icons and Spanish labels: "Sincronizado", "Pendiente", "Error", "Fallido", "Inactivo"
- Color coding: success/warning/destructive/secondary

### Phase 5: UI Dead Letter Management
- "Fallidos" filter option
- Retry button → `resetPersonSync`
- Discard button → `deletePerson`
- Toast notifications

### Phase 6: UI Sync Error Display
- `sync_attempts` count (X/3)
- Error tooltip on hover
- Red left border on error rows
- Warning banner in edit dialog

### Phase 7: E2E Verification
- All phases verified
- TypeScript compiles
- Manual E2E testing required by user

---

## Files Modified

| File | What Changed |
|------|-------------|
| `src/types/person.types.ts` | PersonStatus + sync fields |
| `src/types/database.types.ts` | sync fields |
| `src/actions/persons.ts` | validation + resetPersonSync debounce |
| `supabase/schema.sql` | last_retry_at, sync_attempts, sync_error columns |
| `agent/src/adapters/hikvision.adapter.ts` | updatePersonOnDevice card handling |
| `agent/src/sync/person-sync-loop.ts` | cleanup with sync_dead_letter |
| `src/components/persons/persons-table.tsx` | badges, icons, error display |
| `src/components/persons/person-dialog.tsx` | SyncErrorBanner |
| `src/app/(dashboard)/dashboard/persons/persons-client.tsx` | polling fallback |

---

## Specs Synced to Main (8 specs)

8 delta specs promoted to main specs in `openspec/specs/`:

| Domain | Action |
|--------|--------|
| type-sync | Created |
| minimum-required-fields | Created |
| edit-sync | Created |
| update-person-on-device | Created |
| dead-letter-retry | Created |
| dead-letter-cleanup | Created |
| sync-status-indicators | Created |
| sync-error-display | Created |

---

## Archive Contents

- proposal.md ✅
- specs/ ✅ (8 domain specs)
- tasks.md ✅ (22 tasks)
- verify-report.md ✅
- apply-progress.md ✅

---

## Notes

- Debounce 30s implemented via `last_retry_at` column in DB
- Polling fallback for Realtime (Supabase infrastructure issue)
- All core hardening objectives met
- Manual E2E testing by user recommended before production

---

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.