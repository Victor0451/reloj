# Tasks: Fase 4 - Eventos y Dashboard

## Phase 1: Foundation

- [x] 1.1 Create `src/types/event.types.ts` with `EventRecord`, `EventWithPerson`, `ListEventsOptions`, `ListEventsResult` interfaces matching `Database['access_events']` Row type
- [x] 1.2 Create `src/actions/events.ts` with `'use server'` directive and `createAdminClient()` imports
- [x] 1.3 Implement `listEvents(filter, cursor?)` returning `{ events, nextCursor, prevCursor, total }` — cursor is `event_time` ISO string, default limit 50, LEFT JOIN persons on employee_id for person_name
- [x] 1.4 Implement `countEvents(filter)` returning `number` for total count
- [x] 1.5 Implement `exportEventsCsv(filter)` returning CSV string — columns: event_time, employee_id, person_name, event_type, verify_mode, device_serial
- [x] 1.6 Test `listEvents` queries in Supabase: no filter, date range, event type, employeeId partial match, cursor next/prev, empty result

## Phase 2: Events Table Component

- [x] 2.1 Create `src/components/events/` directory with barrel export `index.ts`
- [x] 2.2 Create `src/components/events/events-table.tsx` — `'use client'`, accepts `initialEvents` prop, uses shadcn/ui `Table`, `Card`, `Button`, `Input`, `Badge`, `EmptyState`, `Skeleton`
- [x] 2.3 Add filter bar: `dateFrom` input, `dateTo` input, event type select, employee search input — matches `persons-table.tsx` toolbar layout
- [x] 2.4 Implement cursor pagination (Next/Prev buttons) using `event_time` cursor values from server response
- [x] 2.5 Add loading skeleton: 5 rows × 6 columns using `Skeleton` component matching `persons-table.tsx` pattern
- [x] 2.6 Wire fetchData to server actions — use `useCallback`, update URL search params on filter/page change
- [x] 2.7 Create `src/components/events/events-filter.tsx` as separate filter bar sub-component for reusability

## Phase 3: Realtime Integration

- [x] 3.1 Add Supabase Realtime subscription in `events-table.tsx` via `createClient().channel('events')` — subscribe to `postgres_changes` INSERT on `access_events`
- [x] 3.2 Implement 1-second throttle using `useRef<number>` timestamp gate in realtime handler — ignore INSERTs within 1s window
- [x] 3.3 Add new row highlight: `animate-in-premium` class with subtle green tint (`bg-emerald-500/5`) and fade-in on prepend
- [x] 3.4 Cleanup: `useEffect` return calls `channel.unsubscribe()` and `supabase.removeChannel(channelRef.current)` on unmount

## Phase 4: Dashboard Updates

- [x] 4.1 Update `src/app/(dashboard)/dashboard/page.tsx` — replace recent events placeholder with real `access_events` query, LIMIT 10, ordered `event_time` DESC
- [x] 4.2 Add LEFT JOIN with `persons` table on `employee_id` to fetch `person_name` for display
- [x] 4.3 Add `Shield` icon EmptyState fallback when no events exist
- [x] 4.4 Add "Ver todos" link to `/dashboard/events` with `employee_id` and `dateFrom` search params pre-filled
- [x] 4.5 Optional: Share realtime channel `events` between dashboard Recent Events and events table — both subscribe independently, dashboard shows last 10 auto-updated (simplified to load-on-mount pattern)

## Phase 5: Documentation & Polish

- [ ] 5.1 Update `Obsidian Vault/Proyectos/reloj/Módulo - Eventos.md` — add events page with filters, pagination, realtime description
- [ ] 5.2 Update `Obsidian Vault/Proyectos/reloj/Módulo - Dashboard.md` — update Recent Events section with real data description
- [ ] 5.3 Update `openspec/changes/fase-4-eventos-dashboard/tasks.md` — mark tasks as in-progress with completion dates
- [ ] 5.4 End-to-end test: create test event via bridge agent → verify appears in events table within 1s → test filter by employee → test CSV export → test dashboard widget update

## Dependencies

- Phase 1 must complete before Phase 2 (types and actions needed by component)
- Phase 2 must complete before Phase 4 (events-table.tsx used in dashboard)
- Phase 3 is independent after Phase 2 (realtime on existing component)

## Testing Strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `listEvents` cursor logic | Test edge cases: empty, single page, last page, prev cursor |
| Unit | CSV string building | Test header + rows, no matches, special characters in employee_id |
| Integration | Realtime INSERT flow | Create event via SQL → verify prepend + 1s throttle |
| E2E | Full events page flow | Playwright: filter by date → paginate → export CSV → verify highlight |