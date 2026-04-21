# Fase 2: Agente Bridge — Technical Design

## Status

**APPROVED** — 14-Apr-2026 after Judgment Day

---

## Executive Summary

The Agente Bridge is a standalone Node.js/TypeScript process that runs on the client's local network. It polls a Hikvision DS-K1T320MFWX biometric clock via ISAPI/HTTPS (Digest Auth), deduplicates access events, and inserts them into Supabase. It also monitors device health (heartbeat, door status) and executes remote door commands received from Supabase.

The agent is **decoupled from the Next.js app** — its own `package.json`, own dependencies, own runtime. This is intentional: the agent runs 24/7 on a local machine, while the Next.js app runs on Vercel (cloud).

**8 domains**: Device Registration, Event Sync, Heartbeat, Door Status, Door Commands, Configuration, Error Handling, Logging.

---

## 1. Module Architecture

```
agent/
├── .env.example
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts              # Entry point — starts all loops, graceful shutdown
    ├── config.ts             # Zod config loading + validation (fail fast)
    ├── supabase.ts           # Supabase client (service_role key, bypasses RLS)
    ├── types.ts              # Shared types + DB type import
    ├── isapi/
    │   ├── client.ts         # ISAPI HTTP client (digest-fetch + XML parsing)
    │   ├── types.ts          # ISAPI request/response type definitions
    │   └── xml.ts            # XML parse/stringify utilities (fast-xml-parser)
    ├── sync/
    │   ├── events.ts         # Event polling loop (every 30s)
    │   ├── heartbeat.ts      # Heartbeat loop (every 60s)
    │   └── door-status.ts    # Door status polling loop (every 10s)
    ├── commands/
    │   ├── door.ts           # Door open/close ISAPI commands
    │   └── dispatcher.ts     # Polls door_commands table, dispatches, updates status
    └── utils/
        ├── logger.ts         # Structured JSON logger (pino or custom)
        ├── backoff.ts        # Exponential backoff with jitter
        └── retry.ts          # Generic retry wrapper using backoff
```

### Module Responsibilities

| Module | Responsibility |
|--------|---------------|
| `index.ts` | Bootstrap config, init Supabase, init ISAPI client, start all loops, handle SIGTERM/SIGINT |
| `config.ts` | Load `.env`, validate with Zod, exit(1) on failure |
| `supabase.ts` | Create typed Supabase client with `service_role` key |
| `types.ts` | Re-export `Database` from main project, define agent-specific types |
| `isapi/client.ts` | HTTP calls to device with Digest Auth, XML response parsing |
| `sync/events.ts` | Poll `/ISAPI/AccessControl/AcsEvent`, dedup, bulk insert |
| `sync/heartbeat.ts` | GET `/ISAPI/System/deviceInfo`, update `last_seen_at` + status |
| `sync/door-status.ts` | GET `/ISAPI/AccessControl/Door/Status/1`, update device record |
| `commands/door.ts` | PUT `/ISAPI/AccessControl/RemoteControl/door/1` with action |
| `commands/dispatcher.ts` | Poll `door_commands` for pending rows, execute, mark done/failed |
| `utils/logger.ts` | Structured JSON log output with levels (error, warn, info, debug) |
| `utils/backoff.ts` | `min(1000 * 2^attempt + jitter, 60000)` |
| `utils/retry.ts` | Wrap any async fn with retry + backoff + error classification |

---

## 2. ISAPI Client Design

### 2.1 Authentication

The Hikvision DS-K1T320MFWX uses **HTTP Digest Authentication** for ISAPI endpoints. Basic auth will be rejected.

**Library choice**: `digest-fetch` — a lightweight wrapper around `node-fetch` that handles the Digest Auth challenge-response cycle automatically.

```typescript
import DigestFetch from 'digest-fetch';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

export class IsapiClient {
  private client: DigestFetch;
  private baseUrl: string;
  private xmlParser: XMLParser;
  private xmlBuilder: XMLBuilder;

  constructor(opts: { ip: string; port: number; username: string; password: string }) {
    this.baseUrl = `https://${opts.ip}:${opts.port}`;
    this.client = new DigestFetch(opts.username, opts.password, {
      basic: false,        // Disable basic auth
      algorithm: 'MD5',    // Hikvision default
      cnonceSize: 16,
    });
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
      textNodeName: '$text',
      parseAttributeValue: true,
      parseTagValue: true,
    });
    this.xmlBuilder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '_',
      textNodeName: '$text',
      format: true,
    });
  }
