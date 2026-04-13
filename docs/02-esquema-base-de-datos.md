# Esquema de Base de Datos - Supabase

## Descripción General

Este documento detalla el esquema completo de la base de datos PostgreSQL configurada en Supabase para el sistema de gestión biométrica Hikvision.

**Archivo SQL**: `supabase/schema.sql`

## Diagrama de Entidades

```
┌─────────────┐       ┌──────────────┐
│ auth.users  │1────1 │  profiles    │
└──────┬──────┘       └──────────────┘
       │
       │ 1
       │
       │ N
       │
  ┌────┴─────────────────────┐
  │                          │
  ▼ N                        ▼ N
┌──────────┐          ┌───────────────┐
│ persons  │1────N    │ access_events │
└──────────┘          └───────────────┘

┌──────────┐
│ devices  │
└──────────┘

┌────────────┐
│ audit_logs │
└──────┬─────┘
       │
       │ N
       │
       ▼ 1
┌─────────────┐
│ auth.users  │
└─────────────┘
```

## Enums Personalizados

### `person_status`

Estado de una persona en el sistema.

| Valor | Descripción |
|-------|-------------|
| `active` | Persona activa y sincronizada con el reloj |
| `inactive` | Persona dada de baja |
| `pending_sync` | Persona registrada pero aún no sincronizada con el reloj |

### `device_status`

Estado de conectividad del dispositivo.

| Valor | Descripción |
|-------|-------------|
| `online` | Dispositivo conectado y respondiendo |
| `offline` | Dispositivo no accesible |
| `unknown` | Estado no determinado (recién creado o sin heartbeat) |

### `user_role`

Roles de usuario para el sistema.

| Valor | Descripción | Permisos |
|-------|-------------|----------|
| `admin` | Administrador del sistema | Control total |
| `hr_operator` | Operador de recursos humanos | Gestionar personas, ver eventos y reportes |
| `supervisor` | Supervisor de monitoreo | Solo lectura |
| `technician` | Técnico de mantenimiento | Gestión del dispositivo |

---

## Tablas

### 1. `profiles`

Extiende los usuarios de Supabase Auth con información adicional y roles para el sistema.

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| `id` | UUID | PK, FK → auth.users(id) | Mismo ID que el usuario de auth |
| `email` | TEXT | NOT NULL | Email del usuario |
| `full_name` | TEXT | nullable | Nombre completo |
| `role` | user_role | NOT NULL, DEFAULT 'hr_operator' | Rol en el sistema |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Última modificación |

**Row Level Security:**

| Política | Acción | Condición |
|----------|--------|-----------|
| "Users can view own profile" | SELECT | auth.uid() = id |
| "Admins can view all profiles" | SELECT | El usuario actual es admin |
| "Users can update own profile" | UPDATE | auth.uid() = id |
| "Admins can manage all profiles" | ALL | El usuario actual es admin |

---

### 2. `persons`

Almacena las personas (empleados) registradas en el reloj biométrico.

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único interno |
| `employee_id` | TEXT | nullable | Número de empleado |
| `name` | TEXT | NOT NULL | Nombre completo |
| `department` | TEXT | nullable | Área o departamento |
| `card_number` | TEXT | nullable | Número de tarjeta RFID |
| `face_photo_url` | TEXT | nullable | URL de la foto facial en Supabase Storage |
| `device_employee_no` | INTEGER | nullable | ID asignado por el reloj Hikvision |
| `status` | person_status | NOT NULL, DEFAULT 'pending_sync' | Estado de sincronización |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Última modificación |

**Row Level Security:**

| Política | Acción | Condición |
|----------|--------|-----------|
| "Authenticated users can view persons" | SELECT | auth.role() = 'authenticated' |
| "HR and Admins can manage persons" | ALL | El usuario es admin o hr_operator |

---

### 3. `access_events`

