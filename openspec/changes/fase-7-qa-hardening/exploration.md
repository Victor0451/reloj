## Exploration: Fase 7 - QA y Hardening

### Current State

**Project**: RELOJ - Hikvision Biometric Management System  
**Last Updated**: 21 April 2026  
**Overall Progress**: ~50% complete (Phases 1-6 done, Phase 4 pending, Phase 7 not started)

---

### 1. Testing Status ⚠️ CRITICAL GAP

**Finding: NO tests configured**

| Aspect | Status | Details |
|--------|--------|---------|
| Unit tests | ❌ None | No Vitest/Jest configured |
| Integration tests | ❌ None | - |
| E2E tests | ❌ None | No Playwright configured |
| Test runner | ❌ None | `package.json` has no test script |
| Coverage | ❌ None | - |

**Files examined**:
- `package.json`: scripts only has `dev`, `build`, `start`, `lint` — no test command
- `agent/package.json`: test script says `"echo \"No test runner configured yet\""`
- Glob for `*.spec.ts`, `*.test.ts`: **zero matches**
- Glob for `vitest.config.*`, `jest.config.*`, `playwright.config.*`: **zero matches**

**openspec/config.json confirms**: `"test_runner": null`, `"unit_tests": false`, `"integration_tests": false`, `"e2e_tests": false`

**Impact**: Every phase completed so far has zero regression protection. Refactoring risk is HIGH.

---

### 2. Security Review 🔒

**Overall: GOOD with minor concerns**

| Category | Status | Notes |
|----------|--------|-------|
| SQL Injection | ✅ Safe | Using Supabase SDK (parameterized), no raw SQL concatenation in TS |
| XSS | ✅ Safe | No `innerHTML`, `dangerouslySetInnerHTML`, `eval()`, or string concatenation with user input |
| Credential Handling | ⚠️ Needs work | Device passwords stored as `device_password_encrypted` — good naming but unclear encryption method |
| SSL/HTTPS | ✅ Safe | Hikvision adapter uses `https://` explicitly; digest auth for ISAPI |
| Environment variables | ⚠️ Partial | `.env.example` exists but incomplete (missing CRON_AUTH_TOKEN) |

**Hardcoded credentials found**:
- `scripts/test-event-sub.ts:9` — hardcoded password `'evol@2601'`
- `scripts/test-event-variant.ts:7` — hardcoded password `'evol@2601'`
- `scripts/test-acs-endpoints.ts:7` — hardcoded password `'evol@2601'`
- `scripts/test-event-sync.ts` — no hardcoded, uses DB

**SECURITY NOTE**: The 3 test scripts in `/scripts/` contain hardcoded device credentials. These should be moved to `.env` or at minimum added to `.gitignore`.

**Auth flow**: Supabase cookie-based auth with SSR — looks correct. Middleware only refreshes session, routes handle auth checks (comment says "DO NOT block here").

---

### 3. Documentation Gaps 📝

**README.md**: Partially outdated
- Says "Fase 2-7 pending" in "Próximos Pasos" section (lines 131-156)
- However, the Obsidian docs ARE up to date (Estado del Proyecto.md shows phases 2, 3, 3.5, 5, 6 as complete)

**AGENTS.md**: Severely outdated
- Only contains Next.js 16 breaking-change warning
- All persona/rules/Senior DevOps content is missing — appears to be a truncated placeholder

**Obsidian docs**: 
- `Estado del Proyecto.md` — ✅ Current (21 Apr 2026)
- `Fase 3.md`, `Fase 3.5.md` — ✅ Created and current

**CRON_JOBS.md**: ✅ Exists and documented

**Missing docs**:
- No `TESTING.md` or `PLAN-TESTING.md` (referenced in "Plan de Testing" from context)
- No `SECURITY-CHECKLIST.md` or `CHECKLIST-SEGURIDAD.md` (referenced in context)
- No API documentation (`/api/routes` have no inline docs)
- No deployment guide (PM2/Vercel setup documented only partially)

---

### 4. Hardening Checklist 🔧

