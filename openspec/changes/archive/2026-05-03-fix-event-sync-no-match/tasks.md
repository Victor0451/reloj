# Tasks: Fix Event Sync NO MATCH

## Implementation Tasks

### 1.1 Add logging for JSON events request/response
- **File**: `agent/src/adapters/hikvision.adapter.ts`
- **Task**: Add log statements before and after JSON events request to see request body and response
- **Status**: ✅ Done (in previous debug session)
- **Lines**: ~460-481

### 1.2 Add NO MATCH retry logic
- **File**: `agent/src/adapters/hikvision.adapter.ts`
- **Task**: When JSON returns NO MATCH with time filters, retry without time filters
- **Status**: ✅ Done
- **Lines**: ~499-536

### 1.3 Change XML fallback to graceful degradation
- **File**: `agent/src/adapters/hikvision.adapter.ts`
- **Task**: Change XML fallback from throwing error to warn+return empty
- **Status**: ✅ Done
- **Lines**: ~549-551

### 1.4 Add logging for XML fallback attempt
- **File**: `agent/src/adapters/hikvision.adapter.ts`
- **Task**: Log when XML fallback is attempted and its response
- **Status**: ✅ Done
- **Lines**: ~514-527

## Verification Tasks

### 2.1 Restart agent and verify retry works
- **Task**: Restart agent with new code, observe logs
- **Expected**: See "NO MATCH with time filters, retrying without time range" in logs
- **Status**: ✅ Verified - logs show retry triggered and 30 events returned

### 2.2 Verify no 400 errors
- **Task**: Check logs confirm no 400 errors thrown
- **Expected**: No "Failed to get events: 400" errors
- **Status**: ✅ Verified - XML fallback returns empty instead of throwing

### 2.3 Verify deduplication still works
- **Task**: Check logs show duplicate key errors are skipped, not failures
- **Expected**: "Failed to insert event" with code 23505 is counted as skipped
- **Status**: ✅ Verified - multiple "duplicate key" logs show dedup working

## Documentation Tasks

### 3.1 Create proposal.md
- **File**: `openspec/changes/fix-event-sync-no-match/proposal.md`
- **Status**: ✅ Done

### 3.2 Create spec.md
- **File**: `openspec/changes/fix-event-sync-no-match/specs/event-sync-retry/spec.md`
- **Status**: ✅ Done

### 3.3 Create design.md
- **File**: `openspec/changes/fix-event-sync-no-match/design.md`
- **Status**: ✅ Done

### 3.4 Create this tasks.md
- **Status**: 🔄 In progress

### 3.5 Create verify-report.md
- **Status**: 🔲 Pending

### 3.6 Create archive
- **Status**: 🔲 Pending

## Summary

| Task | Status |
|------|--------|
| Implementation (code) | ✅ Done |
| Verification | ✅ Done |
| SDD Documentation | 🔄 In progress |