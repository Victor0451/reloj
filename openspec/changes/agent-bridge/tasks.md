# Fase 2: Agente Bridge — Task Breakdown

**Change**: agent-bridge
**Status**: planned
**Artifact Store**: openspec

---

## Executive Summary

The Agent Bridge is a standalone Node.js service (tsx) that sits between Hikvision ISAPI devices and the Supabase backend. It runs continuous sync loops (heartbeat, event sync, door status polling), executes door commands from the `door_commands` table, and maintains device health through retry with exponential backoff. The agent lives in a top-level `agent/` directory within the monorepo.

---

## Phase 1: Project Infrastructure

### 1.1 — Create `agent/package.json`
**Dependencies**: `tsx`, `@supabase/supabase-js`, `zod`, `digest-fetch`, `fast-xml-parser`, `typescript`, `@types/node`
**Acceptance Criteria**:
- `npm install` runs successfully in `agent/`
- All imports resolve without error
- `tsx agent/src/index.ts` is callable (even if index.ts is empty placeholder)

### 1.2 — Create `agent/tsconfig.json`
**Config**: `strict: true`, `module: ESNext`, `moduleResolution: bundler`, `target: ES2022`, `outDir: dist`, `rootDir: src`
**Acceptance Criteria**:
- `npx tsc --noEmit` passes with zero errors
- No `@/*` path alias needed (agent has its own root)

