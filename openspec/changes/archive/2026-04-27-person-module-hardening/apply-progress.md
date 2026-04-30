# Apply Progress: person-module-hardening (Fixes Before Archive)

## Overview

Fixes applied before archive:
1. **Issue 1 (CRITICAL)**: Added 30-second debounce on retry action
2. **Issue 2 (WARNING)**: Fixed sync_failed badge color to use 'destructive' instead of 'warning'

## Fixes Applied

### Fix 1: Retry Debounce (CRITICAL)
- **Status**: ✅ Done
- **Implementation**:
  - Added `last_retry_at TIMESTAMPTZ` column to persons table in `supabase/schema.sql`
  - Added `sync_attempts INTEGER DEFAULT 0` and `sync_error TEXT` columns (for completeness)
  - In `resetPersonSync()` action: fetches person first, checks if `last_retry_at` is within 30 seconds, returns error if cooldown active, then updates with new timestamp
- **Location**: 
  - `supabase/schema.sql` (table definition)
  - `src/actions/persons.ts` lines ~367-410 (`resetPersonSync` function)

### Fix 2: sync_failed Badge Color (WARNING)
- **Status**: ✅ Done
- **Implementation**: Changed `sync_failed: 'warning'` to `sync_failed: 'destructive'` in statusVariant map
- **Location**: `src/components/persons/persons-table.tsx` line ~69

## Typecheck

✅ `npx tsc --noEmit` passed with no errors

---

## Previous Phases (Phase 6)

## Completed Tasks

### Phase 6.1: Show sync_attempts Count
- **Status**: ✅ Done
- **Implementation**: After status badge, show "(X/3)" text in muted-foreground color for persons with sync_attempts > 0
- **Location**: `src/components/persons/persons-table.tsx` line ~250

### Phase 6.2: Show sync_error on Hover/Expand
- **Status**: ✅ Done
- **Implementation**: Wrapped badge in div with title attribute showing full error and attempt count. Uses `cursor-help` class.
- **Location**: `src/components/persons/persons-table.tsx` lines ~242-262
- **Tooltip format**: `Intento X/3: [error message]` or `Intento X/3` if no error

### Phase 6.3: Visual Hint for Error Rows
- **Status**: ✅ Done
- **Implementation**: Added left border accent for rows with sync_error using `border-l-2 border-l-destructive` classes on the wrapper div
- **Location**: `src/components/persons/persons-table.tsx` line ~245

### Phase 6.4: Sync Error in Edit Dialog
- **Status**: ✅ Done
- **Implementation**:
  - Added `SyncErrorBannerProps` interface and `SyncErrorBanner` component to person-dialog.tsx
  - Added `syncError` optional prop to `PersonDialogProps`
  - Banner shows warning icon + "Error de sincronización" + attempt count + error message
  - Styled with `border-destructive/30 bg-destructive/10` classes
  - `persons-client.tsx` passes syncError when editingPerson has sync_attempts
- **Location**: 
  - `src/components/persons/person-dialog.tsx` lines ~26-42, ~58-63, ~105-111
  - `src/app/(dashboard)/dashboard/persons/persons-client.tsx` lines ~237-244

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/components/persons/persons-table.tsx` | Modified | Added wrapper div with title tooltip, border-l indicator, sync_attempts count display |
| `src/components/persons/person-dialog.tsx` | Modified | Added AlertTriangle import, SyncErrorBanner component, syncError prop |
| `src/app/(dashboard)/dashboard/persons/persons-client.tsx` | Modified | Pass syncError prop to PersonDialog when editingPerson exists |

## Deviations from Design

- **Expandable row detail**: Not implemented. Used title/tooltip approach instead which is simpler and less invasive to the table layout. Error message shown on hover via title attribute. Full detail available in edit dialog's warning banner.
- **Accessible tooltip**: Used title attribute (native browser tooltip) for simplicity. Screen readers get the text content from the dialog banner when editing.

## Issues Found

- None significant. Tooltip approach is simpler than expandable row and meets user needs.

## Next Steps

- Verify phase: Validate implementation matches spec
- Archive: Sync delta specs to main specs and close change

## Status

2/2 fixes complete. Ready for verify phase.
