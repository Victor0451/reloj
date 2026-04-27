# Operación — Sincronización Bidireccional de Personas

> [!info]
> Guía de operación para el sistema de sincronización bidireccional de personas entre la base de datos Supabase y el reloj Hikvision DS-K1T320MFWX.
>
> **Última actualización**: 27-Apr-2026
> **Estado**: ✅ Implementado y verificado

---

## 1. Conceptos Fundamentales

### 1.1 Flujos de Sincronización

El sistema maneja **dos direcciones** de sincronización:

| Dirección | Descripción | Trigger | Intervalo |
|-----------|-------------|---------|-----------|
| **DB → Device** | Personas creadas en el front se suben al reloj | `pending_sync` status | 15s |
| **Device → DB** | Personas creadas directamente en el reloj se importan a la DB | polling | 60s |

### 1.2 Estados de Persona

```sql
-- Estados posibles en la tabla persons
'active'           -- Sincronizada y activa
'inactive'         -- Eliminada lógicamente
'pending_sync'    -- Esperando sync hacia el reloj
'sync_failed'      -- Sync falló (reintento automático)
'sync_dead_letter' -- Falló 3 veces, requiere intervención manual
```

### 1.3 Campos Clave

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `employee_id` | TEXT, nullable | ID de empleado proporcionado por el usuario (único) |
| `device_employee_no` | INTEGER, nullable | ID asignado por el reloj (número) |
| `card_number` | TEXT, nullable | Número de tarjeta RFID |
| `sync_attempts` | INTEGER | Cantidad de intentos de sync |
| `sync_error` | TEXT | Último mensaje de error |

---

## 2. Sincronización DB → Device

### 2.1 Flujo Normal

```
1. Usuario crea persona en el front (nombre + employee_id opcional + card_number opcional)
   ↓
2. Se inserta en DB con status: 'pending_sync'
   ↓
3. Agent detecta personas 'pending_sync' cada 15s
   ↓
4. Para cada persona:
   a. Si tiene employee_id → syncPerson() con ese ID
   b. Si NO tiene employee_id → createPersonOnDevice() → device asigna próximo número libre
   ↓
5. En caso de éxito:
   - status → 'active'
   - sync_attempts → 0
   - device_employee_no → número asignado por el reloj
   ↓
6. Si persona tiene card_number → assignCardToDevice()
```

### 2.2 Reintento Automático

| Intento | Delay | Status resultante |
|---------|-------|-------------------|
| 1 | 30s | `sync_failed` |
| 2 | 60s | `sync_failed` |
| 3 | 120s | `sync_dead_letter` |

Una vez en `sync_dead_letter`, la persona **no se reintenta automáticamente**. Requiere intervención manual.

### 2.3 Intervención Manual

Para resetear una persona en `sync_dead_letter`:

```typescript
// Función disponible en src/actions/persons.ts
await resetPersonSync(personId)
```

Esto vuelve a وضع person en `pending_sync` y resetea contadores.

---

## 3. Sincronización Device → DB

### 3.1 Flujo de Importación

```
1. Agent polluea el reloj cada 60s
   ↓
2. getPersons() obtiene todas las personas del reloj
   ↓
3. Para cada persona del reloj:
   a. Si employeeNo existe en DB como employee_id → actualizar nombre si cambió
   b. Si NO existe → crear nuevo registro en DB
   ↓
4. Conflictos (mismo employeeNo, distintos datos) → se saltan con warning
```

### 3.2 Datos Importados

| Campo del Reloj | Campo en DB | Notas |
|-----------------|-------------|-------|
| `employeeNo` | `employee_id` y `device_employee_no` | |
| `name` | `name` | Se actualiza si cambia |
| `cardNo` | `card_number` | Si está disponible |

---

## 4. Gestión de Números de Empleado

### 4.1 Reglas

1. **Con `employee_id` provided**: Se usa ese valor directamente en el reloj
2. **Sin `employee_id`**: El agent busca el **próximo número libre** en el reloj y lo usa

### 4.2 Algoritmo de Próximo Número Libre

```typescript
// Implementado en HikvisionAdapter.getNextAvailableEmployeeNo()
1. Obtener todos los employeeNo del reloj
2. Convertir a enteros, filtrar valores inválidos
3. Buscar el menor entero positivo no utilizado
4. Retornar como string
```

**Ejemplo**: Si el reloj tiene personas con ID 1, 2, 3, 5 → próximo libre es **4**

### 4.3 Números Especiales

