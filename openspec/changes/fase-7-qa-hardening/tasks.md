# Tasks: fase-7-qa-hardening

## Phase 1: Security Fixes (HIGH PRIORITY)

- [x] 1.1 Fix `scripts/test-event-sub.ts` — remove hardcoded `'evol@2601'`, replace with `process.env.DEVICE_PASSWORD`
- [x] 1.2 Fix `scripts/test-event-variant.ts` — same credential fix as 1.1
- [x] 1.3 Fix `scripts/test-acs-endpoints.ts` — same credential fix as 1.1
- [x] 1.4 Verify all 3 scripts fail gracefully if env vars missing (log warning, don't crash)
- [x] 1.5 Update `.env.example` — add `CRON_AUTH_TOKEN`, `DEVICE_IP`, `DEVICE_PORT`, `DEVICE_USERNAME`, `DEVICE_PASSWORD` with comments

## Phase 2: React Error Boundary

- [x] 2.1 Create `components/error-boundary.tsx` — React Error Boundary class component with fallback UI
- [x] 2.2 Add retry button to ErrorBoundary fallback
- [x] 2.3 Update `app/layout.tsx` — wrap children with `<ErrorBoundary>`
- [ ] 2.4 Test: verify white-screen becomes graceful error on runtime crash (throw test error in dev)

## Phase 3: Documentation Updates

- [ ] 3.1 Update `README.md` — mark phases 2,3,3.5,5,6 as completed; remove "pending" references in Próximos Pasos
- [ ] 3.2 Restore `AGENTS.md` — full persona rules, devops section, conventions (restore content from git history if needed)
- [ ] 3.3 Sync `obsidian/Estado del Proyecto.md` — verify completion status matches filesystem state

## Phase 4: Openspec Archive Cleanup

- [ ] 4.1 Create `openspec/archive/fase-3-consolidacion/` — move stale `openspec/changes/fase-3-consolidacion/` to archive
- [ ] 4.2 Archive `openspec/changes/person-management/` — orphan spec.md (no parent folder, move entire thing)
- [ ] 4.3 Archive `openspec/changes/agent-bridge/` — orphan tasks.md (no other files, archive entire folder)
- [ ] 4.4 Verify archive folders are complete (list contents of each)

## Phase 5: Code Cleanup

- [x] 5.1 Search for `TODO`, `FIXME`, `HACK` in `agent/` and `app/` — review each comment
- [x] 5.2 Address any critical TODO/FIXME found (skip low-priority developer notes)
- [x] 5.3 Verify no hardcoded credentials remain anywhere in `scripts/` directory
- [x] 5.4 Run `npm run lint` — verify no new warnings introduced
- [x] 5.5 Remove empty stub directories from Phase 4 (agent-bridge, fase-3-consolidacion, person-management)

## Verification

- [ ] 6.1 Confirm all test scripts read from `process.env` — no hardcoded strings
- [ ] 6.2 Confirm `.env.example` has all agent vars documented
- [ ] 6.3 Confirm `app/layout.tsx` renders `<ErrorBoundary>`
- [ ] 6.4 Confirm `README.md` marks phases 2,3,3.5,5,6 complete
- [ ] 6.5 Confirm `AGENTS.md` has full persona + rules content
- [ ] 6.6 Confirm `openspec/archive/` contains phase-3, person-management, agent-bridge
- [ ] 6.7 Confirm Obsidian docs match filesystem state