```

### 2.2 Typed Methods

```typescript
// GET /ISAPI/System/deviceInfo
async getDeviceInfo(): Promise<DeviceInfoResponse>

// POST /ISAPI/AccessControl/AcsEvent?format=json
async getAcsEvents(opts: { startTime: string; endTime: string; maxResults?: number }): Promise<AcsEventsResponse>

// GET /ISAPI/AccessControl/Door/Status/1
async getDoorStatus(): Promise<DoorStatusResponse>

// PUT /ISAPI/AccessControl/RemoteControl/door/1
async controlDoor(action: 'open' | 'close' | 'alwaysOpen' | 'alwaysClose'): Promise<DoorControlResponse>
```

### 2.3 Request/Response Types (`isapi/types.ts`)

```typescript
// Device info response (from /ISAPI/System/deviceInfo)
export interface DeviceInfoResponse {
  DeviceInfo: {
    deviceName: string;
    deviceID: string;
    model: string;
    serialNumber: string;
    firmwareVersion: string;
    macAddress: string;
  };
}

// ACS Events response (from POST /ISAPI/AccessControl/AcsEvent)
export interface AcsEventsResponse {
  responseStatus: string;   // "OK" or "failed"
  numOfMatches: number;
  AcsEvent?: Array<{
    time: string;           // ISO 8601: "2024-01-15T10:30:00+00:00"
    major: number;          // Event major code (3 = card, 5 = face, etc.)
    minor: number;          // Event minor code
    employeeNoString: string;
    name: string;
    cardReaderKind: number;
    cardNo: string;
    verifyType: string;     // "Face", "Fingerprint", "Card", "Password"
    accessControllerType: string;
  }>;
}

// Door status response (from /ISAPI/AccessControl/Door/Status/1)
export interface DoorStatusResponse {
  DoorStatus: {
    doorNo: number;
    isOpen: boolean;
    isLocked: boolean;
    alarmState: string;     // "normal", "doorOpenTimeout", etc.
  };
}

// Door control response
export interface DoorControlResponse {
  responseStatus: string;
}
```

### 2.4 Error Handling in ISAPI Client

```typescript
// Error classification for retry logic
export class IsapiError extends Error {
  constructor(
    message: string,
    public readonly type: 'network' | 'auth' | 'http_5xx' | 'http_4xx' | 'timeout' | 'parse',
    public readonly statusCode?: number,
    public readonly original?: Error,
  ) {
    super(message);
  }
}

// Retryable: network, auth, http_5xx, timeout
// Non-retryable: http_4xx (except 401 which triggers re-auth), parse errors
```

---

## 3. Supabase Client Setup

```typescript
// agent/src/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from './types.js';  // Re-exported from main project
import { config } from './config.js';

export const supabase = createClient<Database>(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,  // No auth needed with service_role
      persistSession: false,
    },
  },
);
```

**Why `service_role`**: The agent writes directly to `access_events`, updates `devices` status, and polls `door_commands`. Using `service_role` bypasses RLS — this is by design. The DB schema already includes `INSERT true` policies for system inserts. The service_role key **never leaves the agent's machine** (local network), so exposure risk is minimal.

---

## 4. Loop Scheduling Strategy

### 4.1 Scheduler Module

Each loop is an independent `setInterval` wrapped in a mutex to prevent overlapping executions:

```typescript
// Each loop module manages its own timer
class LoopGuard {
  private running = false;

