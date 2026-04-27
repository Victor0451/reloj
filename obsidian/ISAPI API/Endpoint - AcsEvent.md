---
tags: [isapi, endpoint]
date: 2026-04-13
---

# Endpoint - AcsEvent

> [!info] Resumen
> Consulta eventos de acceso del reloj.

---

## Request

```
POST /ISAPI/AccessControl/AcsEvent
```

Body XML con criterios de búsqueda (startTime, endTime, maxResults).

## Uso

- **Event Sync**: cada 30s para sincronizar fichajes
- Inserta en tabla `access_events`

## Ver También

- [[Agente Bridge]]
- [[Módulo - Eventos]]
- [[Tabla - access_events]]