### 1.3 — Create `agent/.env.example`
**Vars**: `ISAPI_BASE_URL`, `ISAPI_USERNAME`, `ISAPI_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_SERIAL`
**Acceptance Criteria**:
- All env vars required by config module are listed
- Placeholder values match `.env.example` at project root for shared vars (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

### 1.4 — Create `agent/README.md`
**Content**: Setup instructions, env vars table, run commands, architecture overview
**Acceptance Criteria**:
- A new developer can set up the agent by following README only
- Includes `npm install`, `.env` setup, `npm run dev` steps

---

## Phase 2: Core Modules

### 2.1 — Config Module (`agent/src/config.ts`)
**Details**: Zod schema for all env vars, exports typed config object
**Acceptance Criteria**:
- Missing env var throws clear error on startup
- All values are properly typed (not `any`)
- ISAPI URL is normalized (trailing slash removed)

### 2.2 — Logger Module (`agent/src/utils/logger.ts`)
**Details**: Structured JSON logging with levels (debug, info, warn, error), includes timestamp, module name
**Acceptance Criteria**:
- Log output is valid JSON, one object per line
- Each log line includes: `timestamp`, `level`, `module`, `msg`
- Error logs include stack trace when available

### 2.3 — Supabase Client (`agent/src/supabase.ts`)
**Details**: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, exported as singleton
**Acceptance Criteria**:
- Client connects successfully on startup
- Can execute a simple query (e.g., `from('devices').select('*').limit(1)`)
- Uses service role key (no RLS bypass — agent is backend)

### 2.4 — Backoff + Retry Utilities (`agent/src/utils/backoff.ts`)
**Details**: `calculateBackoff(attempt, opts?)` returns ms with jitter; `withRetry(fn, opts)` wraps async calls
**Formula**: `min(1000 * 2^attempt + jitter, 60000)` where jitter is `Math.random() * 1000`
**Acceptance Criteria**:
- Backoff values follow exponential curve capped at 60s
- `withRetry` retries up to `maxAttempts` times
- Logs each retry attempt with delay

---

## Phase 3: ISAPI Client

### 3.1 — ISAPI HTTP Client (`agent/src/isapi/client.ts`)
**Details**: Wraps `digest-fetch` with base URL, returns typed responses, handles HTTP errors
**Acceptance Criteria**:
- GET/PUT methods working with Digest Auth
- Non-2xx responses throw typed error with status code
- Connection timeout handled (configurable, default 10s)

### 3.2 — XML Parsing Utilities (`agent/src/isapi/xml.ts`)
**Details**: `parseXML(text) -> object` using `fast-xml-parser`; type-safe extraction helpers
**Acceptance Criteria**:
- Parses ISAPI XML responses correctly
- Handles empty/null responses gracefully
- Exported helper: `extractValue(obj, path)` for nested values

### 3.3 — Typed ISAPI Methods (`agent/src/isapi/methods.ts`)
**Methods**:
- `getDeviceInfo()` — serial, model, firmware version
- `getAcsEvents(params?)` — paginated access events with major/minor/type
- `getDoorStatus(doorNo?)` — current door state
- `controlDoor(doorNo, action)` — open/close command
**Acceptance Criteria**:
- Each method returns strongly typed result (not `any`)
- Errors are caught and rethrown with context
- Works against real device or mock server

**Dependencies**: 3.1, 3.2

---

## Phase 4: Sync Loops

### 4.1 — Device Registration (`agent/src/sync/registerDevice.ts`)
**Details**: On startup, call `getDeviceInfo()`, upsert into `devices` table with serial as unique key
**Acceptance Criteria**:
- Device appears in `devices` table after agent start
- Subsequent starts update `last_seen_at` without creating duplicates
- Logs success/failure

### 4.2 — Heartbeat Loop (`agent/src/sync/heartbeat.ts`)
**Details**: `setInterval` every 60s, call `getDeviceInfo()` or lightweight endpoint, update `devices.last_seen_at` + `status`
**Acceptance Criteria**:
- `last_seen_at` updates every 60s in DB
- Device status flips to `offline` after missed heartbeats
- Loop survives transient errors (logs and continues)
- Returns cleanup function

### 4.3 — Event Sync Loop (`agent/src/sync/syncEvents.ts`)
**Details**: Poll ISAPI every 30s, fetch new `access_events`, insert into Supabase with dedup
**Acceptance Criteria**:
- New events appear in `access_events` table within 30s of occurrence
- No duplicate events inserted (see 4.4)
- Recover on restart: fetches all missed events since last successful sync
- Uses `withRetry` from 2.4

### 4.4 — Event Deduplication (`agent/src/sync/dedup.ts`)
**Details**: Composite key `(employee_id, event_time, major, minor)` — track `lastSyncedCursor` in memory
**Acceptance Criteria**:
- Identical events (same composite key) are skipped
- On restart, cursor resets — re-fetches from a safe point
- Cursor state is updated only after successful insert

### 4.5 — Door Status Polling (`agent/src/sync/pollDoorStatus.ts`)
**Details**: Poll `getDoorStatus()` every 10s, log changes, update device state in DB if applicable
**Acceptance Criteria**:
- Door state changes are logged
- Polling interval is configurable (default 10s)
- Survives errors without crashing

**Dependencies**: 4.1, 3.3, 2.4

---

## Phase 5: Commands

### 5.1 — Door Command Execution (`agent/src/commands/executeDoorCommand.ts`)
**Details**: `execute(command: { doorNo, action })` calls `controlDoor()` via ISAPI, logs result, writes audit entry
**Acceptance Criteria**:
- `controlDoor` ISAPI call succeeds for valid door/action
- Failed commands log error with reason
- Audit log entry created for every command attempt

### 5.2 — Command Dispatcher (`agent/src/commands/dispatcher.ts`)
**Details**: Poll `door_commands` table every 2s for `status = 'pending'`, execute via 5.1, update status to `completed`/`failed`
**Acceptance Criteria**:
- Pending commands are picked up within 2s
- Command status updated in DB after execution
- Concurrent commands handled safely (mutex or optimistic lock)
- Failed commands marked with error message
- Uses `withRetry` for resilience

**Dependencies**: 5.1, 3.3, 2.3

---

## Phase 6: Entry Point + Lifecycle

### 6.1 — Main Entry Point (`agent/src/index.ts`)
**Details**: Initialize config, logger, supabase, ISAPI client → register device → start all loops (heartbeat, events, door status, command dispatcher)
**Acceptance Criteria**:
- All modules start in correct order
- Startup failures abort with clear error message
- Running process shows "Agent started" log

### 6.2 — Graceful Shutdown (`agent/src/utils/shutdown.ts`)
**Details**: Listen for SIGTERM/SIGINT, clear all intervals, close Supabase client, exit cleanly
**Acceptance Criteria**:
- `kill -TERM <pid>` stops all loops gracefully
- No zombie intervals or leaked resources
- Logs "Shutting down..." message
- Exit code 0 on clean shutdown

### 6.3 — Top-Level Error Handler (`agent/src/utils/errorHandler.ts`)
**Details**: `process.on('uncaughtException')` and `process.on('unhandledRejection')` — log, don't crash
**Acceptance Criteria**:
- Uncaught errors logged with full context
- Process does NOT exit on unhandled rejection (unless fatal)
- Fatal errors exit with code 1

**Dependencies**: 6.1, 2.2

---

## Phase 7: Database Migration

### 7.1 — `door_commands` Table Migration (`supabase/migrations/XXX_create_door_commands.sql`)
**Columns**: `id UUID PK`, `device_id UUID FK -> devices`, `door_no INTEGER`, `action TEXT (open|close)`, `status TEXT (pending|completed|failed)`, `error_message TEXT`, `requested_by UUID FK -> profiles (nullable)`, `created_at`, `completed_at`
**RLS**: System insert + read, authenticated users read
**Indexes**: `idx_door_commands_status_created` on `(status, created_at DESC)` for efficient polling
**Acceptance Criteria**:
- Migration runs without error via Supabase SQL editor or CLI
- Table has all required columns and constraints
- RLS policies allow agent (service role) to insert/update/read
- RLS policies allow authenticated users to read

---

## Phase 8: Testing

### 8.1 — Smoke Test (`agent/tests/smoke.test.ts`)
**Details**: Start agent, verify: connects to Supabase, registers device, sends at least one heartbeat, logs startup
**Acceptance Criteria**:
- Test runs via `tsx agent/tests/smoke.test.ts` or test runner
- Agent starts without errors
- Device row created/updated in DB
- At least one heartbeat logged
- **Note**: Requires real device or ISAPI mock — skip if unavailable

### 8.2 — ISAPI Client Unit Tests (`agent/tests/isapi.test.ts`)
**Details**: Test XML parsing, backoff calculation, config validation with valid/invalid inputs
**Acceptance Criteria**:
- Config rejects missing env vars
- Backoff values within expected range
- XML parsing handles real ISAPI response shapes

**Dependencies**: 2.1, 2.4, 3.2

---

## Dependency Graph

```
1.1 ─┬─→ 1.2 ─┬─→ 2.1 ─┬─→ 2.3 ─┬─→ 4.1 ─┬─→ 4.2
     │        │        │        │        │
     │        │        │        │        └─→ 4.3 ─→ 4.4
     │        │        │        │
     │        │        │        └─→ 2.4 ─┬─→ 4.3
     │        │        │                 └─→ 4.5
     │        │        │
     │        │        └─→ 2.2 ─┬─→ 6.1 ─→ 6.2
     │        │                 └─→ 6.3
     │        │
     │        └─→ 3.1 ─→ 3.2 ─→ 3.3 ─┬─→ 4.1
     │                                ├─→ 4.2
     │                                ├─→ 4.5
     │                                ├─→ 5.1 ─→ 5.2
     │                                └─→ 8.2
     │
     └─→ 1.3 ─→ (docs only)
     └─→ 1.4 ─→ (docs only)

7.1 ─→ independent (can run anytime, needed by 5.2)
8.1 ─→ depends on 6.1
8.2 ─→ depends on 2.1, 2.4, 3.2
```

---

## Recommended Execution Order

1. **Phase 1** (1.1–1.4) — infrastructure, all independent
2. **Phase 2** (2.1–2.4) — core modules, 2.1 and 2.2 first
3. **Phase 7** (7.1) — DB migration (can run in parallel with Phase 2)
4. **Phase 3** (3.1–3.3) — ISAPI client
5. **Phase 4** (4.1–4.5) — sync loops
6. **Phase 5** (5.1–5.2) — commands
7. **Phase 6** (6.1–6.3) — entry point, lifecycle
8. **Phase 8** (8.1–8.2) — testing

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| ISAPI Digest Auth may vary by device model | High | Test against actual device early; abstract auth layer |
| Event dedup edge cases (clock skew, duplicate events from device) | Medium | Use composite key + idempotent inserts; log duplicates |
| Command race conditions (multiple agents?) | Medium | Use optimistic lock with `WHERE status = 'pending'` + `RETURNING` |
| No test framework available | Low | Smoke test runs as script; unit tests can use simple assertions |
| Device offline during development | Medium | Build mock ISAPI server for development |