  async tryRun(fn: () => Promise<void>): Promise<void> {
    if (this.running) return;   // Skip if previous iteration still running
    this.running = true;
    try {
      await fn();
    } finally {
      this.running = false;
    }
  }
}
```

### 4.2 Loop Intervals

| Loop | Interval | Purpose |
|------|----------|---------|
| Event Sync | 30s | Poll new events from device |
| Heartbeat | 60s | Check device is alive, update `last_seen_at` |
| Door Status | 10s | Poll door open/closed state |
| Command Dispatcher | 2s | Check for pending door commands |

### 4.3 Graceful Shutdown

```typescript
// index.ts
const cleanup = async () => {
  logger.info({ module: 'index' }, 'Shutting down...');
  clearInterval(eventTimer);
  clearInterval(heartbeatTimer);
  clearInterval(doorStatusTimer);
  clearInterval(commandTimer);
  process.exit(0);
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
```

---

## 5. Event Deduplication

### 5.1 Composite Key

```
dedup_key = `${event_time}|${employee_id}|${major}|${minor}`
```

### 5.2 In-Memory Tracking

```typescript
class EventSyncer {
  private lastSyncTime: Date;
  private seenKeys = new Set<string>();

  async init() {
    // On startup, fetch the last N events from Supabase to recover missed events
    const { data } = await supabase
      .from('access_events')
      .select('event_time, employee_id, major, minor')
      .order('event_time', { ascending: false })
      .limit(100);

    for (const event of data ?? []) {
      const key = `${event.event_time}|${event.employee_id}|${event.major}|${event.minor}`;
      this.seenKeys.add(key);
    }

    this.lastSyncTime = data?.[0]?.event_time
      ? new Date(data[0].event_time)
      : new Date(Date.now() - 5 * 60 * 1000); // Default: 5 min ago
  }

  async sync() {
    const events = await isapi.getAcsEvents({
      startTime: this.lastSyncTime.toISOString(),
      endTime: new Date().toISOString(),
      maxResults: 100,
    });

    const newEvents = (events.AcsEvent ?? [])
      .map((e) => ({
        dedupKey: `${e.time}|${e.employeeNoString}|${e.major}|${e.minor}`,
        raw: e,
      }))
      .filter((e) => !this.seenKeys.has(e.dedupKey));

    if (newEvents.length === 0) return;

    // Insert into Supabase
    const rows = newEvents.map((e) => ({
      device_serial: deviceInfo.serialNumber,
      employee_id: e.raw.employeeNoString,
      event_time: e.raw.time,
      major: e.raw.major,
      minor: e.raw.minor,
      event_type: classifyEventType(e.raw.major, e.raw.minor),
      verify_mode: normalizeVerifyMode(e.raw.verifyType),
      raw_payload: e.raw,
    }));

    await supabase.from('access_events').insert(rows);

    // Track seen
    for (const e of newEvents) {
      this.seenKeys.add(e.dedupKey);
    }

    // Cap the set to prevent memory growth
    if (this.seenKeys.size > 10000) {
      const arr = Array.from(this.seenKeys);
      this.seenKeys = new Set(arr.slice(-5000));
    }

    this.lastSyncTime = new Date();
  }
}
```

### 5.3 Restart Recovery

On restart, the agent fetches the last 100 events from Supabase and seeds the `seenKeys` set. This handles the case where the agent was down and missed events — the next poll window will cover the gap.

---

## 6. Error Handling Pattern

### 6.1 Backoff Formula

```typescript
// utils/backoff.ts
export function calculateBackoff(attempt: number, opts?: { minMs?: number; maxMs?: number }): number {
  const minMs = opts?.minMs ?? 1000;
  const maxMs = opts?.maxMs ?? 60000;
  const jitter = Math.random() * minMs;
  const delay = Math.min(minMs * 2 ** attempt + jitter, maxMs);
  return delay;
}
```

### 6.2 Error Classification

| Error Type | Action |
|------------|--------|
| Config validation failure | `exit(1)` — fatal |
| Device registration failure | `exit(1)` — fatal |
| Network error (ECONNREFUSED, ENOTFOUND) | Retry with backoff |
| Auth failure (401 after Digest) | Retry (creds may have changed) |
| HTTP 5xx | Retry with backoff |
| HTTP 4xx (not 401) | Log, skip, do NOT retry |
| XML parse error | Log, skip event batch |
| Supabase error | Retry with backoff |

### 6.3 Retry Wrapper

```typescript
// utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; onRetry?: (err: Error, attempt: number) => void } = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 5;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (!isRetryable(err)) throw err;
      opts.onRetry?.(err as Error, attempt);
      const delay = calculateBackoff(attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof IsapiError) {
    return err.type === 'network' || err.type === 'auth' || err.type === 'http_5xx' || err.type === 'timeout';
  }
  return true; // Default: retry unknown errors
}
```

---

## 7. Door Command Trigger Mechanism

### 7.1 New Table: `door_commands`

The agent polls this table for pending commands. The table does not exist yet — it must be created as part of Fase 2.

```sql
CREATE TYPE door_action AS ENUM ('open', 'close', 'alwaysOpen', 'alwaysClose');
CREATE TYPE door_command_status AS ENUM ('pending', 'done', 'failed');

