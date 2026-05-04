# Design: Fix Device Capacity Check Before Person Sync

## Technical Approach

Three-file change to close the device capacity feedback loop: (1) add a `device_capacity_status` column to `devices`, (2) parse HTTP 402 as a distinct `deviceFull` error in `HikvisionAdapter.createPersonOnDevice`, and (3) treat `deviceFull` as an immediate dead-letter in the person sync loop while updating the device's capacity status.

## Architecture Decisions

### Decision: HTTP 402 mapped to `SyncResult.error` containing `"device_full"`

**Choice**: Return `SyncResult` with `error: "Device capacity reached"` (containing `"device_full"`) rather than throwing `IsapiError`.
**Alternatives considered**: Throw `IsapiError(..., 402, 'deviceFull')` — rejected because `createPersonOnDevice` already returns `SyncResult` and callers expect error via the result object, not exceptions.
**Rationale**: Minimal surface change; the existing `SyncResult.error` contract already surfaces errors to `syncSinglePerson`. Matching the spec's `"device_full"` string pattern ensures the caller can detect it with a simple `.includes()` check.

### Decision: Immediate dead-letter on `deviceFull` (1 attempt, not 3)

**Choice**: Bypass the 3-attempt retry counter and set `sync_attempts = 1` directly.
**Alternatives considered**: (a) Add a new `isFatal` flag to `SyncResult` — adds complexity. (b) Use a separate `deviceFull` status — requires person status enum change.
**Rationale**: Device-full is an irreversible device-side constraint; retrying won't help. Setting `sync_attempts = 1` preserves auditability while achieving the spec goal (1 attempt total before dead-letter).

### Decision: `device_capacity_status` column with CHECK constraint

**Choice**: `TEXT` column with `CHECK (device_capacity_status IN ('ok', 'near_full', 'full', 'unknown'))`.
**Alternatives considered**: (a) `ENUM` type — avoids invalid values but requires enum type management in Supabase migrations. (b) Separate `capacity_percentage` integer — more precise but requires conversion logic.
**Rationale**: Follows existing Supabase migration patterns (see migration 020 person_status enum pattern). Text + CHECK is the simplest constraint that guards invalid values without enum management overhead.

## Data Flow

```
createPersonOnDevice (HikvisionAdapter)
    │
    ▼
HTTP POST /ISAPI/AccessControl/UserInfo/Record
    │
    ├─── 402 ───────────────────────────────► return { success: false, error: "Device capacity reached" }
    │                                              (error string contains "device_full")
    │
    ├─── 200/201 ────────────────────────────► return { success: true, employeeNo }
    │
    └─── other error ────────────────────────► return { success: false, error: "Create failed: {status}" }

syncSinglePerson (person-sync-loop.ts)
    │
    ▼
result = createPersonOnDevice(...)
    │
    ├─── result.success == true ────────────► update persons.status = 'synced'
    │
    └─── result.success == false
            │
            ├─── result.error.includes("device_full")
            │       │
            │       ├─── persons: status = 'sync_dead_letter', sync_attempts = 1, sync_error = 'Device full'
            │       └─── devices: device_capacity_status = 'full'
            │
            └─── other error
                    │
                    ├─── sync_attempts + 1 >= 3 ──► status = 'sync_dead_letter'
                    └─── sync_attempts + 1 < 3 ──► status = 'sync_failed' (retry later)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/023_add_device_capacity_status.sql` | Create | Adds `device_capacity_status TEXT DEFAULT 'unknown'` with CHECK constraint |
| `agent/src/adapters/hikvision.adapter.ts` | Modify | Parse HTTP 402 in `createPersonOnDevice`, return distinct error containing `"device_full"` |
| `agent/src/sync/person-sync-loop.ts` | Modify | Detect `deviceFull` error, immediate dead-letter + update device capacity to `'full'` |

## Interfaces / Contracts

### SyncResult (existing, unchanged)

```typescript
interface SyncResult {
  success: boolean;
  employeeNo?: string;
  error?: string;
  warnings?: string[];
}
```

### New: device_capacity_status values

| Value | Meaning |
|-------|---------|
| `'ok'` | Device has capacity for new persons |
| `'near_full'` | Device capacity 80–95% (optional future detection via `UserInfo/Count`) |
| `'full'` | Device has rejected a person creation with HTTP 402 |
| `'unknown'` | Initial/default state; cleared when sync succeeds |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `createPersonOnDevice` returns `device_full` on HTTP 402 | Mock `digestRequest` to return 402; assert result |
| Unit | `syncSinglePerson` dead-letters on `deviceFull` without incrementing to 3 | Mock adapter returning `deviceFull`; verify `sync_attempts = 1` and status |
| Unit | `device_capacity_status` set to `'full'` on deviceFull error | Mock adapter + mock supabase; verify devices update call |
| Integration | HTTP 402 → immediate dead-letter (full flow) | Requires Supabase mock or test DB |

## Migration / Rollout

1. Run migration `023_add_device_capacity_status.sql` — adds column with default `'unknown'`; safe for existing devices
2. Deploy agent with new adapter and sync loop
3. On first HTTP 402, device marked `'full'` and person dead-letters immediately
4. On first successful sync to a `'full'` device, status reverts to `'ok'`

No feature flag required; the change is additive and backward-compatible (existing persons/devices default to `'unknown'`).

## Open Questions

None — all decisions resolved in this design.
