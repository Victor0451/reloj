---
tags: [modulo, agente]
date: 2026-04-13
---

# Agente Bridge

> [!success] Estado: **Completado** ✅
> Agente Node.js standalone que comunica Hikvision ISAPI con Supabase.

---

## Estructura

```
agent/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Zod validation
│   ├── supabase.ts           # Supabase client (service_role)
│   ├── isapi/
│   │   ├── client.ts         # HTTP + Digest Auth
│   │   ├── xml.ts            # XML parsing (fast-xml-parser)
│   │   └── methods.ts        # Typed ISAPI methods
│   ├── sync/
│   │   ├── registerDevice.ts # Device registration
│   │   ├── heartbeat.ts      # 60s loop
│   │   ├── syncEvents.ts     # 30s loop + dedup
│   │   └── pollDoorStatus.ts # 10s loop
│   ├── commands/
│   │   ├── executeDoorCommand.ts
│   │   └── dispatcher.ts     # 2s poll door_commands
│   └── utils/
│       ├── logger.ts         # Structured JSON
│       ├── backoff.ts        # Exponential + jitter
│       ├── shutdown.ts       # Graceful SIGTERM
│       └── errorHandler.ts   # uncaughtException handler
├── .env.example
├── package.json
└── tsconfig.json
```

## Loops

| Loop | Intervalo | Qué hace |
|------|-----------|----------|
| Heartbeat | 60s | `GET /ISAPI/System/deviceInfo` → update `devices` |
| Event Sync | 30s | `POST /ISAPI/AccessControl/AcsEvent` → insert `access_events` |
| Door Status | 10s | `GET /ISAPI/AccessControl/Door/status/1` |
| Command Dispatcher | 2s | Poll `door_commands` → execute via ISAPI |

## Ver También

- [[Fase 2 - Agente Bridge]]
- [[Referencia ISAPI]]
- [[Agente Bridge - Guía de Instalación]]
