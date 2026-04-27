---
tags: [fase, completado]
date: 2026-04-21
dateCompleted: 2026-04-21
---

# Fase 4 - Eventos y Dashboard

> [!done] Estado: **Completado** ✅
> Listado de eventos en tiempo real, dashboard con KPIs, filtros avanzados.

## Dependencias

- [[Fase 2 - Agente Bridge]] ✅
- [[Fase 3 - Gestión de Personas]] ✅

## Deliverables

| Deliverable | Archivo |
|-------------|---------|
| EventsTable component | `src/components/events/events-table.tsx` |
| Server actions (list/count/export) | `src/actions/events.ts` |
| Events page | `src/app/(dashboard)/dashboard/events/page.tsx` |
| Dashboard recent events | `src/app/(dashboard)/dashboard/page.tsx` |
| Person name join | `src/actions/events.ts`, dashboard/page.tsx |

## Resumen

- **EventsTable**: tabla completa con filtros (fecha, tipo, persona), paginación cursor-based, polling 30s, exportación CSV
- **Server Actions**: `listEvents` con join batch a `persons` por `employee_id`, `countEvents`, `exportEventsCsv`, `getEventTypes`
- **Dashboard**: sección "Últimos Eventos" con los últimos 10 eventos + join a nombres + link "Ver todos"
