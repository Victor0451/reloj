# Estado del Proyecto

**Última actualización**: 21 de abril de 2026

## Resumen de Fases

| Fase | Nombre | Estado | Completado |
|------|--------|--------|------------|
| 1 | Infraestructura Base | ✅ Completa | 13-Abr-2026 |
| 2 | Agente Bridge | ✅ Completa | 14-Abr-2026 |
| 2.3 | Sync Loops (refactoring) | ✅ 100% | 21-Abr-2026 |
| 3 | Gestión de Personas | ✅ Completa | 21-Abr-2026 |
| 3.5 | Consolidación | ✅ Completa | 21-Abr-2026 |
| 4 | Eventos y Dashboard | ⏳ Pendiente | - |
| 5 | Reportes | ✅ Completa | 21-Abr-2026 |
| 6 | Control de Puerta | ✅ Completa | 21-Abr-2026 |
| 7 | QA y Hardening | ⏳ Pendiente | - |

## Detalle de Fase 2.3: Sync Loops

### Arquitectura Adapter Pattern

```
Sync Loop → AdapterManager → HikvisionAdapter → ISAPI/HTTPS → Device
     ↑           ↑
     │           └── registry: 'hikvision' → HikvisionAdapter
     │
     └── llama adapterManager.getAdapter('hikvision')
```

### Bug Fix Requerido

**Problema**: Los sync loops (`heartbeat-loop.ts`, `event-sync-loop.ts`, `person-sync-loop.ts`) importaban directamente funciones del `HikvisionAdapter` en lugar de usar el `AdapterManager`.

**Impacto**: En producción, `AdapterManager` no inicializaba los adapters porque la instancia era creada internamente.

**Solución**: Los loops ahora obtienen el adapter dinámicamente:
```typescript
const adapterManager = AdapterManager.getInstance();
const adapter = adapterManager.getAdapter('hikvision');
// luego llama adapter.deviceInfo() etc
```

### Archivos Activos en `agent/src/sync/`

| Archivo | Función | Intervalo |
|---------|---------|-----------|
| `heartbeat-loop.ts` | Device status | 60s |
| `event-sync-loop.ts` | Access events | 30s |
| `person-sync-loop.ts` | Person sync | Configurable |
| `dedup.ts` | Event dedup | - |
| `registerDevice.ts` | Device setup | Startup |

### Archivos Archivados en `agent/src/sync/legacy/`

| Archivo | Descripción |
|---------|-------------|
| `heartbeat.ts` | Original heartbeat (sin adapter) |
| `syncEvents.ts` | Original event sync (sin adapter) |
| `persons.ts` | Original person sync (sin adapter) |

## Detalle de Fase 3.5: Consolidación

### Cambios Realizados

1. **Legacy Cleanup**: 3 archivos archivados con `git mv` (historial preservado)
2. **README.md Actualizado**: Nueva estructura + diagrama de arquitectura adapter
3. **INDEX.md Actualizado**: Fase 3.5 añadida al tracking
4. **Obsidian Docs Creados**: Fases 3 y 3.5 documentadas

### Verification Checklist Pasado

- [x] Heartbeat cycle: adapter pattern ✓, `devices.is_online` updated ✓
- [x] Event sync cycle: adapter pattern ✓, `access_events` populated ✓
- [x] Person sync cycle: adapter pattern ✓
- [x] No direct ISAPI calls visible ✓
- [x] Legacy files git mv'd to `legacy/` ✓
- [x] Grep confirms zero legacy imports ✓

## Detalle de Fase 6: Control de Puerta

### Bug Crítico Arreglado

**Problema**: El `CommandDispatcher` existía en el código pero **nunca fue conectado** en el startup del agente. El dispatcher polling estaba implementado pero la función `startCommandDispatcher()` nunca era llamada.

**Impacto**: Los comandos de puerta nunca se ejecutaban porque el agente no iniciaba el polling.

**Solución**: Se agregó el llamado a `startCommandDispatcher()` en el loop de inicialización de dispositivos en `agent/src/index.ts`.

### Cambios Realizados

1. **Fase 1 - Wire Dispatcher**: Import y llamado de `startCommandDispatcher` por cada dispositivo
2. **Fase 2 - Tipo DoorAction**: Estandarización a minúsculas (`alwaysopen`/`alwaysclose`)
3. **Fase 3 - E2E Flow**: Flujo completo verificado: INSERT → poll → execute → UPDATE → realtime → toast

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `agent/src/index.ts` | Wired dispatcher: líneas 184-189 |
| `src/types/door.types.ts` | DoorAction lowercase, Status = completed |
| `src/components/door/door-control-card.tsx` | Status check: 'done' → 'completed' |

### Verification Checklist Pasado

- [x] Dispatcher wired: `index.ts:184-189` ✓
- [x] DoorAction types normalized: lowercase ✓
- [x] Status transitions correct: pending → completed/failed ✓
- [x] Realtime subscription active in frontend ✓
- [x] Toast notifications on completion/error ✓

## Próximos Pasos

1. **Fase 4**: Implementar listado de eventos en tiempo real + dashboard KPIs
2. Commit de Fase 6 cuando esté listo

---

**Tags**: #status #architecture #sync-loops #adapter-pattern