| Item | Status | Notes |
|------|--------|-------|
| Error handling | ⚠️ Inconsistent | Agent has `setupErrorHandlers()` and `logger.ts` (structured JSON logs, log levels). Frontend uses raw `console.log/error` — no structured logging |
| Logging in production | ⚠️ Incomplete | Agent: JSON structured logs with levels ✅ | Frontend: console.log/error everywhere ❌ |
| Graceful degradation | ✅ Good | Sync loops have try/catch, backoff retry (3-5 attempts), device marked offline after consecutive failures |
| Timeouts | ⚠️ Missing | ISAPI client has no explicit timeout on fetch calls; test scripts use 15s timeout manually |
| Retries | ✅ Good | `withRetry()` with exponential backoff exists in agent |
| Environment variables | ⚠️ Incomplete | `.env.example` missing CRON_AUTH_TOKEN, DEVICE_IP/PORT/USERNAME/PASSWORD (agent vars) |
| Cleanup on shutdown | ✅ Good | Agent has `registerCleanup()` and `shutdown.ts` |

**Agent solid foundations**:
- Structured JSON logger with levels (debug/info/warn/error)
- `setLogLevel()` from config
- Error handlers for uncaughtException/unhandledRejection (logging but NOT exiting — resilient)
- Graceful SIGTERM/SIGINT handling
- Adapter pattern cleanly abstracts device communication

**Frontend technical debt**:
- Uses raw `console.log/error/warn` everywhere (107 console.* calls)
- No structured logger
- No centralized error boundary (React error boundary not configured)
- `use server` actions don't have centralized error handling

---

### 5. Quick Codebase Audit 🔍

**Dead/Legacy Code**:
- `agent/src/sync/legacy/` — 3 archived files (heartbeat.ts, syncEvents.ts, persons.ts) — these are git-moved but still exist. Clean but not urgent.
- `openspec/changes/fase-3-consolidacion/` — NOT archived, still active in `openspec/changes/` (needs archiving)
- `openspec/changes/person-management/spec.md` — orphaned (no parent folder archived)
- `openspec/changes/agent-bridge/tasks.md` — orphaned, no other files in folder

**TODO/FIXME Comments**: 
- Only 2 matches: both are developer notes in `interfaces.ts` (not actual TODOs needing fixing)

**Type safety concerns**:
- Multiple `// eslint-disable-next-line @typescript-eslint/no-explicit-any` in `persons.ts` and other actions
- Admin client used with `as any` casts throughout

**Missing validations**:
- No rate limiting on API routes
- No input sanitization on CSV batch import beyond basic checks

---

## Quick Wins (High Value, Low Effort)

1. **Move hardcoded credentials from test scripts to .env** — SECURITY fix, 5 min
2. **Update AGENTS.md** — contains placeholder only, should document persona + rules
3. **Complete .env.example** — add CRON_AUTH_TOKEN, all agent vars
4. **Archive `openspec/changes/fase-3-consolidacion/`** — stale, not closed properly
5. **Add React Error Boundary** — 30 min, prevents white screens on runtime errors

---

## High-Effort Items (Fase 7 Scope)

1. **Setup test infrastructure** (Vitest for agent, maybe Playwright for e2e)
2. **Write regression tests** for critical paths: auth flow, sync loops, door commands
3. **Migrate frontend logging** from console.* to structured logger
4. **Add timeouts** to ISAPI fetch calls
5. **Create TESTING.md and SECURITY-CHECKLIST.md**
6. **Full README.md refresh** — mark phases 2,3,3.5,5,6 as complete
7. **RLS policy audit** — verify all tables have proper row-level security

---

## Risks

- **No regression protection**: Any refactor risks breaking working functionality
- **Documentation drift**: README and AGENTS.md are outdated, could mislead contributors
- **Hardcoded credentials**: Test scripts contain live device passwords
- **Frontend error handling**: Runtime errors show white screen (no error boundary)
- **No coverage**: Cannot measure quality or catch regressions

---

## Recommendation

Fase 7 work should prioritize in this order:
1. **Archive stale openspec changes** (quick, cleans state)
2. **Setup Vitest** for agent unit tests (critical)
3. **Fix hardcoded credentials** (security)
4. **Update AGENTS.md and README.md** (documentation)
5. **Write regression tests** for sync loops and door command flow

Ready for SDD proposal if user wants to formalize Fase 7 as a change.