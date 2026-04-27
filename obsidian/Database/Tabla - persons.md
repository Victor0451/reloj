---
tags: [database, tabla, personas]
date: 2026-04-13
---

# Tabla - persons

> [!info] Propósito
> Empleados registrados en el reloj biométrico.

---

## Columnas

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| `id` | UUID | PK, `gen_random_uuid()` | ID interno |
| `employee_id` | TEXT | nullable | Número de empleado |
| `name` | TEXT | NOT NULL | Nombre completo |
| `department` | TEXT | nullable | Área/departamento |
| `card_number` | TEXT | nullable | Número de tarjeta RFID |
| `face_photo_url` | TEXT | nullable | URL foto en Supabase Storage |
| `device_employee_no` | INTEGER | nullable | ID asignado por el reloj |
| `status` | `person_status` | NOT NULL, default `pending_sync` | Estado |
| `created_at` | TIMESTAMPTZ | NOT NULL | Fecha creación |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Última modificación |

## RLS Policies

| Política | Acción | Condición |
|----------|--------|-----------|
| Authenticated users can view | SELECT | `auth.role() = 'authenticated'` |
| HR and Admins can manage | ALL | rol = `admin` o `hr_operator` |

## Ver También

- [[Módulo - Personas]]
- [[Esquema de Base de Datos]]
- [[Fase 3 - Gestión de Personas]]
