# Agent Bridge — Hikvision ISAPI → Supabase

Node.js agent that runs on the client's local network, communicates with a Hikvision biometric clock via ISAPI/HTTPS, and syncs data with Supabase.

## Architecture

```
[Agent Bridge (Node.js)] --ISAPI/HTTPS(Digest Auth)--> [Hikvision DS-K1T320MFWX]
        |
        | --Supabase SDK (service_role)-->
        v
[Supabase Cloud (PostgreSQL + Auth + Realtime)]
```

The agent runs **continuous sync loops** via the adapter pattern:
- **Heartbeat** — every 60s, calls `deviceInfo()` through HikvisionAdapter, updates `devices.is_online`
- **Event Sync** — every 30s, polls access events through adapter, inserts into `access_events`
- **Person Sync** — bidirectional sync of persons between device and DB via HikvisionAdapter
- **Command Dispatcher** — every 2s, polls `door_commands` table for pending commands

The agent **does NOT expose any HTTP ports**. It makes outbound-only calls.

## Setup

### 1. Install Dependencies

```bash
cd agent
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | `eyJ...` |
| `DEVICE_IP` | IP address of Hikvision device | `192.168.1.175` |
| `DEVICE_PORT` | Port for ISAPI (usually 443) | `443` |
| `DEVICE_USERNAME` | Device username | `admin` |
| `DEVICE_PASSWORD` | Device password | `your-password` |
| `POLL_INTERVAL_MS` | Event sync interval (default: 30s) | `30000` |
| `HEARTBEAT_INTERVAL_MS` | Heartbeat interval (default: 60s) | `60000` |
| `DOOR_POLL_INTERVAL_MS` | Door status poll interval (default: 10s) | `10000` |
| `COMMAND_POLL_INTERVAL_MS` | Command dispatcher interval (default: 2s) | `2000` |
| `LOG_LEVEL` | Log level: debug, info, warn, error | `info` |

### 3. Run Database Migration

Create the `door_commands` table in Supabase:

```bash
# Run the SQL in supabase/migrations/001_create_door_commands.sql
# via Supabase Dashboard → SQL Editor
```

### 4. Start the Agent

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

## Project Structure

```
agent/
├── src/
│   ├── index.ts              # Entry point — starts all modules
│   ├── config.ts             # Env var loading + zod validation
│   ├── supabase.ts           # Supabase client (service_role)
│   ├── types.ts              # Shared TypeScript types
│   ├── adapters/             # Device protocol adapters
│   │   └── hikvision.adapter.ts  # Hikvision ISAPI adapter implementation
│   ├── core/                 # Core domain interfaces and adapter manager
│   │   ├── interfaces.ts     # DevicePort, DataPort, EventPort interfaces
│   │   ├── adapter-manager.ts # Adapter registry and lifecycle management
│   │   └── index.ts
│   ├── sync/                 # Sync loop implementations (adapter pattern)
│   │   ├── heartbeat-loop.ts    # Heartbeat (60s) — device status via adapter
│   │   ├── event-sync-loop.ts   # Event sync (30s) — access events via adapter
│   │   ├── person-sync-loop.ts   # Person sync — bidirectional via adapter
│   │   ├── registerDevice.ts    # Device registration on startup
│   │   ├── dedup.ts             # Event deduplication
│   │   ├── legacy/              # Archived legacy implementations (git mv'd)
│   │   │   ├── heartbeat.ts     # Original (replaced by heartbeat-loop.ts)
│   │   │   ├── syncEvents.ts    # Original (replaced by event-sync-loop.ts)
│   │   │   └── persons.ts       # Original (replaced by person-sync-loop.ts)
│   │   └── legacy/README.md     # Archive documentation
│   ├── commands/
│   │   ├── executeDoorCommand.ts  # Door open/close execution
│   │   └── dispatcher.ts     # Command dispatcher (2s poll)
│   └── utils/
│       ├── logger.ts         # Structured JSON logging
│       ├── backoff.ts        # Exponential backoff with jitter
│       ├── retry.ts          # Retry wrapper
│       ├── shutdown.ts       # Graceful shutdown
│       └── errorHandler.ts   # Top-level error handling
├── tests/
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Adapter Pattern Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sync Loop (e.g., heartbeat-loop.ts)         │
│  - Orchestrates sync logic                                       │
│  - Handles timing, retries, error recovery                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │ calls
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AdapterManager (core/adapter-manager.ts)      │
│  - Registry of device adapters                                   │
│  - Lifecycle management                                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ uses
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              DevicePort Interface (core/interfaces.ts)         │
│  - Defines contract: deviceInfo(), getEvents(), putPerson(), etc │
└──────────┬─────────────────────────────┬───────────────────────┘
           │ implements                   │ implements
           ▼                             ▼
┌──────────────────────┐    ┌────────────────────────────────────┐
│ HikvisionAdapter     │    │ (future adapters: Dahua, ZKTeco...) │
│ (adapters/hikvision) │    │                                    │
│ - ISAPI/HTTPS        │    │                                    │
│ - Digest Auth        │    │                                    │
└──────────────────────┘    └────────────────────────────────────┘
```

**Key Principle**: Sync loops NEVER call ISAPI directly. They call through the adapter interface. This allows:
- Device protocol changes without modifying sync logic
- Easy testing via mock adapters
- Support for multiple device brands

## Error Handling

- **Fatal errors** (config validation, device registration): agent exits with code 1
- **Non-fatal errors** (network, ISAPI): retry with exponential backoff (capped at 60s)
- **Offline detection**: if device unreachable for >120s, status set to "offline"

## Logs

Structured JSON logging, one object per line:

```json
{"timestamp":"2026-04-13T16:00:00.000Z","level":"info","module":"heartbeat","msg":"Device online","serial":"ABC123"}
```

Configure `LOG_LEVEL` to control verbosity: `debug` < `info` < `warn` < `error`

## Process Management

For production, run with PM2 or systemd:

```bash
pm2 start npm --name "agent-bridge" -- start
pm2 save
pm2 startup
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Digest auth failed" | Check DEVICE_USERNAME/DEVICE_PASSWORD |
| "Connection refused" | Verify DEVICE_IP is reachable from agent machine |
| "Invalid service_role_key" | Check SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard → Settings → API |
| No events syncing | Check device is recording events; verify POLL_INTERVAL_MS |
| Agent crashes on startup | Check all required env vars are set in .env |
