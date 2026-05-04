# Design: Person Sync Rollback

## Technical Approach

Introduce `device_committed` status to track when device sync succeeded but DB not yet updated. On DB failure after device success, trigger compensating delete on device.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/src/sync/person-sync-loop.ts` | Modify | Refactor `syncSinglePerson` with device_committed state and compensating delete |
| `supabase/migrations/XXX_add_device_committed_status.sql` | Create | Add `device_committed` to person status enum |

## Person Status Flow

```
pending_sync → device_committed → synced
                     ↓
               sync_failed (if DB update fails, compensating delete)

sync_failed → device_committed (retry)

sync_failed → sync_dead_letter (if compensating delete also fails)
```

## Implementation

### syncSinglePerson changes:

1. **Before device sync**: check if person is `pending_sync` or `sync_failed`
2. **After device sync success**: update DB to `device_committed` (not final `synced`)
3. **After DB update to `device_committed`**: if error → compensating delete on device, set `sync_failed`
4. **Final step**: update to `synced` after confirming both device and DB

### Compensating Delete

If DB fails after device success:
```typescript
try {
  await adapter.deletePerson(employeeNo);
} catch (deleteError) {
  // Compensating delete failed → mark as dead_letter
  await supabase.from('persons').update({ status: 'sync_dead_letter', sync_error: 'Compensating delete failed' });
}
```

## Testing Strategy

- Manual test: trigger DB failure mid-sync and verify compensating delete
- Integration test: verify status transitions are correct
