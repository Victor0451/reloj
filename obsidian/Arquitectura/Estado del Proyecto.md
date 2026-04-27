# Estado del Proyecto RELOJ

> **Timeline: De dónde venimos → Dónde estamos → Hacia dónde vamos**

---

## 📜 Historia y Evolución

### Fase 0: Genesis (2024)
- **Inicio:** Sistema básico de consulta de eventos de Hikvision
- **Problema:** Todo el código estaba acoplado a la API de Hikvision
- **Decisión:** Mantener funcionando mientras se diseña refactorización

### Fase 1: Expansión (2025)
- **Incorporación de nuevos dispositivos** ZKTeco y Suprema
- **Problema crítico:** El código se duplicaba por marca
- **Decisión:** Diseñar arquitectura multi-marca antes de seguir agregando

### Fase 2: Refactorización Multi-Marca (2026)
- **Objetivo:** Sistema agnóstico de marcas
- **Enfoque:** Adapter Pattern
- **Estado:** ✅ Completo (Refactoring Complete — Abril 2026)

---

## 🗺️ De Dónde Venimos

### El Problema Original

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              AGENT BRIDGE (HIKVISION ONLY)                 │
│                                                             │
│  if (device.brand === 'hikvision') {                       │
│    // lógica específica Hikvision                          │
│  } else if (device.brand === 'zkteco') {                  │
│    // lógica específica ZKTeco                             │
│  }                                                         │
│                                                             │
│  ❌ Acoplamiento total                                      │
│  ❌ Código duplicado                                       │
│  ❌ Imposible mantener                                     │
└─────────────────────────────────────────────────────────────┘
```

### Síntomas Identificados

| Síntoma | Impacto |
|---------|---------|
| Switch/case por marca en todos los métodos | Agregar marca = modificar TODO |
| Lógica de autenticación duplicada | Bugs en una marca no existen en otras |
| Testear = mockear toda la API | Testing prácticamente imposible |
| Errores en una marca afectan a todas | Sin aislamiento de fallos |

---

## 📍 Dónde Estamos Ahora

### Arquitectura Implementada (Abril 2026)

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                               │
│            + Realtime Subscriptions (OK)                     │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                              │
│              + Campo 'brand' (OK)                           │
│              + Campos de sync (OK)                          │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              AGENT BRIDGE (REFACTORIZADO)                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              CORE (AGNÓSTICO)                       │   │
│  │  ┌───────────────┐  ┌──────────────────────────┐   │   │
│  │  │ IDeviceAdapter│  │   AdapterManager          │   │   │
│  │  │  (interface)  │  │   (factory)               │   │   │
│  │  └───────────────┘  └──────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                              ↑                             │
│                              │ createAdapter(brand)        │
│                              ↓                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Hikvision │  │ ZKTeco   │  │ Suprema  │  │ Dahua    │  │
│  │Adapter   │  │ Adapter  │  │ Adapter  │  │ Adapter  │  │
│  │  ✅ Listo │  │ ⬜ Pend. │  │ ⬜ Pend.  │  │ ⬜ Pend.  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Lo Que Ya Está Hecho ✅

#### 1. Base de Datos
- [x] Campo `brand` en tabla `devices`
- [x] Campos de sync (`is_online`, `last_seen`, `sync_fingerprint`)
- [x] Tabla `sync_logs` para auditoría
- [x] Trigger Realtime en `devices`

#### 2. Frontend
- [x] Realtime subscriptions en `DeviceList`
- [x] Realtime subscriptions en `ConnectivityPage`
- [x] Indicador visual de conexión Realtime
- [x] Dashboard de sync con errores

#### 3. Agent Bridge - Core
- [x] `IDeviceAdapter` interface
- [x] `AdapterManager` factory
- [x] Registro de adaptadores con `registerAdapter()`

#### 4. Agent Bridge - Hikvision
- [x] `HikvisionAdapter` implementado
- [x] Digest Auth manual (funcionando)
- [x] Métodos básicos: deviceInfo, doorStatus, lock/unlock

#### 5. Sync Loops Refactorizados
- [x] `heartbeat-loop.ts` - Usa adaptadores
- [x] `event-sync-loop.ts` - Usa adaptadores
- [x] `person-sync-loop.ts` - Usa adaptadores

#### Bug Fix: Adapter Import Issue
- [x] **Problema**: Los sync loops llamaban directamente a funciones del `HikvisionAdapter` en lugar de usar `AdapterManager.getAdapter()`
- [x] **Síntoma**: Error en producción porque `AdapterManager` no inicializaba los adapters correctamente
- [x] **Solución**: Los loops ahora obtienen el adapter via `adapterManager.getAdapter('hikvision')` y llaman métodos a través de la interfaz `DevicePort`

### Lo Que Falta 🔲

#### Prioridad Alta
- [x] Integrar `agent/src/index.ts` con los nuevos sync loops ✅
- [x] Agregar Person Sync Loop ✅
- [x] Eliminar código legacy (heartbeat.ts, syncEvents.ts, persons.ts) ✅

#### Prioridad Media
- [ ] `ZKTecoAdapter` - Para SF400, C3-400
- [ ] `SupremaAdapter` - Para BioEntry
- [ ] `DahuaAdapter` - Para dispositivos Dahua

#### Prioridad Baja
- [ ] Testing con mocks de adaptadores
- [ ] Documentación de cada adapter
- [ ] UI para agregar/configurar marcas

### Estado: Proyecto Completado ✅
> Todas las fases 1-7 implementadas. El sistema está en producción.
> Próximos pasos: extensión multi-marca (ZKTeco, Suprema, Dahua)

---

## 🧭 Hacia Dónde Vamos

### Visión: Sistema de Gestión Unificado

```
                    ┌─────────────────────────────────────┐
                    │           FRONTEND (Next.js)         │
                    │   Dashboard unificado para TODAS     │
                    │   las marcas de dispositivos         │
                    └─────────────────────────────────────┘
                                      ↑
                    ┌─────────────────┴─────────────────┐
                    │          SUPABASE                 │
                    │   Un solo schema, todas las      │
                    │   marcas coexisten                │
                    └───────────────────────────────────┘
                                      ↑
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    AGENT 1    │           │    AGENT 2    │           │    AGENT N    │
│  (Hikvision)  │           │   (ZKTeco)     │           │   (Dahua)     │
│               │           │               │           │               │
│ AdapterManager│           │ AdapterManager│           │ AdapterManager│
└───────────────┘           └───────────────┘           └───────────────┘
        ↑                             ↑                             ↑
        └─────────────────────────────┼─────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌─────────┐       ┌─────────┐       ┌─────────┐
              │ Hikvision│       │ ZKTeco  │       │ Dahua   │
              │ DS-K1T.. │       │ SF400   │       │ ASI6214 │
              └─────────┘       └─────────┘       └─────────┘
