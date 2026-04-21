# Design: Devices Reliability Refactor

## Technical Approach
Refactor `/devices` around two server-side contracts: enrollment and runtime state. Enrollment handles secure registration/update with adapter-backed validation. Runtime state provides a client-safe projection of device health and sync state, fed by the Agent Bridge and surfaced via Supabase Realtime.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Client data boundary | Return safe DTOs without credentials | Keep `select(*)` and hide in UI | Secrets must not leave the server |
| Connectivity source | Canonical adapter-backed/server workflow | Mixed `fetch(http://ip)` checks | Current checks are inconsistent and produce false status |
| Agent eligibility | Manage registered devices by config readiness, not only `status=online` | Filter by current status | Offline devices must recover without manual re-registration |
| UI refresh model | Realtime + targeted server actions | `window.location.reload()` | Keeps identity stable and avoids full refresh UX |

## Data Flow

User Form → Server Action (`enroll/update`) → Connectivity Service → DB (`devices`)
   │                                                       │
   └──────────────── client-safe DTO ──────────────────────┘

Agent Bridge → heartbeat/sync updates → DB (`devices`, `sync_logs`) → Supabase Realtime → `/devices`

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/actions/devices.ts` | Modify | Split secret-bearing queries from safe DTO queries; add update path |
| `src/types/device.types.ts` | Modify | Separate `DeviceRecord` from `DeviceListItem` |
| `src/lib/device-connectivity.ts` | Modify | Canonical connectivity orchestration |
| `src/components/devices/add-device-dialog.tsx` | Modify | Robust form state and test connection flow |
| `src/components/devices/device-card.tsx` | Modify | Targeted refresh, clearer degraded states |
| `src/components/devices/device-list.tsx` | Modify | Realtime subscription on safe DTO shape |
| `agent/src/index.ts` | Modify | Startup selection by registration/readiness |
| `agent/src/sync/*` | Modify | Align persisted runtime state semantics |

## Interfaces / Contracts
```ts
type DeviceListItem = {
  id: string
  name: string
  brand: string
  ip_address: string | null
  status: 'online' | 'offline' | 'unknown'
  sync_status: 'disconnected' | 'connecting' | 'syncing' | 'synced' | 'error'
  sync_error: string | null
  last_seen_at: string | null
  sync_last_at: string | null
  updated_at: string
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | DTO mapping and connectivity result mapping | Add focused TypeScript tests once runner exists or cover via pure functions first |
| Integration | Server action enrollment/update against Supabase contracts | Use build/typecheck + manual DB validation initially |
| E2E | Realtime status reflection on `/devices` | Manual verification with a real device until test infra exists |

## Migration / Rollout
No destructive migration first. Introduce safe DTOs and canonical status flow before considering credential storage changes or column renames.

## Open Questions
- [ ] Si las credenciales se cifrarán en app, agent o secret manager externo.
- [ ] Si el runtime state debe incluir `brand` y `model` editable desde UI o derivado del adapter.
