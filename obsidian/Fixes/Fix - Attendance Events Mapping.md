# Fix — Attendance Events Mapping

> [!info]
> Fix implementado el 27-Abr-2026 para corregir el mapeo de eventos de asistencia del reloj Hikvision DS-K1T320MFWX.
>
> **SDD**: `attendance-events-mapping`
> **Estado**: ✅ Implementado y verificado

---

## 1. Problema

### 1.1 Symptom

Los eventos de asistencia (check-in, check-out) se mostraban en la tabla con tipos incorrectos:

| Lo que debería mostrar | Lo que mostraba |
|----------------------|----------------|
| Entrada / Salida | duress_alarm |
| Check-In | Overtime Out |
| Check-Out | access_denied |

### 1.2 Causa Raíz

En `hikvision.adapter.ts`, el método `mapEventType()` usaba solo el valor de `major` para determinar el tipo de evento:

```typescript
// ANTES (incorrecto)
private mapEventType(major: number, minor: number): string {
  switch (major) {
    case 1: return "access_granted";
    case 2: return "access_denied";
    case 3: return "door_open";
    case 4: return "door_close";
    case 5: return "duress_alarm";  // ❌ Todos major=5 se mapeaban a duress_alarm
    // ...
  }
}
```

**Problem**: El reloj Hikvision emite eventos de asistencia con `major=5, minor=38`. Todos estos eventos se mapeaban a "duress_alarm" porque el código ignoraba el campo `attendanceStatus`.

### 1.3 Payload del Reloj

El reloj devuelve eventos ricos con datos de asistencia:

```json
{
  "major": 5,
  "minor": 38,
  "time": "2026-04-26T21:57:44-03:00",
  "name": "vic",
  "employeeNoString": "2",
  "serialNo": 187,
  "attendanceStatus": "checkOut",
  "label": "Check Out",
  "currentVerifyMode": "cardOrFaceOrFp",
  "doorNo": 1,
  "cardReaderNo": 1
}
```

El campo `attendanceStatus` contiene el tipo real de evento de asistencia.

---

## 2. Solución Implementada

### 2.1 Nuevo Mapeo de Eventos

Se modificó `parseJsonEvents()` en `hikvision.adapter.ts` para usar `attendanceStatus` cuando está disponible:

```typescript
// DESPUÉS (correcto)
let eventType: string;
if (event.major === 5 && event.minor === 38) {
  // Usar attendanceStatus para eventos de asistencia
  const status = event.attendanceStatus;
  if (status && typeof status === 'string' && status.trim() !== '') {
    eventType = status.trim();  // "checkIn", "checkOut", "overTimeOut"
  } else {
    eventType = "attendance_unknown";  // Fallback
  }
} else {
  // Para otros eventos, usar mapEventType() clásico
  eventType = this.mapEventType(Number(event.major), Number(event.minor));
}
```

### 2.2 Campos Adicionales Capturados

Se agregaron 4 columnas a la tabla `access_events`:

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `device_serial_no` | TEXT | Número de serie del evento en el reloj |
| `door_no` | INTEGER | Número de puerta/lector |
| `card_reader_no` | INTEGER | Número del reader que procesó |
| `label` | TEXT | Label original del reloj ("Check In", etc) |

### 2.3 Clave de Deduplicación

Se actualizó para incluir `cardReaderNo` y evitar duplicados en escenarios multi-reader:

```typescript
// ANTES
const dedupKey = `${employeeId}-${eventTime.getTime()}`;

// DESPUÉS
const dedupKey = `${employeeId}-${eventTime.getTime()}-${event.cardReaderNo || '0'}`;
```

---

## 3. Cambios en Archivos

| Archivo | Cambio |
|---------|--------|
| `agent/src/adapters/hikvision.adapter.ts` | parseJsonEvents() usa attendanceStatus |
| `agent/src/core/interfaces.ts` | Agregados campos deviceSerialNo, cardReaderNo, label |
| `agent/src/sync/event-sync-loop.ts` | Nuevas columnas en insert, dedup key actualizado |
| `supabase/migrations/008_add_attendance_columns.sql` | Migration con 4 columnas + 2 índices |

---

## 4. Labels en Frontend

Se actualizó el mapping en `events-table.tsx`:

| event_type | Label Display |
|------------|--------------|
| `checkIn` | Entrada ✅ |
| `checkOut` | Salida ✅ |
| `overTimeOut` | Salida ext. |
| `attendance_unknown` | Evento |
| `duress_alarm` | Alarma |
| `access_granted` | Permitido |
| `access_denied` | Denegado |

---

## 5. Verificación

### 5.1 Test con curl

```bash
curl --digest -u 'admin:evol@2601' \
-X POST -H "Content-Type: application/json" \
-d '{
  "AcsEventCond": {
    "searchID": "9",
    "searchResultPosition": 0,
    "maxResults": 20,
    "major": 5,
    "minor": 38,
    "startTime": "2026-04-26T00:00:00-03:00",
    "endTime": "2026-04-26T23:59:59-03:00"
  }
}' \
"http://192.168.100.60/ISAPI/AccessControl/AcsEvent?format=json"
```

Respuesta validada con `attendanceStatus`:
```json
{
  "AcsEvent": {
    "InfoList": [{
      "major": 5,
      "minor": 38,
      "attendanceStatus": "checkOut",
      "label": "Check Out",
      "name": "vic",
      "employeeNoString": "2"
    }]
  }
}
```

### 5.2 Condiciones del Evento de Asistencia

| Campo | Valor | Significado |
|-------|-------|-------------|
| `major` | 5 | Evento de control de acceso |
| `minor` | 38 | Autenticación exitosa |
| `attendanceStatus` | checkIn/checkOut/overTimeOut | Tipo de marcación |

---

## 6. Related Notes

- [[Módulo - Eventos]] — Módulo de eventos en el front
- [[Operación - Sincronización de Personas]] — Sincronización bidireccional de personas
- [[Referencia ISAPI]] — Endpoints ISAPI del dispositivo

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 27-Apr-2026 | Creado — documenta el fix de attendance events |
