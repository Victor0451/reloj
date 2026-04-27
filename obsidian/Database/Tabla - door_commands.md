---
tags: [database, tabla]
date: 2026-04-13
---

# Tabla - door_commands

> [!info] Propósito
> Queue para comandos remotos de apertura/cierre de puerta. El [[Agente Bridge]] poll esta tabla cada 2s.

---

## Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | ID único |
| `device_id` | UUID FK → devices | Dispositivo destino |
| `device_serial` | TEXT FK → devices | Serial para lookup rápido |
| `door_no` | INTEGER | Número de puerta (default 1) |
| `action` | TEXT | open, close, alwaysopen, alwaysclose |
| `status` | TEXT | pending, completed, failed |
| `error_message` | TEXT | Error si falló |
| `requested_by` | UUID FK → auth.users | Quién pidió el comando |
| `created_at` | TIMESTAMPTZ | Fecha creación |
| `completed_at` | TIMESTAMPTZ | Fecha completado |

## Índice

`idx_door_commands_status_created` → (status, created_at DESC) para polling eficiente.

## Ver También

- [[Módulo - Control de Puerta]]
- [[Agente Bridge]]
