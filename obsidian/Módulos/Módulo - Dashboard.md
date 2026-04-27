---
tags: [modulo, dashboard]
date: 2026-04-21
status: completado
---

# Módulo - Dashboard

> [!info] Resumen
> Página principal con KPIs en tiempo real y estado del sistema.

---

## Componentes

| Archivo | Función |
|---------|---------|
| `dashboard/page.tsx` | KPI cards + últimos eventos + "Ver todos" link |
| `dashboard/layout.tsx` | Sidebar + header + theme toggle |

## KPIs Actuales

| KPI | Fuente | Cálculo |
|-----|--------|---------|
| Total Personas | `persons` | `COUNT(*)` |
| Eventos Hoy | `access_events` | `COUNT WHERE event_time >= today` |
| Estado Dispositivo | `devices` | `status` |
| Estado Puerta | `door_commands` | último comando |

## Últimos Eventos (Fase 4)

- **Sección funcional**: muestra los últimos 10 eventos con join a `persons.name`
- **Person name join**: batch lookup por `employee_id` para mostrar nombre de persona
- **Link "Ver todos"**: conecta directamente a `/dashboard/events`
- **Badges de tipo**: Entrada (verde) / Salida (gris) según `event_type`

## Ver También

- [[Módulo - Auth]]
- [[Módulo - Eventos]]
- [[Agente Bridge]]
