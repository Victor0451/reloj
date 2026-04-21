# Proposal: Devices Reliability Refactor

## Intent
Hacer que `/devices` permita registrar relojes de forma segura, conectarlos con validación real, mantener sync robusta y exponer estado en tiempo real sin filtrar secretos ni depender de chequeos inconsistentes.

## Scope

### In Scope
- Endurecer alta/edición de relojes con validación real contra adapter/agent.
- Unificar el modelo de estado de conectividad y sync mostrado en `/devices`.
- Separar datos secretos del payload que consume el cliente.
- Ajustar Agent Bridge para gestionar dispositivos registrados aunque estén degradados.

### Out of Scope
- Soporte completo para nuevas marcas en UI.
- Reescritura total del Agent Bridge o del módulo `/persons`.

## Capabilities

### New Capabilities
- `device-enrollment`: alta y actualización segura de relojes con prueba de conexión y persistencia operativa.
- `device-runtime-state`: estado operativo, conectividad y sync en tiempo real con DTO seguro para frontend.

### Modified Capabilities
- None.

## Approach
Introducir una capa server-side de orquestación para enrollment/runtime state, exponer DTOs seguros al cliente, consolidar health checks alrededor del adapter/agent y desacoplar el arranque del agent del `status` inicial del dispositivo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/devices.ts` | Modified | DTO seguro, create/update y consultas separadas |
| `src/lib/device-connectivity.ts` | Modified | health check unificado |
| `src/components/devices/*` | Modified | UX realtime y acciones robustas |
| `agent/src/index.ts` | Modified | criterio de selección y lifecycle de dispositivos |
| `supabase/migrations/*` | Modified | hardening de credenciales/estado si hace falta |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Romper registro actual | Med | Mantener compatibilidad por fases |
| Estado inconsistente web/agent | High | Fuente única de estado y contratos claros |
| Exposición de secretos | High | DTO server-safe y storage protegido |

## Rollback Plan
Revertir el change folder y restaurar acciones/componentes previos; mantener columnas actuales de DB compatibles hasta completar migración.

## Dependencies
- Supabase Realtime operativo
- Adapter Hikvision actual como baseline de conexión

## Success Criteria
- [ ] Registrar un reloj válido lo deja operativo sin exponer credenciales al cliente.
- [ ] `/devices` muestra estado de conexión y sync coherente con el Agent Bridge en tiempo real.
- [ ] Un reloj degradado puede recuperarse sin re-registro manual.
