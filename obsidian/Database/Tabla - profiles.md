---
tags: [database, tabla]
date: 2026-04-13
---

# Tabla - profiles

> [!info] Propósito
> Extiende auth.users con rol y datos del operador del sistema.

---

## Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK, FK → auth.users | Mismo ID que auth |
| `email` | TEXT NOT NULL | Email del usuario |
| `full_name` | TEXT | Nombre completo |
| `role` | `user_role` NOT NULL | Rol en el sistema |
| `created_at` | TIMESTAMPTZ | Fecha creación |
| `updated_at` | TIMESTAMPTZ | Última modificación |

## Trigger

`on_auth_user_created` → crea perfil automáticamente al registrar usuario.

## Ver También

- [[Módulo - Auth]]
- [[Esquema de Base de Datos]]
