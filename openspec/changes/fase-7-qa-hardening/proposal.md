# Proposal: fase-7-qa-hardening

## Intent

Make RELOJ production-ready through security hardening, documentation cleanup, and React error boundary. This is the **final phase** — no new features, only completing what's there and protecting what exists.

## Scope

### In Scope
- Remove hardcoded device credentials from 3 test scripts → env vars
- Complete `.env.example` (add CRON_AUTH_TOKEN, agent vars)
- Add React Error Boundary to prevent white-screen-of-death
- Update AGENTS.md (restore full persona/rules)
- Update README.md (mark phases 2,3,3.5,5,6 complete)
- Sync Obsidian `Estado del Proyecto.md` with completion status
- Archive stale `openspec/changes/` directories (fase-3-consolidacion, person-management, agent-bridge)

### Out of Scope
- Vitest/Playwright setup (full TDD = separate initiative)
- Frontend structured logging migration
- RLS policy audit
- API rate limiting
- CSV input sanitization

## Capabilities

### New Capabilities
- `error-boundary`: React Error Boundary wrapping app to catch runtime errors with graceful fallback UI

### Modified Capabilities
- None (security/doc fixes don't change spec-level behavior)

## Approach

1. **Security first**: Move hardcoded credentials from `scripts/test-*.ts` to `.env`, update scripts to read from `process.env`
2. **Documentation sync**: Update AGENTS.md and README.md to reflect current state; mark phases complete
3. **Error boundary**: Create `components/ErrorBoundary.tsx` and wrap root layout; add graceful error UI with retry option
4. **Archive cleanup**: Move stale `openspec/changes/fase-3-consolidacion/`, `person-management/`, `agent-bridge/` to `openspec/archive/`

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `scripts/test-event-sub.ts` | Modified | Remove hardcoded `'evol@2601'` → use `process.env.DEVICE_PASSWORD` |
| `scripts/test-event-variant.ts` | Modified | Same credential fix |
| `scripts/test-acs-endpoints.ts` | Modified | Same credential fix |
| `.env.example` | Modified | Add CRON_AUTH_TOKEN, DEVICE_IP/PORT/USERNAME/PASSWORD |
| `AGENTS.md` | Modified | Restore full persona/rules/devops content |
| `README.md` | Modified | Mark phases 2,3,3.5,5,6 complete; remove "pending" references |
| `app/layout.tsx` | Modified | Wrap children with ErrorBoundary |
| `components/ErrorBoundary.tsx` | New | Error boundary with fallback UI |
| `obsidian/Estado del Proyecto.md` | Modified | Sync completion status |
| `openspec/archive/` | New | Archive stale change folders |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breaking test scripts | Low | Test env vars are optional fallback; scripts log warning if missing |
| Documentation conflicts | Low | User reviews before commit |
| Error boundary hides real issues | Low | Show clear error, suggest retry, log to server |

## Rollback Plan

1. Revert test scripts to hardcoded credentials (git revert)
2. Remove ErrorBoundary from layout (git revert)
3. Revert AGENTS.md/README.md (git revert from last known good)
4. Move archive → back to `changes/` if issues arise

## Dependencies

- None — no external dependencies, all work is local

## Success Criteria

- [ ] `scripts/test-*.ts` contain zero hardcoded credentials
- [ ] `.env.example` has CRON_AUTH_TOKEN and all agent vars documented
- [ ] `app/layout.tsx` renders `<ErrorBoundary>`
- [ ] `components/ErrorBoundary.tsx` exists with fallback UI
- [ ] README.md lists phases 2,3,3.5,5,6 as completed
- [ ] AGENTS.md contains full persona + devops rules
- [ ] `openspec/archive/` contains phase-3, person-management, agent-bridge
- [ ] Obsidian docs match filesystem state