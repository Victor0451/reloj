# Delta for sync — Consolidation Phase

## ADDED Requirements

### Requirement: Heartbeat Loop Verification

The system MUST verify the heartbeat loop operates correctly via adapter-based ISAPI calls.

The heartbeat loop MUST call `deviceInfo` every 60 seconds and update `devices.is_online` in the database.

#### Scenario: Heartbeat succeeds

- GIVEN agent is running with valid Hikvision device credentials
- WHEN heartbeat loop executes a cycle
- THEN logs MUST show adapter call to `DeviceInfo` endpoint
- AND `devices.is_online` MUST be set to `true` in DB
- AND next heartbeat scheduled for 60s later

#### Scenario: Heartbeat handles offline device

- GIVEN Hikvision device is unreachable
- WHEN heartbeat loop executes
- THEN device MUST be marked `is_online = false` in DB after timeout
- AND retry with exponential backoff MUST occur

---

### Requirement: Event Sync Loop Verification

The system MUST verify the event sync loop fetches and inserts access events via adapter pattern.

The event sync loop MUST fetch events via ISAPI, deduplicate, and insert into `access_events` table.

#### Scenario: Event sync inserts new events

- GIVEN agent is running and device has new access events
- WHEN event sync loop executes
- THEN logs MUST show adapter call to event endpoint (NOT direct ISAPI)
- AND new events MUST be inserted into `access_events` table
- AND duplicate events MUST be rejected via dedup logic

#### Scenario: Event sync with no new events

- GIVEN device has no new events since last sync
- WHEN event sync loop executes
- THEN loop MUST complete without DB inserts
- AND logs MUST indicate zero events processed

---

### Requirement: Person Sync Loop Verification

The system MUST verify bidirectional person sync between device and DB via adapter pattern.

#### Scenario: Person sync uploads to device

- GIVEN new persons exist in `persons` table but not on device
- WHEN person sync loop executes
- THEN logs MUST show adapter-based upload to device
- AND device MUST contain new person records

#### Scenario: Person sync downloads from device

- GIVEN new persons exist on device but not in `persons` table
- WHEN person sync loop executes
- THEN logs MUST show adapter-based download from device
- AND new persons MUST be inserted into `persons` table

---

### Requirement: Adapter Pattern Compliance

The system MUST use adapter-based calls for all ISAPI interactions, not direct ISAPI calls.

Logs MUST show adapter pattern usage for heartbeat, event sync, and person sync loops.

#### Scenario: Logs indicate adapter usage

- GIVEN agent is running
- WHEN any sync loop executes
- THEN logs MUST reference adapter module (e.g., `adapter: hikvision`)
- AND logs MUST NOT show direct ISAPI method calls

---

### Requirement: Legacy File Archive

The system MUST preserve git history when archiving legacy sync files.

#### Scenario: Legacy files archived with git mv

- GIVEN legacy files exist at `agent/src/sync/{heartbeat.ts,syncEvents.ts,persons.ts}`
- WHEN archivist executes `git mv` to `agent/src/sync/legacy/`
- THEN git history for those files MUST be preserved
- AND files MUST NOT be imported by any active module

#### Scenario: Zero legacy file references after archive

- GIVEN legacy files are moved to `legacy/` folder
- WHEN grep check runs on `agent/src/`
- THEN zero import references to `legacy/` path MUST be found

---

### Requirement: Documentation Update

The system MUST update all documentation to reflect the new file structure.

#### Scenario: README updated with correct file references

- GIVEN legacy files are archived
- WHEN `agent/README.md` is read
- THEN file references MUST point to `*-loop.ts` files
- AND `heartbeat-loop.ts`, `event-sync-loop.ts`, `person-sync-loop.ts` MUST be listed
- AND `legacy/` folder SHOULD be documented

#### Scenario: Obsidian Fase 3 marked complete

- GIVEN Phase 3 work is finished
- WHEN `Fases/Fase 3 - Gestión de Personas.md` is read
- THEN it MUST contain status "completed" or "completa"
- AND completion date SHOULD be noted

#### Scenario: Obsidian Fase 3.5 created

- GIVEN Phase 3.5 consolidation scope is defined
- WHEN `Fases/Fase 3.5 - Consolidación.md` is created
- THEN it MUST document heartbeat, event sync, and person sync verification scope
- AND it MUST show "in progress" or "en progreso" status

#### Scenario: Obsidian Arquitectura updated

- GIVEN Phase 2.3 (consolidation) is complete
- WHEN `Arquitectura/Estado del Proyecto.md` is updated
- THEN it MUST reflect Phase 2.3 completion status

---

## MODIFIED Requirements

None — this is a verification and cleanup phase with no changes to existing behavior.

---

## REMOVED Requirements

None — no requirements are being deprecated.

---

## Verification Checklist

Before archive:

- [ ] Agent logs show heartbeat cycle with adapter pattern
- [ ] Agent logs show event sync cycle with adapter pattern
- [ ] Agent logs show person sync cycle with adapter pattern
- [ ] No direct ISAPI calls visible in sync logs

Archive:

- [ ] `git mv agent/src/sync/{heartbeat.ts,syncEvents.ts,persons.ts} agent/src/sync/legacy/`
- [ ] `agent/src/sync/` contains only active files
- [ ] `agent/src/sync/legacy/` contains 3 files with preserved git history
- [ ] Grep confirms zero imports from `legacy/` path

Documentation:

- [ ] `agent/README.md` references `*-loop.ts` files
- [ ] `Fases/Fase 3 - Gestión de Personas.md` marked complete
- [ ] `Fases/Fase 3.5 - Consolidación.md` created with scope and status
- [ ] `Arquitectura/Estado del Proyecto.md` updated with Phase 2.3 completion
