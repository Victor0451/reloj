---
tags: [isapi, endpoint]
date: 2026-04-13
---

# Endpoint - Door Status

> [!info] Resumen
> Obtiene estado actual de la puerta (abierta/cerrada/alarma).

---

## Request

```
GET /ISAPI/AccessControl/Door/status/1
```

## Uso

- **Door Status Polling**: cada 10s en el agente
- Log de cambios de estado

## Ver También

- [[Agente Bridge]]
- [[Módulo - Control de Puerta]]
