# Design: Fase 4 - Eventos y Dashboard

## Technical Approach

Implement real-time event listing page with cursor pagination, CSV export, and dashboard recent events widget. Follow existing patterns from `persons-table.tsx` (server actions + client component) and `device-list.tsx` (Supabase Realtime subscription).

## Architecture Decisions

### Decision: Cursor field — `id` vs `event_time`

| Option | Pros | Cons |
|--------|------|------|
| `event_time` | No duplicate key issue | Less stable under concurrent writes |
| `id` | Stable sort, no ties | Requires composite cursor (id + event_time) for correctness |

**Choice**: `event_time` as cursor (as specified in specs). Simpler to implement; ties broken by `id` DESC implicitly via natural row order.

**Rationale**: Spec explicitly defines `event_time` as cursor. Id-based cursor adds complexity for marginal stability gain given low concurrent write volume.

### Decision: Person name join — LEFT JOIN vs per-event lookup

| Option | Pros | Cons |
|--------|------|------|
| LEFT JOIN `persons` on `employee_id` | Single query, no N+1 | person_id=NULL means no join |
| Per-event lookup with batch cache | Works when person_id is NULL | Extra query on mount |

**Choice**: LEFT JOIN `persons` on `employee_id` in the SQL query itself, with React state cache for fallback.

**Rationale**: Spec requires `employee_id` as join key (not `person_id`). Cache approach (Map<employee_id, name>) handles person_id=NULL cases gracefully.

### Decision: Realtime channel — shared vs separate

| Option | Pros | Cons |
|--------|------|------|
| Shared `events` channel | Single subscription, lower overhead | Dashboard + table both update |
| Per-component channel | Independent lifecycle | Multiple channels, more connections |

**Choice**: Single shared channel `events-realtime-channel` subscribed by both `EventsTable` and dashboard widget.

**Rationale**: Single channel reduces Supabase connection count. Both components subscribe/unsubscribe independently via `useEffect` cleanup.

### Decision: Throttle strategy

| Option | Pros | Cons |
|--------|------|------|
| `use-debounce` hook (300ms) | Built-in, proven pattern | Delays legitimate updates |
| Timestamp check (1s gate) | Simple, predictable | No external dependency |

**Choice**: Timestamp check with 1-second gate in the realtime handler.

**Rationale**: Spec requires max 1 refresh/second. Timestamp check is lighter than debounce and matches the existing `device-card.tsx` pattern (useRef + setTimeout).

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      Server Actions                         │
│  src/actions/events.ts                                     │
│  ├── listEvents(filter, cursor) → {events, nextCursor}    │
│  ├── exportEventsCsv(filter) → CSV string                 │
│  └── countEvents(filter) → total                          │
└─────────────────────────────────────────────────────────────┘
         │                                       │
         ▼                                       ▼
┌─────────────────┐              ┌──────────────────────────┐
│ EventsTable     │              │ Dashboard Recent Events   │
│ (client)        │              │ (server component)       │
│ - URL filters   │              │ - listEvents({limit:10}) │
│ - Skeleton      │              │ - EmptyState fallback     │
│ - Realtime sub  │◄────────────►│ (shares channel)         │
│ - Person cache  │   Supabase   │                          │
│   (Map<emp_id>) │   Channel    │                          │
└─────────────────┘              └──────────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ CSV Export Dialog           │
│ (onClick → download)        │
└─────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/actions/events.ts` | Create | listEvents, countEvents, exportEventsCsv server actions |
| `src/components/events/events-table.tsx` | Create | Main client table with realtime, filters, pagination |
| `src/components/events/events-filter.tsx` | Create | Filter bar sub-component (date range, type, employee) |
| `src/components/events/index.ts` | Create | Barrel export |
| `src/app/(dashboard)/dashboard/events/page.tsx` | Modify | Replace placeholder with EventsTable |
| `src/app/(dashboard)/dashboard/page.tsx` | Modify | Real recent events query (last 10 + person join) |
| `src/types/event.types.ts` | Create | EventRecord, EventWithPerson, ListEventsOptions types |

## Interfaces

```typescript
// src/types/event.types.ts
export interface EventRecord {
  id: string
  device_serial: string | null
  person_id: string | null
  employee_id: string | null
  event_time: string
  major: number | null
  minor: number | null
  event_type: string
  verify_mode: string | null
  raw_payload: Json | null
  synced_at: string
}

export interface EventWithPerson extends EventRecord {
  person_name: string | null
  device_name?: string | null
}

export interface ListEventsOptions {
  dateFrom?: string
  dateTo?: string
  eventType?: string
  employeeId?: string
  cursor?: string
  limit?: number
}

export interface ListEventsResult {
  events: EventWithPerson[]
  nextCursor: string | null
  prevCursor: string | null
  total: number
}
```

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `listEvents` cursor logic | Test pagination edge cases (empty, single page, last page) |
| Unit | CSV string building | Test header + rows, no matches case |
| Integration | Realtime INSERT flow | Mock Supabase channel, verify prepend + cap at 10 |
| E2E | Full events page flow | Playwright: filter → paginate → export CSV |

## Open Questions

- [ ] Should `exportEventsCsv` stream for large datasets (>10k rows), or is in-memory acceptable for expected data volume?
- [ ] Device name in CSV: join via `devices` table on `device_serial`, or show serial number only?
