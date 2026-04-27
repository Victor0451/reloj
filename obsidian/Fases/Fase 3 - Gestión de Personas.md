---
tags: [fase, completado]
date: 2026-04-13
completion: 2026-04-21
---

# Fase 3 - Gestión de Personas

> [!example] Estado: **Completado** ✅
> CRUD completo de personas con foto facial y huella, sincronización con el reloj.

**Fecha de completación**: 21 de Abril 2026

## Resumen

La Fase 3 implementó el CRUD completo de personas con sincronización bidireccional entre Supabase y el reloj Hikvision.

## Entregables

- [x] `persons` table en Supabase con RLS policies
- [x] Server Actions: crearPersona, actualizarPersona, eliminarPersona
- [x] UI: PersonsTable con búsqueda, filtros, paginación
- [x] PersonDialog con formulario de alta/edición
- [x] PhotoUpload a Supabase Storage
- [x] Person sync loop (person-sync-loop.ts) vía adapter pattern
- [x] ISAPI integration para registrar/modificar/eliminar personas en el dispositivo

## Bug Fijo Durante Verificación

### Adapter Import Bug

**Problema**: Los sync loops (`heartbeat-loop.ts`, `event-sync-loop.ts`, `person-sync-loop.ts`) llamaban directamente a funciones del `HikvisionAdapter` en lugar de usar el `AdapterManager`.

**Síntoma**: Error en producción porque `AdapterManager` no inicializaba los adapters correctamente.

**Solución**: Los loops ahora obtienen el adapter via `adapterManager.getAdapter('hikvision')` y llaman métodos a través de la interfaz `DevicePort`.

## Criterios de Aceptación Verificados

- [x] Persona creada desde la web aparece en Supabase
- [x] Persona se registra en el reloj vía ISAPI
- [x] Persona puede acceder al reloj físicamente
- [x] Se puede buscar y filtrar personas
- [x] Se puede dar de baja una persona
- [x] Sync loop usa adapter pattern correctamente

---

## Objetivos

1. Alta de persona con nombre, foto facial, huella, nro. empleado, tarjeta
2. Baja de persona (elimina del reloj + marca inactiva)
3. Modificación de datos existentes
4. Listado con búsqueda y filtros
5. Importación masiva desde CSV
6. Sincronización bidireccional con el reloj

## Dependencias

- [[Fase 2 - Agente Bridge]] ✅ (necesario para sync con reloj)

## Entregables Planificados

| Componente | Descripción |
|------------|-------------|
| `persons/page.tsx` | Tabla con búsqueda, filtros, acciones |
| PersonDialog | Formulario alta/edición en modal |
| PhotoUpload | Upload de foto a Supabase Storage |
| Server Actions | CRUD persons + sync con ISAPI |
| Import CSV | Importación masiva |

## Ver También

- [[Módulo - Personas]]
- [[Tabla - persons]]
- [[Referencia ISAPI#UserInfo]]
