---
tags: [arquitectura, sistema]
date: 2026-04-13
---

# Arquitectura del Sistema

> [!abstract] Resumen
> Sistema de 3 capas: Next.js en Vercel → Supabase Cloud → Agente Bridge → Hikvision ISAPI.

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        USUARIO                              │
│                    (Navegador Web)                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE PRESENTACIÓN                      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Next.js 16 (App Router)               │    │
│  │                    Vercel                          │    │
│  │                                                    │    │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────┐ │    │
│  │  │ (auth)   │  │(dashboard) │  │ Server Actions│ │    │
│  │  │ /login   │  │ /dashboard │  │               │ │    │
│  │  │ /signup  │  │ /persons   │  │ • auth        │ │    │
│  │  │          │  │ /events    │  │ • persons     │ │    │
│  │  │          │  │ /reports   │  │ • door        │ │    │
│  │  └──────────┘  └────────────┘  └───────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ @supabase/ssr + REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE DATOS                             │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │                    Supabase Cloud                  │    │
│  │                                                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │    │
│  │  │PostgreSQL│  │  Auth    │  │    Storage      │ │    │
│  │  │(Tablas+  │  │(Usuarios,│  │  (Fotos, Files) │ │    │
│  │  │  RLS)    │  │   JWT)   │  │                 │ │    │
│  │  └──────────┘  └──────────┘  └─────────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ WebSocket / HTTP Polling
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE INTEGRACIÓN                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │              [[Agente Bridge]] (Node.js)           │    │
│  │            (Red local del cliente)                 │    │
│  │                                                    │    │
│  │  ┌──────────┐  ┌────────────┐  ┌───────────────┐ │    │
│  │  │  Proxy   │  │  Sincroniz.│  │   Heartbeat   │ │    │
│  │  │  ISAPI   │  │  Eventos   │  │   Monitor     │ │    │
│  │  └──────────┘  └────────────┘  └───────────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ HTTPS + Digest Auth + ISAPI
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                   CAPA DE DISPOSITIVO                       │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │        [[Dispositivo - DS-K1T320MFWX]]             │    │
│  │          IP: 192.168.1.175 (red local)             │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Decisiones Clave

| # | Decisión | [[Decisiones de Arquitectura|Ref]] |
|---|----------|-----|
| 1 | Next.js App Router (no Pages) | ADR-001 |
| 2 | Supabase como backend completo | ADR-002 |
| 3 | @supabase/ssr para SSR | ADR-003 |
| 4 | shadcn/ui (componentes copy-paste) | ADR-004 |
| 5 | Server Actions para auth | ADR-005 |
| 6 | Middleware sin bloqueo | ADR-006 |
| 7 | TypeScript estricto | ADR-007 |
| 8 | Agente separado de Next.js | ADR-008 |

---

## Ver También

- [[Stack Tecnológico]]
- [[Seguridad]]
- [[Esquema de Base de Datos]]
- [[Fases]]