| Formato | Significado | Comportamiento |
|---------|-------------|-----------------|
| `AUTO_xxxxxx` | Generado por sistema (legacy) | Inválido, debe regenerarse |
| `123` (numérico) | ID válido | Usado directamente |
| `TEST123` | ID alfanumérico | Puede causar problemas |

---

## 5. Asignación de Tarjetas

### 5.1 Flujo

```
1. Persona creada en DB con card_number
   ↓
2. Sync exitoso al reloj
   ↓
3. assignCardToDevice(employeeNo, cardNo)
   ↓
4. La tarjeta queda vinculada al employeeNo en el reloj
```

### 5.2 Requisitos

- La persona debe existir primero en el reloj
- La tarjeta no debe estar asignada a otra persona
- El reloj debe tener readers configurados

---

## 6. Troubleshooting

### 6.1 Persona no se sincroniza

**Síntoma**: Persona en `pending_sync` pero no aparece en el reloj.

**Debug**:
```bash
# Ver estado en DB
SELECT id, name, employee_id, status, sync_attempts, sync_error 
FROM persons 
WHERE status = 'pending_sync';

# Ver logs del agent
grep -A5 "Syncing person" /path/to/agent.log
```

**Causas comunes**:
- Agent no está corriendo
- Error de red hacia el reloj
- employeeNo inválido (legacy AUTO_xxx)

### 6.2 Persona en sync_dead_letter

**Síntoma**: Persona quedó trabada después de 3 intentos.

**Debug**:
```bash
# Ver error
SELECT id, name, sync_attempts, sync_error 
FROM persons 
WHERE status = 'sync_dead_letter';

# Ver logs
grep "Dead-letter" /path/to/agent.log
```

**Resolución**:
1. Corregir el problema (通常: employeeNo inválido, reloj no reachable)
2. `resetPersonSync(personId)` para reintentar

### 6.3 Conflictos de employeeNo

**Síntoma**: El reloj rechaza por "employeeNo already exists".

**Causa**: El `employee_id` chosen ya existe en el reloj (probablemente creado manualmente).

**Resolución**:
- Elegir otro `employee_id`
- O usar el existente (si corresponde)

---

## 7. Validación de Endpoints ISAPI

### 7.1 Endpoints Validados

| Endpoint | Método | Descripción | Status |
|----------|--------|-------------|--------|
| `/ISAPI/AccessControl/UserInfo/Record?format=json` | POST | Crear usuario | ✅ Validado |
| `/ISAPI/AccessControl/UserInfo/Search?format=json` | POST | Buscar usuario | ✅ Validado |
| `/ISAPI/AccessControl/UserInfo/Modify?format=json` | PUT | Actualizar usuario | ✅ Validado |
| `/ISAPI/AccessControl/CardInfo/Record?format=json` | POST | Asignar tarjeta | ✅ Validado |
| `/ISAPI/AccessControl/AcsEvent?format=json` | POST | Obtener eventos | ✅ Validado |

### 7.2 Códigos de Respuesta

| statusCode | statusString | Significado |
|------------|-------------|-------------|
| 1 | OK | Éxito |
| 4 | Invalid Operation | Operación no soportada |
| 5 | Invalid Format | JSON mal formado |
| 6 | MessageParametersLack | Falta parámetro (ej: employeeNo) |

---

## 8. Referencia Rápida

### Queries Comunes

```sql
-- Personas pendientes de sync
SELECT * FROM persons WHERE status = 'pending_sync';

-- Personas con errores
SELECT * FROM persons WHERE status IN ('sync_failed', 'sync_dead_letter');

-- Todas las personas con info de sync
SELECT id, name, employee_id, device_employee_no, card_number, status, sync_attempts
FROM persons 
ORDER BY created_at DESC;

-- Resetear persona a pending_sync
UPDATE persons SET status = 'pending_sync', sync_attempts = 0, sync_error = NULL 
WHERE id = 'uuid-here';
```

### Logs del Agent

```bash
# Personas en proceso
grep "personSync" agent.log | grep -v "persons"

# Errores de sync
grep "Dead-letter\|Failed to sync\|Create failed" agent.log

# Sync desde dispositivo
grep "Device.*persons\|Imported person" agent.log
```

---

## 9. Related Notes

- [[Operación - DS-K1T320MFWX]] — Operación general del dispositivo
- [[Dispositivo - DS-K1T320MFWX]] — Especificaciones técnicas
- [[Módulo - Personas]] — Módulo de gestión de personas en el front
- [[Referencia ISAPI]] — Endpoints ISAPI disponibles

---

## Changelog

| Fecha | Cambio |
|-------|--------|
| 27-Apr-2026 | Creado — documenta el flujo bidireccional implementado |
