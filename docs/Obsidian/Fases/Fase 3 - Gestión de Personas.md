# Fase 3 - Gestión de Personas

**Estado**: ✅ Completa

**Fecha de completación**: 21 de abril de 2026

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

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│  PersonsTable → PersonDialog → Server Actions → Supabase     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ sync (every cycle)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Agent Bridge (Node.js)                     │
│  person-sync-loop.ts → HikvisionAdapter → ISAPI/HTTPS       │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ POST /ISAPI/AccessControl/UserInfo/Record
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Hikvision DS-K1T320MFWX (192.168.1.175)        │
└─────────────────────────────────────────────────────────────┘
```

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

## Próxima Fase

→ [[Fase 3.5 - Consolidación]] (completada)
→ [[Fase 4 - Eventos y Dashboard]] (pendiente)

---

**Tags**: #fase #persons #crud #sync #completed