Registra cada evento de acceso (fichaje) capturado del reloj biométrico.

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `device_serial` | TEXT | nullable | Número de serie del reloj que capturó el evento |
| `person_id` | UUID | FK → persons(id), ON DELETE SET NULL | Persona identificada (si aplica) |
| `employee_id` | TEXT | nullable | ID de empleado según el reloj |
| `event_time` | TIMESTAMPTZ | NOT NULL | Timestamp del evento |
| `major` | INTEGER | nullable | Código mayor del evento Hikvision |
| `minor` | INTEGER | nullable | Código menor del evento Hikvision |
| `event_type` | TEXT | NOT NULL | Tipo legible: access_granted, access_denied, door_open, etc. |
| `verify_mode` | TEXT | nullable | Modo: face, card, fingerprint, password |
| `raw_payload` | JSONB | nullable | Payload completo del evento para auditoría |
| `synced_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Cuándo fue sincronizado por el agente |

**Índices:**

| Índice | Columna | Propósito |
|--------|---------|-----------|
| `idx_access_events_event_time` | event_time DESC | Consultas rápidas por fecha |
| `idx_access_events_person_id` | person_id | Filtrar por persona |
| `idx_access_events_event_type` | event_type | Filtrar por tipo de evento |

**Row Level Security:**

| Política | Acción | Condición |
|----------|--------|-----------|
| "Authenticated users can view events" | SELECT | auth.role() = 'authenticated' |
| "System can insert events" | INSERT | true (el agente usa service_role) |

---

### 4. `devices`

Registro de los relojes biométricos gestionados por el sistema.

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `name` | TEXT | NOT NULL | Nombre amigable (ej: "Entrada Principal") |
| `serial_number` | TEXT | UNIQUE, NOT NULL | Número de serie del reloj Hikvision |
| `model` | TEXT | nullable | Modelo del dispositivo |
| `ip_address` | TEXT | nullable | IP del dispositivo en la red local |
| `firmware_version` | TEXT | nullable | Versión de firmware actual |
| `status` | device_status | NOT NULL, DEFAULT 'unknown' | Estado de conexión |
| `last_seen_at` | TIMESTAMPTZ | nullable | Último heartbeat recibido |
| `location` | TEXT | nullable | Ubicación física del dispositivo |

**Row Level Security:**

| Política | Acción | Condición |
|----------|--------|-----------|
| "Authenticated users can view devices" | SELECT | auth.role() = 'authenticated' |
| "Admins and Technicians can manage devices" | ALL | El usuario es admin o technician |

---

### 5. `audit_logs`

Registro inmutable de acciones de los operadores del sistema para auditoría.

| Columna | Tipo | Constraints | Descripción |
|---------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `user_id` | UUID | FK → auth.users(id), ON DELETE SET NULL | Operador que realizó la acción |
| `action` | TEXT | NOT NULL | Tipo de acción: create_person, delete_person, open_door, etc. |
| `target_type` | TEXT | nullable | Entidad afectada: person, device, door |
| `target_id` | TEXT | nullable | ID de la entidad afectada |
| `details` | JSONB | nullable | Datos adicionales de contexto |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp de la acción |

**Índices:**

| Índice | Columna | Propósito |
|--------|---------|-----------|
| `idx_audit_logs_created_at` | created_at DESC | Consultas cronológicas |
| `idx_audit_logs_user_id` | user_id | Filtrar por operador |

**Row Level Security:**

| Política | Acción | Condición |
|----------|--------|-----------|
| "Authenticated users can view audit logs" | SELECT | auth.role() = 'authenticated' |
| "System can insert audit logs" | INSERT | true (solo el sistema) |

> **Nota**: No existen políticas de DELETE ni UPDATE. Los audit logs son inmutables por diseño.

---

## Triggers y Funciones

### Función: `handle_new_user()`

**Tipo**: Trigger function  
**Disparador**: AFTER INSERT en `auth.users`

Crea automáticamente un registro en `profiles` cuando un nuevo usuario se registra en Supabase Auth.

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  NEW.id,
  NEW.email,
  COALESCE(NEW.raw_user_metadata->>'full_name', ''),
  COALESCE(NEW.raw_user_metadata->>'role', 'hr_operator')
);
```

Los valores de `full_name` y `role` se extraen de los metadatos del usuario, que se pasan durante el signup desde la Server Action.

### Función: `handle_updated_at()`

**Tipo**: Trigger function  
**Disparador**: BEFORE UPDATE en `profiles` y `persons`

Actualiza automáticamente el campo `updated_at` a `NOW()` en cada operación UPDATE.

---

## Relaciones entre Tablas

| Origen | Destino | Tipo | On Delete |
|--------|---------|------|-----------|
| `profiles.id` | `auth.users.id` | 1:1 | CASCADE |
| `access_events.person_id` | `persons.id` | N:1 | SET NULL |
| `audit_logs.user_id` | `auth.users.id` | N:1 | SET NULL |

---

## Consideraciones de Seguridad

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado. Esto significa que:

1. Las queries solo retornan filas que el usuario tiene permiso de ver
2. El service_role key (usado por el agente bridge) puede bypass RLS si se necesita
3. Los admins tienen acceso más amplio que otros roles

### Datos Sensibles

- Las credenciales del reloj se almacenarán cifradas (fase futura con Supabase Vault)
- Las fotos faciales se guardarán en Supabase Storage con acceso privado
- Los audit logs son inmutables (sin DELETE ni UPDATE)

### Separación por Organización

En la versión v1.0, el sistema es single-organization. Para multi-tenant se agregaría:
- Una tabla `organizations`
- Un campo `organization_id` en todas las tablas principales
- Políticas RLS que filtren por organización

---

## Escalabilidad

- **Índices**: Los índices en `event_time`, `person_id` y `created_at` permiten consultas eficientes
- **JSONB**: Los campos `raw_payload` y `details` usan JSONB para consultas flexibles
- **UUIDs**: Los IDs tipo UUID son distribuidos y seguros
- **TIMESTAMPTZ**: Todos los timestamps incluyen timezone para soporte multi-zona

---

## Script SQL Completo

El archivo completo se encuentra en: `supabase/schema.sql`

Para ejecutarlo:
1. Ir a Supabase Dashboard → SQL Editor
2. Crear una nueva query
3. Pegar el contenido del archivo
4. Ejecutar con "Run"