CREATE TABLE door_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_serial TEXT NOT NULL REFERENCES devices(serial_number),
  action door_action NOT NULL,
  status door_command_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE door_commands ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create commands
CREATE POLICY "Authenticated users can create door commands"
  ON door_commands FOR INSERT TO authenticated
  WITH CHECK (true);

-- Authenticated users can view commands
CREATE POLICY "Authenticated users can view door commands"
  ON door_commands FOR SELECT TO authenticated
  USING (true);

-- System (agent) can update status
CREATE POLICY "System can update door command status"
  ON door_commands FOR UPDATE TO service_role
  USING (true);
```

### 7.2 Command Dispatcher

```typescript
// commands/dispatcher.ts
class CommandDispatcher {
  async poll() {
    const { data: commands } = await supabase
      .from('door_commands')
      .select('*')
      .eq('status', 'pending')
      .eq('device_serial', config.DEVICE_SERIAL)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!commands || commands.length === 0) return;

    const cmd = commands[0];

    try {
      await isapi.controlDoor(cmd.action);
      await supabase
        .from('door_commands')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', cmd.id);
      logger.info({ module: 'dispatcher', commandId: cmd.id, action: cmd.action }, 'Door command executed');
    } catch (err) {
      await supabase
        .from('door_commands')
        .update({ status: 'failed', error_message: (err as Error).message })
        .eq('id', cmd.id);
      logger.error({ module: 'dispatcher', commandId: cmd.id, error: err }, 'Door command failed');
    }
  }
}
```

---

## 8. Sequence Diagram: Event Sync Flow

```
┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Agent   │   │  Loop    │   │  ISAPI   │   │  XML     │   │ Dedup    │   │ Supabase │
│ index.ts│   │  Timer   │   │  Client  │   │  Parser  │   │  Engine  │   │  Client  │
└────┬────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
     │             │              │              │              │              │
     │  30s tick   │              │              │              │              │
     │────────────>│              │              │              │              │
     │             │              │              │              │              │
     │             │ POST /AcsEvent             │              │              │
     │             │ {startTime, endTime}       │              │              │
     │             │─────────────>│              │              │              │
     │             │              │              │              │              │
     │             │  XML Response│              │              │              │
     │             │<─────────────│              │              │              │
     │             │              │              │              │              │
     │             │  Parse XML   │              │              │              │
     │             │────────────────────────────>│              │              │
     │             │              │              │              │              │
     │             │  Parsed events              │              │              │
     │             │<────────────────────────────│              │              │
     │             │              │              │              │              │
     │             │  Filter new (dedup)         │              │              │
     │             │───────────────────────────────────────────>│              │
     │             │              │              │              │              │
     │             │  New events only            │              │              │
     │             │<───────────────────────────────────────────│              │
     │             │              │              │              │              │
     │             │  INSERT access_events       │              │              │
     │             │────────────────────────────────────────────────────────────>│
     │             │              │              │              │              │
     │             │  Insert result              │              │              │
     │             │<────────────────────────────────────────────────────────────│
     │             │              │              │              │              │
     │             │  Log: N events synced       │              │              │
     │             │─────────────>│              │              │              │
     │             │              │              │              │              │
