---
tags: [database, tabla]
date: 2026-04-13
---

# Tabla - audit_logs

> [!warning] Inmutable
> No existen políticas de DELETE ni UPDATE. Los audit logs son inmutables por diseño.

---

## Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | ID único |
| `user_id` | UUID FK → auth.users | Operador que realizó la acción |
| `action` | TEXT | create_person, delete_person, open_door, etc. |
| `target_type` | TEXT | person, device, door |
| `target_id` | TEXT | ID de la entidad afectada |
| `details` | JSONB | Datos adicionales |
| `created_at` | TIMESTAMPTZ | Timestamp |

## Ver También

- [[Módulo - Auditoría]]
- [[Esquema de Base de Datos]]
