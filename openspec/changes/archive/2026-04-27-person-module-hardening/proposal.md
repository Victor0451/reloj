# Proposal: person-module-hardening

## Intent

Make the persons module robust and complete — proper validation ensures `employee_id` or `card_number` exists for event linking; card changes trigger device re-sync; dead-letter persons are actionable; sync status is visible to users.

## Scope

### In Scope
- Minimum required fields validation (`employee_id` OR `card_number` must exist on create)
- Fix edit flow: `card_number` change triggers device re-sync
- Adapter fix: `updatePersonOnDevice` calls `assignCardToDevice` when card changes
- Dead-letter management: retry action, force-delete from device, UI indicators
- Sync status badges in UI (pending, syncing, synced, failed, dead-letter)
- TypeScript type sync with DB schema (`sync_attempts`, `sync_error`, `sync_dead_letter`)
- CSV import: allow partial rows, validate card format

### Out of Scope
- Multi-device support
- Fingerprint enrollment (device-side only)
- Bulk person operations beyond dead-letter cleanup
- `employee_id` uniqueness constraint (deferred — requires migration review)

## Capabilities

### New Capabilities
- `person-required-fields`: Validation enforcing `employee_id` OR `card_number` on create/edit
- `person-card-sync`: Card changes trigger full device re-sync with `assignCardToDevice`
- `person-dead-letter-ux`: Retry/force-delete actions for dead-letter persons; error details visible
- `person-sync-status-badge`: Real-time sync status indicators in persons table and dialog

### Modified Capabilities
- None — all changes are implementation-level within existing capabilities

## Approach

**Frontend**: Add validation in `PersonDialog` (create/edit) requiring `employee_id` OR `card_number`. Display sync status badge in table and dialog. Add retry button for dead-letter persons.

**Backend**: In `createPerson`/`updatePerson`, validate minimum fields. On `card_number` change, set `pending_sync` and ensure adapter calls `assignCardToDevice`.

**Agent**: Fix `HikvisionAdapter.updatePersonOnDevice` to detect card changes and call `assignCardToDevice`. Add dead-letter cleanup: persons with `sync_dead_letter` status and `device_employee_no` get force-delete from device option.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/persons.ts` | Modified | Validation rules, `card_number` change detection, `needsSync` expansion |
| `src/types/person.types.ts` | Modified | Add `sync_attempts`, `sync_error`, `sync_dead_letter` to type |
| `src/components/persons/person-dialog.tsx` | Modified | Required-field validation, sync status badge on edit |
| `src/components/persons/persons-table.tsx` | Modified | Sync status badges, retry button for dead-letter |
| `agent/src/adapters/hikvision.adapter.ts` | Modified | `updatePersonOnDevice` calls `assignCardToDevice` on card change |
| `agent/src/sync/person-sync-loop.ts` | Modified | Dead-letter persons cleanup path |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-------------|
| Existing persons with null `employee_id` and null `card_number` fail validation | Med | Run migration to set `pending_sync` flag; validate only NEW creates/edits |
| Card re-assignment ordering (ISAPI requires user update before card assign) | Low | Adapter already sequences: updateUser → assignCard; confirmed correct |
| Dead-letter retry floods device with requests | Low | Add debounce/throttle on manual retry; max 1 retry per 30s per person |

## Rollback Plan

1. Revert `src/actions/persons.ts` — remove `card_number` from `needsSync`, restore previous validation
2. Revert `agent/src/adapters/hikvision.adapter.ts` — remove `assignCardToDevice` call from `updatePersonOnDevice`
3. Revert `src/components/persons/*` — restore previous dialog/table components
4. TypeScript types auto-revert on next build if changes removed
5. Dead-letter cleanup: no migration needed — feature is additive

## Dependencies

- None — all changes are self-contained within existing codebase

## Success Criteria

- [ ] Person without `employee_id` AND without `card_number` is rejected at create with clear error
- [ ] Editing `card_number` triggers device re-sync within 15s
- [ ] Dead-letter persons show retry button and can be re-synced from UI
- [ ] Sync status badge shows correct state (pending/syncing/synced/failed/dead-letter) in table and dialog
- [ ] All persons with `sync_error` display the error message (tooltip or expandable)