```

---

## 9. Dependencies

### `agent/package.json`

```json
{
  "name": "hikvision-bridge-agent",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "digest-fetch": "^1.x",
    "fast-xml-parser": "^4.x",
    "zod": "^3.x",
    "dotenv": "^16.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "eslint": "^9.x",
    "@types/node": "^22.x"
  }
}
```

### Dependency Rationale

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Supabase client (service_role) |
| `digest-fetch` | HTTP Digest Auth for ISAPI |
| `fast-xml-parser` | Parse/build XML for ISAPI requests/responses |
| `zod` | Config validation (runtime type checking) |
| `dotenv` | Load `.env` file |
| `typescript` | Type system (strict mode) |
| `tsx` | TypeScript execution (no build step) |
| `eslint` | Linting (shared config with main project) |

---

## 10. Architecture Decisions (ADRs)

### ADR-001: Separate `package.json` — Not Bundled with Next.js

**Decision**: The agent runs as an independent Node.js process with its own `package.json`, separate from the Next.js app.

**Rationale**:
- The agent runs **on the client's local network** (behind their firewall), not on Vercel
- It needs 24/7 uptime independent of the web app's deployment cycle
- Different runtime requirements: no React, no Next.js, just Node.js
- Separate deploy lifecycle: the agent is installed once per client location
- Dependency isolation: no risk of Next.js version conflicts

**Alternatives considered**:
- API Route proxy in Next.js: rejected because Next.js runs on Vercel (cloud) and cannot reach the device on the local network
- Serverless function: rejected because ISAPI polling requires persistent connections and long-running loops

---

### ADR-002: Service Role Key — Bypasses RLS

**Decision**: The agent uses `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security.

**Rationale**:
- The agent is a **system process**, not a user — RLS policies are designed for user access control
- The agent writes to `access_events`, updates `devices` status, and polls `door_commands` — all system-level operations
- The DB schema already includes `INSERT true` policies for system inserts
- The service_role key runs on the client's machine (local network) — it is never exposed to the browser or the internet
- Performance: bypassing RLS avoids policy evaluation overhead on bulk inserts

**Security considerations**:
- The `.env` file containing the key must be stored securely on the agent's host machine
- The key should have minimal permissions (only the tables the agent needs)
- The agent process should run under a dedicated, unprivileged system user

---

### ADR-003: `digest-fetch` — Native ISAPI Requirement

**Decision**: Use `digest-fetch` for HTTP Digest Authentication with the Hikvision device.

**Rationale**:
- Hikvision ISAPI endpoints **require** Digest Auth — Basic Auth is explicitly rejected
- `digest-fetch` is lightweight, has no native dependencies, and handles the full challenge-response cycle
- It wraps `node-fetch` (built into Node.js 18+ as `fetch`), so minimal additional surface area
- Alternative (`axios` + `axios-digest`) would add a heavier dependency for no additional benefit

**Alternatives considered**:
- Manual Digest Auth implementation: rejected — complex nonce handling, qop parsing, and error-prone
- `axios-digest`: rejected — heavier dependency tree for the same functionality

---

### ADR-004: `setInterval` — Simple Scheduling

**Decision**: Use `setInterval` (wrapped with a mutex guard) for loop scheduling instead of a cron library.

**Rationale**:
- The agent has **four simple periodic tasks** with fixed intervals — no complex scheduling needed
- `setInterval` is built into Node.js, zero dependencies
- The mutex guard prevents overlapping executions (if a poll takes longer than the interval, the next tick is skipped)
- No need for cron expressions, timezone handling, or complex scheduling features

**Alternatives considered**:
- `node-cron`: rejected — overkill for fixed-interval polling
- `bull` / `agenda` (job queues): rejected — requires Redis/PostgreSQL backend, too complex for 4 simple loops

---

### ADR-005: Polling for Door Commands — No Exposed Ports

**Decision**: The agent polls the `door_commands` table every 2 seconds for new rows, instead of exposing an HTTP endpoint.

**Rationale**:
- The agent runs on the **local network** with no public-facing ports — it should not be an HTTP server
- Polling is simpler, requires no firewall rules, and works behind NAT
- The 2-second interval provides near-real-time responsiveness (< 3s latency requirement from PRD)
- Supabase polling is efficient for low-volume queries (1 row per tick, indexed on `status`)

**Alternatives considered**:
- Supabase Realtime (WebSocket): viable future optimization, but adds complexity for a simple use case. Polling is sufficient for the current scale.
- HTTP endpoint on agent: rejected — requires port forwarding, firewall rules, and exposes the agent to network attacks

---

### ADR-006: `tsx` — No Build Step

**Decision**: Use `tsx` for execution (direct TypeScript runtime) instead of compiling with `tsc` first.

