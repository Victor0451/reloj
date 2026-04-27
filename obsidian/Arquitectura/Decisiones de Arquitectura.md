---
tags: [arquitectura, decisiones]
date: 2026-04-13
---

# Decisiones de Arquitectura

> [!info] Resumen
> ADRs (Architecture Decision Records) del proyecto.

---

## ADRs

| # | Título | Decisión | Motivo |
|---|--------|----------|--------|
| 001 | Router pattern | App Router | SSR, Server Components, layouts anidados |
| 002 | Backend | Supabase como backend completo | PostgreSQL + Auth + Realtime, sin backend propio |
| 003 | SSR client | @supabase/ssr | Manejo correcto de cookies en App Router |
| 004 | UI library | shadcn/ui | Copy-paste, customización total, Radix UI |
| 005 | Auth pattern | Server Actions | Menos boilerplate, tipado automático |
| 006 | Middleware | Sin bloqueo | Evita redirect loops, páginas verifican auth |
| 007 | TypeScript | Estricto | Autocompletado en queries, detección errores |
| 008 | Agente | package.json separado | Corre en red local, no en Vercel |

## Ver También

- [[Arquitectura del Sistema]]
- [[Stack Tecnológico]]
