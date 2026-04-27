---
tags: [database, tabla]
date: 2026-04-13
---

# Tabla - access_events

> [!info] Propósito
> Eventos de acceso (fichajes) capturados del reloj.

---

## Columnas

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | ID único |
| `device_serial` | TEXT | Serial del reloj |
| `person_id` | UUID FK → persons | Persona identificada |
| `employee_id` | TEXT | ID según reloj |
| `event_time` | TIMESTAMPTZ | Timestamp del evento |
| `major` | INTEGER | Código mayor Hikvision |
| `minor` | INTEGER | Código menor Hikvision |
| `event_type` | TEXT | access_granted, access_denied, etc. |
| `verify_mode` | TEXT | face, card, fingerprint, password |
| `raw_payload` | JSONB | Payload completo para auditoría |
| `synced_at` | TIMESTAMPTZ | Cuándo se sincronizó |

## Índices

| Índice | Columna | Propósito |
|--------|---------|-----------|
| `idx_access_events_event_time` | event_time DESC | Consultas por fecha |
| `idx_access_events_person_id` | person_id | Filtrar por persona |
| `idx_access_events_event_type` | event_type | Filtrar por tipo |

## Ver También

- [[Módulo - Eventos]]
- [[Agente Bridge]]
