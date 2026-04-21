# Tasks: fase-3-consolidacion

## Phase 1: Production Verification

- [x] 1.1 Start agent locally: `cd agent && npx tsx src/index.ts`
- [x] 1.2 Verify heartbeat loop logs show `adapter: hikvision` and `DeviceInfo` call
- [x] 1.3 Verify event sync loop logs show adapter call to event endpoint
- [x] 1.4 Verify person sync loop logs show adapter-based upload/download
- [x] 1.5 Check `devices.is_online` updated to `true` in Supabase
- [x] 1.6 Check `access_events` table populated with new events
- [x] 1.7 Verify no direct ISAPI calls in logs (adapter pattern compliance)
- [x] 1.8 (Optional) Test frontend Realtime subscription works

## Phase 2: Legacy File Archive

- [x] 2.1 Create legacy directory: `mkdir -p agent/src/sync/legacy`
- [x] 2.2 `git mv agent/src/sync/heartbeat.ts agent/src/sync/legacy/`
- [x] 2.3 `git mv agent/src/sync/syncEvents.ts agent/src/sync/legacy/`
- [x] 2.4 `git mv agent/src/sync/persons.ts agent/src/sync/legacy/`
- [x] 2.5 Verify `agent/src/sync/` contains only active `*-loop.ts` files
- [x] 2.6 `grep -r "sync/legacy" agent/src/` → zero results required
- [x] 2.7 Create `agent/src/sync/legacy/README.md` noting these are archived from Phase 2

## Phase 3: Documentation Update

- [x] 3.1 Update `agent/README.md`: replace legacy file refs with `heartbeat-loop.ts`, `event-sync-loop.ts`, `person-sync-loop.ts`
- [x] 3.2 Document `legacy/` folder in README
- [x] 3.3 Update Obsidian `Fases/Fase 3 - Gestión de Personas.md`: mark as "completed" with date
- [x] 3.4 Create Obsidian `Fases/Fase 3.5 - Consolidación.md` with phase scope and "in progress" status
- [x] 3.5 Update Obsidian `Arquitectura/Estado del Proyecto.md`: reflect Phase 2.3 completion

## Phase 4: Final Verification

- [ ] 4.1 Run agent one more time to confirm nothing broke after archive
- [ ] 4.2 Verify all 3 sync loops still functional via logs
- [ ] 4.3 Commit changes: `git add -A && git commit -m "feat(agent): archive legacy sync files and verify production operation"`

## Verification Checklist

Before archive (Phase 1 must pass):
- [ ] Heartbeat cycle: adapter pattern ✓, `devices.is_online` updated ✓
- [ ] Event sync cycle: adapter pattern ✓, `access_events` populated ✓
- [ ] Person sync cycle: adapter pattern ✓
- [ ] No direct ISAPI calls visible ✓

After archive (Phase 4):
- [ ] All 3 sync loops still running ✓
- [ ] Git history preserved for legacy files ✓
- [ ] Grep confirms zero legacy imports ✓