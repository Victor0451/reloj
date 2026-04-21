# Proposal: Fase 4 - Eventos y Dashboard

## Intent

Build a complete events listing page with server-side filtering, cursor-based pagination, and CSV export; replace the dashboard recent-events placeholder with real queries; implement a frontend-side person name lookup to work around `person_id = NULL` in the database.

## Scope

### In Scope
- `src/actions/events.ts` — `listEvents(filter, cursor)`, `countEvents(filter)`, `exportEventsCsv(filter)`
- `src/components/events/events-table.tsx` — shadcn/ui Table with real-time Supabase subscription, filter bar, cursor pagination, loading skeleton
- Events page (`src/app/(dashboard)/dashboard/events/page.tsx`) — wire actions + table component
- Dashboard recent events section — real query (last 10 events with person join), click-to-navigate
- Person name display — frontend lookup by `employee_id` via persons table, cached in component state

### Out of Scope
- Agent-side `person_id` linking (event-sync-loop stays as-is)
- Real-time "INSERT" events (placeholder only for now)

## Capabilities

### New Capabilities
- `events-list`: List access events with cursor pagination, date range, event type, and employee_id filters; expose total count for pagination UI
- `events-export`: Stream CSV export of filtered events (timestamp, employee_id, person_name, event_type, verify_mode, device_serial)
- `events-realtime`: Subscribe to `access_events` changes via Supabase Realtime and refresh table on INSERT

### Modified Capabilities
- `dashboard`: Recent events section changes from placeholder to real 10-event query with person name join

## Approach

1. **Server actions first** (`events.ts`) — `listEvents`, `countEvents`, `exportEventsCsv` with cursor pagination using `event_time` as cursor
2. **Events table component** — shadcn/ui Table skeleton (matching `persons-table.tsx` pattern), filter bar (date range, event type dropdown, employee search), cursor-based pagination controls
3. **Real-time** — Supabase Realtime subscription on INSERT to `access_events` table (same pattern as devices page)
4. **Person linking** — On mount, fetch all persons with `employee_id` set; cache in React state; join in table by `employee_id` field
5. **Dashboard** — Replace recent events placeholder with `listEvents({limit: 10})` call, add click-to-navigate

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/events.ts` | New | Server actions for event queries and CSV export |
| `src/components/events/` | New | Events table component and related UI |
| `src/app/(dashboard)/dashboard/events/page.tsx` | Modified | Wire real component |
| `src/app/(dashboard)/dashboard/page.tsx` | Modified | Real recent events list |
| `src/lib/supabase/types/database.types.ts` | Reference | `access_events`, `persons` tables |
| `obsidian/Módulo - Eventos.md` | Modified | Mark Fase 4 in-progress |
| `obsidian/Módulo - Dashboard.md` | Modified | Mark recent-events as implemented |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `person_id` stays NULL | High | Frontend hybrid lookup is the mitigation |
| Cursor pagination complexity | Medium | Use `event_time` as cursor; fallback to offset if needed |
| Realtime flood on high event volume | Low | Add throttle/debounce on subscription handler |
| N+1 on person lookup | Low | Batch load all persons on mount; cache in state |

## Rollback Plan

1. Revert `src/actions/events.ts` — delete file (no side effects)
2. Revert `src/components/events/` — delete directory
3. Restore events page and dashboard page to placeholder state
4. Remove any Supabase Realtime subscriptions added

## Dependencies

- Supabase client (already configured in project)
- shadcn/ui Table, DropdownMenu, Button, Skeleton components
- `Sonner` for toast feedback (already in project)
- Persons table accessible for `employee_id` lookup

## Success Criteria

- [ ] Events page shows real data with date range, event type, and employee filters
- [ ] Cursor pagination works (next/prev); count shown in UI
- [ ] CSV export downloads valid file with all filtered columns
- [ ] Table updates in real-time when new events are inserted
- [ ] Dashboard recent events shows last 10 events with person names
- [ ] No `person_id = NULL` blank cells in event table (employee_id used as fallback)