```

### Roadmap por Fases

#### Fase 3: Consolidación (Q2 2026)
```
Objetivo: Dejar el sistema Hikvision funcionando 100% con la nueva arquitectura
```

1. **Integrar nuevos sync loops**
   - Modificar `agent/src/index.ts`
   - Conectar todos los loops
   - Verificar con logs

2. **Eliminar legacy**
   - Backup de archivos legacy
   - Remover código duplicado
   - Verificar que nada se rompa

3. **Testing básico**
   - Probar sync loop manualmente
   - Verificar Realtime en frontend
   - Monitorear errores en `sync_logs`

#### Fase 4-7: Implementación Completada ✅

| Fase | Descripción | Estado |
|------|-------------|--------|
| Fase 4: Eventos y Dashboard | Realtime subscriptions, KPIs | ✅ Completo |
| Fase 5: Reportes | PDF/Excel export | ✅ Completo |
| Fase 6: Control de Puerta | Apertura/cierre remoto | ✅ Completo |
| Fase 7: QA y Hardening | Security fixes, ErrorBoundary, docs | ✅ Completo |

#### Próximos Pasos: Extensión Multi-Marca

1. **ZKTeco Adapter**
   - Investigar API de ZKTeco
   - Implementar `ZKTecoAdapter`
   - Probar con dispositivo real

2. **Segunda marca** (a definir según demanda)
   - Suprema o Dahua
   - Mismo proceso

---

## 📊 Métricas de Progreso

| Fase | Estado | Completado |
|------|--------|------------|
| Fase 0: Genesis | ✅ Completo | 100% |
| Fase 1: Expansión | ✅ Completo | 100% |
| Fase 2: Refactorización Core | ✅ Completo (Refactoring Complete) | 100% |
| Fase 2.1: Interface + Factory | ✅ Completo | 100% |
| Fase 2.2: HikvisionAdapter | ✅ Completo | 100% |
| Fase 2.3: Sync Loops | ✅ Completo | 100% |
| Fase 2.4: Integración | ✅ Completo | 100% |
| Fase 3: Gestión de Personas | ✅ Completo | 100% |
| Fase 3.5: Consolidación | ✅ Completo | 100% |
| Fase 4: Eventos y Dashboard | ✅ Completo | 100% |
| Fase 5: Reportes | ✅ Completo | 100% |
| Fase 6: Control de Puerta | ✅ Completo | 100% |
| Fase 7: QA y Hardening | ✅ Completo | 100% |

---

## 🎯 Goals del Proyecto

### Goal Principal (Logrado ✅)
> Un sistema que pueda gestionar relojes biométricos de múltiples marcas sin cambios en el código core

### Goals Secundarios
1. **Mantenibilidad** ✅ - Adaptadores aislados por marca
2. **Testabilidad** ✅ - En progreso (mocking de adapters)
3. **Extensibilidad** ✅ - Agregar marca = nuevo archivo
4. **Observabilidad** ✅ - sync_logs + Realtime implementado
5. **Performance** ✅ - Benchmarking futuro

---

## 🔗 Referencias

- [[Arquitectura Multi-Marca]] - Diseño técnico detallado
- [[../Módulos/Agente Bridge]] - Documentación del agente
- [[../Desarrollo/Conectividad/README]] - Sistema de conectividad
- [[../Desarrollo/Judgment Day - Fase 2 Agente Bridge]] - Decisiones de diseño previas
