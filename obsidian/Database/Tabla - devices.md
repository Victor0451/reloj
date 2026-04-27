---
tags: [database, tabla]
date: 2026-04-13
---

# Tabla - devices

> [!info] Propósito
> Registro de dispositivos Hikvision gestionados.

---

## Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | ID único |
| `name` | TEXT NOT NULL | Nombre amigable |
| `serial_number` | TEXT UNIQUE | Serial Hikvision |
| `model` | TEXT | Modelo |
| `ip_address` | TEXT | IP en red local |
| `firmware_version` | TEXT | Versión firmware |
| `status` | `device_status` | online/offline/unknown |
| `last_seen_at` | TIMESTAMPTZ | Último heartbeat |
| `location` | TEXT | Ubicación física |

## Ver También

- [[Agente Bridge]]
- [[Tabla - door_commands]]
