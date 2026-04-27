---
tags: [fase, completada, aprobada]
date: 2026-04-14
---

# Fase 2 - Agente Bridge

> [!success] Estado: **APROBADA** ✅
> Agente Node.js conectado al reloj. Sincronización de eventos, heartbeat, door status.

---

## Judgment Day — 14 Abril 2026

### Proceso de Verificación

| Round | Resultado |
|-------|-----------|
| Round 1 | 1 issue CRÍTICO confirmado (XML injection) |
| Fix 1 | Aplicado: escapeXml() agregado |
| Round 2 | ✅ APROBADO — Ambos jueces limpios |

### Issue Encontrado y Corregido

**CRITICAL — XML Injection en `getAcsEvents`**

- **Archivo**: `agent/src/isapi/methods.ts` (líneas 88-91)
- **Problema**: Valores insertados directamente en XML sin sanitizar
- **Fix**: Agregada función `escapeXml()` y aplicado a `maxResults`, `startTime`, `endTime`

```typescript
// Antes (vulnerable)
<maxResults>${maxResults}</maxResults>

// Después (corregido)
<maxResults>${escapeXml(String(maxResults))}</maxResults>
```

### Gaps Menores (No-Blocking)

| Gap | Impacto |
|-----|---------|
| Restart recovery | Bajo — No hay seed desde Supabase al iniciar |
| Error classification | Bajo — No hay IsapiError con tipos |

---

## Entregables

| Componente | Archivo | Estado |
|------------|---------|--------|
| Agente principal | `agent/src/index.ts` | ✅ |
| Configuración | `agent/.env.example` | ✅ |
| Módulo ISAPI | `agent/src/isapi/client.ts` | ✅ |
| Sincronizador eventos | `agent/src/sync/syncEvents.ts` | ✅ |
| Heartbeat | `agent/src/sync/heartbeat.ts` | ✅ |
| Door status polling | `agent/src/sync/pollDoorStatus.ts` | ✅ |
| Door commands | `agent/src/commands/dispatcher.ts` | ✅ |
| Migration door_commands | `supabase/migrations/001_...` | ✅ |
| Fix trigger auth | `supabase/migrations/002_...` | ✅ |

## Lo que hace el Agente

| Loop | Intervalo | Qué hace |
|------|-----------|----------|
| Heartbeat | 60s | Actualiza `devices.last_seen_at` |
| Event Sync | 30s | Poll ISAPI → inserta en `access_events` |
| Door Status | 10s | Monitorea estado de puerta |
| Command Dispatcher | 2s | Ejecuta comandos de `door_commands` |

## Ver También

- [[Agente Bridge]]
- [[Referencia ISAPI]]
- [[Fase 3 - Gestión de Personas]]