**Rationale**:
- The agent is a long-running process, not a bundled web app — no need for minification or tree-shaking
- `tsx` handles TypeScript natively, including `esm` modules and path aliases
- Simpler deployment: no `dist/` folder, no build step in CI/CD
- Faster development iteration: `tsx watch src/index.ts` for hot reload

---

## 11. Configuration (`config.ts`)

```typescript
// agent/src/config.ts
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  // Device
  DEVICE_IP: z.string().ip(),
  DEVICE_PORT: z.coerce.number().int().positive().default(443),
  DEVICE_USERNAME: z.string().min(1),
  DEVICE_PASSWORD: z.string().min(1),
  DEVICE_SERIAL: z.string().min(1).describe('Serial number for dedup and command routing'),

  // Intervals
  EVENT_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  DOOR_STATUS_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  COMMAND_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2_000),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export const config = configSchema.parse(process.env);
```

**Fail-fast behavior**: If any required env var is missing or invalid, the agent exits immediately with a clear error message listing the failed validations. No silent defaults for critical config.

---

## 12. Logging Design

### Structured JSON Output

```json
{"level":"info","ts":"2026-04-13T14:30:00.000Z","module":"sync/events","msg":"Synced 5 events","count":5,"duration_ms":234}
{"level":"error","ts":"2026-04-13T14:30:05.000Z","module":"isapi/client","msg":"Connection refused","error":"ECONNREFUSED","retry_attempt":2,"next_retry_ms":4500}
{"level":"warn","ts":"2026-04-13T14:31:00.000Z","module":"sync/heartbeat","msg":"Device status changed","previous":"online","current":"offline"}
```

### Log Levels

| Level | When Used |
|-------|-----------|
| `error` | Network failures, auth failures, Supabase errors, command failures |
| `warn` | Device status changes, retry attempts > 2, dedup misses |
| `info` | Startup, shutdown, events synced count, heartbeats, commands executed |
| `debug` | Full request/response payloads, XML dumps, detailed timing |

---

## 13. Database Changes Required

### New Table: `door_commands`

See Section 7.1 for the full DDL. This table must be created in Supabase before the agent starts.

### No Changes to Existing Tables

The agent uses existing tables: `devices` (heartbeat updates), `access_events` (event inserts), `persons` (event correlation via employee_id).

---

## 14. Startup Sequence

```
1. Load + validate config (.env)
2. Initialize logger
3. Initialize Supabase client
4. Initialize ISAPI client
5. Device registration:
   a. GET /ISAPI/System/deviceInfo
   b. UPSERT into devices table (serial, model, firmware, ip, status=unknown)
6. Initialize event syncer (fetch last 100 events from Supabase for dedup seed)
7. Start all loops:
   a. Event sync loop (30s)
   b. Heartbeat loop (60s)
   c. Door status loop (10s)
   d. Command dispatcher loop (2s)
8. Log "Agent started" with config summary
9. Wait for SIGTERM/SIGINT
```

---

## 15. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Device rejects credentials | Low | High | Config validation catches empty creds; retry with backoff on auth failure |
| Device offline for extended period | Medium | Medium | Heartbeat loop detects, sets status=offline, continues retrying with capped backoff |
| Supabase API downtime | Low | High | Retry with backoff; events buffer in memory (up to 10K keys) |
| XML parsing breaks on firmware update | Low | Medium | Log raw XML at debug level; graceful skip of unparseable events |
| Clock skew between device and Supabase | Medium | Low | Use device's event timestamps (ISAPI returns ISO 8601), not agent time |
| `seenKeys` Set grows unbounded | Low | Low | Capped at 10K entries, trim to 5K periodically |
| Multiple agent instances running | Low | High | Document single-instance requirement; advisory lock via Supabase (future) |
| Network partition between agent and device | Medium | Medium | Exponential backoff up to 60s; device status set to offline |

---

## Next Recommended Steps

1. **Review and approve this design** — confirm module structure, dependency choices, and architecture decisions
2. **Create `door_commands` table** — run the DDL in Supabase SQL Editor
3. **Generate tasks via `/sdd-tasks`** — break this design into implementation tasks
4. **Implement via `/sdd-apply`** — build the agent module by module
5. **Verify via `/sdd-verify`** — validate against this spec

---

*Design created 13 April 2026 — Phase 2: Agente Bridge*
