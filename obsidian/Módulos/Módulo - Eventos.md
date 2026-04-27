---
tags: [modulo, eventos]
date: 2026-04-21
status: completado
---

# Módulo - Eventos

> [!done] Estado: **Completado** — [[Fase 4 - Eventos y Dashboard]] ✅
> Listado de eventos en tiempo real con filtros y exportación.

---

## Implementación

| Función | Estado | Archivo |
|---------|--------|---------|
| Tabla de eventos con paginación | ✅ | `components/events/events-table.tsx` |
| Filtros: persona, fecha, tipo, resultado | ✅ | `components/events/events-table.tsx` |
| Polling automático 30s | ✅ | `components/events/events-table.tsx` |
| Exportación CSV | ✅ | `actions/events.ts` |
| Servidor de eventos (realtime) | ✅ | `actions/events.ts` |
| Persona name join (batch lookup) | ✅ | `actions/events.ts` |

## Detalles Técnicos

- **Server Actions**: `listEvents`, `countEvents`, `exportEventsCsv`, `getEventTypes` en `src/actions/events.ts`
- **Paginación**: Cursor-based con `event_time` como cursor, 50 registros por página
- **Join de personas**: Batch lookup por `employee_id` para mostrar nombre en tabla
- **CSV Export**: Hasta 10,000 registros con escape de comas y comillas
- **Realtime**: Polling cada 30s via `useRouter.refresh()` en el cliente

## Ver También

- [[Fase 4 - Eventos y Dashboard]]
- [[Tabla - access_events]]
- [[Agente Bridge]]
