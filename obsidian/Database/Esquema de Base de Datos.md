---
tags: [database, esquema, supabase]
date: 2026-04-13
---

# Esquema de Base de Datos

> [!info] Resumen
> 6 tablas en Supabase PostgreSQL con RLS, triggers y enums personalizados.

---

## Diagrama ER

```
auth.users (1) ──── (1) profiles
                      │
                      │ (FK por audit_logs)
                      │
           ┌──────────┴──────────┐
           ▼                    ▼
      persons (N)          audit_logs (N)
           │
           │ (FK person_id)
           ▼
    access_events (N)

    devices (1) ──── (N) door_commands
```

---

## Tablas

| Tabla | Propósito | [[Tabla - profiles|→]] |
|-------|-----------|-----|
| `profiles` | Extiende auth.users con rol y datos | [[Tabla - profiles]] |
| `persons` | Empleados registrados en el reloj | [[Tabla - persons]] |
| `access_events` | Eventos de acceso (fichajes) | [[Tabla - access_events]] |
| `devices` | Registro de dispositivos Hikvision | [[Tabla - devices]] |
| `audit_logs` | Log inmutable de acciones | [[Tabla - audit_logs]] |
| `door_commands` | Queue para control remoto de puerta | [[Tabla - door_commands]] |

---

## Enums

| Enum | Valores | Uso |
|------|---------|-----|
| `person_status` | `active`, `inactive`, `pending_sync` | [[Tabla - persons]] |
| `device_status` | `online`, `offline`, `unknown` | [[Tabla - devices]] |
| `user_role` | `admin`, `hr_operator`, `supervisor`, `technician` | [[Tabla - profiles]] |

---

## Triggers

| Trigger | Función | Tabla |
|---------|---------|-------|
| `on_auth_user_created` | Crea perfil automáticamente | `auth.users → profiles` |
| `set_updated_at_profiles` | Actualiza timestamp | `profiles` |
| `set_updated_at_persons` | Actualiza timestamp | `persons` |

---

## Migraciones

| # | Archivo | Descripción |
|---|---------|-------------|
| 001 | `supabase/migrations/001_create_door_commands.sql` | Crea tabla `door_commands` |
| 002 | `supabase/migrations/002_fix_handle_new_user_trigger.sql` | Fix `raw_user_meta_data` en trigger |

---

## Ver También

- [[Esquema de Base de Datos]]
- [[Agente Bridge]] (escribe en `access_events`, `devices`)
- [[Módulo - Personas]] (lee/escribe en `persons`)
