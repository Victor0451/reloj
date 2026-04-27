---
tags: [isapi, endpoint]
date: 2026-04-13
---

# Endpoint - Door Control

> [!info] Resumen
> Control remoto de apertura/cierre de puerta.

---

## Endpoints

| Método | Endpoint | Función |
|--------|----------|---------|
| PUT | `/ISAPI/AccessControl/RemoteControl/door/1` | Abrir/cerrar |
| PUT | `/ISAPI/AccessControl/Door/param/1` | Configurar |

## Acciones

- `open` — abrir puerta
- `close` — cerrar puerta
- `alwaysopen` — mantener abierta
- `alwaysclose` — mantener cerrada

## Ver También

- [[Módulo - Control de Puerta]]
- [[Tabla - door_commands]]
