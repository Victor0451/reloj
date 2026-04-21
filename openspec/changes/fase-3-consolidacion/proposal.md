# Proposal: fase-3-consolidacion

## Intent

Consolidate Phase 2 refactoring gains by verifying production-ready operation of new adapter-based sync loops and cleaning up legacy dead code. The goal is a verified, documented architecture — not new features.

## Scope

### In Scope
- **Production verification**: Run agent and confirm heartbeat, event sync, and person sync loops function correctly via logs
- **Archive legacy sync files**: Move to `agent/src/sync/legacy/` using `git mv` for history preservation
  - `agent/src/sync/heartbeat.ts`
  - `agent/src/sync/syncEvents.ts`
  - `agent/src/sync/persons.ts`
- **Update documentation**:
  - Create/update `agent/README.md` with correct file references
  - Update Obsidian doc: `Fases/Fase 3 - Gestión de Personas.md` (mark completed)
  - Create new Obsidian doc: `Fases/Fase 3.5 - Consolidación.md`

### Out of Scope
- Adding new adapter brands (Hikvision only — design supports extensibility)
- Modifying sync loop logic (already refactored in Phase 2)
- Adding tests (covered in Phase 2)

## Capabilities

### New Capabilities
None — this is a cleanup/consolidation phase, not new features.

### Modified Capabilities
- `sync/heartbeat`: Moved from `heartbeat.ts` to `heartbeat-loop.ts` with adapter pattern
- `sync/event-sync`: Moved from `syncEvents.ts` to `event-sync-loop.ts` with adapter pattern
- `sync/person-sync`: Moved from `persons.ts` to `person-sync-loop.ts` with adapter pattern

## Approach

1. **Verify production operation**: Start agent, inspect logs for successful heartbeat, event sync, and person sync cycles
2. **Archive legacy files**: `git mv` to `agent/src/sync/legacy/` (preserves git history)
3. **Update documentation**: Fix file references in README, update Obsidian phase docs

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `agent/src/sync/` | Modified | Legacy files moved to `legacy/` subfolder |
| `agent/README.md` | New/Modified | Document adapter-based architecture and correct file map |
| `Obsidian/Fases/Fase 3 - Gestión de Personas.md` | Modified | Mark as completed |
| `Obsidian/Fases/Fase 3.5 - Consolidación.md` | New | Document Phase 3.5 consolidation work |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Legacy files still referenced somewhere | Low | Grep check confirms zero imports from new loops to legacy |
| Production verification fails | Low | Rollback: revert git mv, re-import legacy files |

## Rollback Plan

```bash
# If production verification fails:
git mv agent/src/sync/legacy/{heartbeat.ts,syncEvents.ts,persons.ts} agent/src/sync/
git commit -m "revert: restore legacy sync files"
```

## Dependencies

- Phase 2 refactoring complete and verified functional
- `openspec/specs/` clear (no existing specs — fresh project state)

## Success Criteria

- [ ] Agent logs show successful heartbeat cycles
- [ ] Agent logs show successful event sync cycles
- [ ] Agent logs show successful person sync cycles
- [ ] `agent/src/sync/` contains only active files (no legacy)
- [ ] `agent/src/sync/legacy/` contains 3 archived files with git history intact
- [ ] `agent/README.md` accurately documents current file structure
- [ ] Obsidian docs updated and linked
- [ ] Memory artifact persisted to engram with topic_key `sdd/fase-3-consolidacion/proposal`