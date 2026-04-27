---
tags: [operaciones, troubleshooting, bugs]
date: 2026-04-13
---

# Troubleshooting

> [!bug] Problemas comunes y soluciones

---

## Agente Bridge

### Digest Auth failed

**Causa**: Credenciales incorrectas del reloj
**Solución**: Verificar `DEVICE_USERNAME` y `DEVICE_PASSWORD` en `.env`

### Connection refused

**Causa**: IP del reloj no accesible
**Solución**: Verificar que el agente está en la misma red que el reloj

### "socket hang up" en eventos

**Causa**: Implementación custom de digest auth incompatible con firmware Hikvision
**Solución**: Usar librería `digest-fetch` (ya implementado en commit digest-fetch-replacement)

### Certificate has expired

**Causa**: Certificado self-signed del reloj expiró Nov 2023
**Solución**: Setear `allow_self_signed_cert = true` en tabla `devices` y reiniciar agent

### ISAPI User Management not supported

**Causa**: Firmware DS-K1T320MFWX V3.5.0 bloquea todas las operaciones de gestión de usuarios
**Solución**: Crear usuarios via panel LCD del reloj o iVMS-4200 (no via ISAPI)

### No events syncing

**Causa**: El reloj no tiene eventos recientes o el agente no puede parsear XML
**Solución**: Verificar logs del agente, ajustar parser XML si es necesario

## Next.js

### "Database error saving new user"

**Causa**: Trigger `handle_new_user` usaba `raw_user_metadata` (renombrado en Supabase)
**Solución**: Ejecutar migración `002_fix_handle_new_user_trigger.sql`

### Hydration mismatch

**Causa**: Extensiones del browser inyectan atributos en `<html>`
**Solución**: `suppressHydrationWarning` en `<html>` tag

### <button> nested in <button>

**Causa**: `DropdownMenuTrigger` (es `<button>`) envuelve `SidebarMenuButton` (otro `<button>`)
**Solución**: Usar `render` prop en vez de children nesting

## Ver También

- `Bugs & Fixes/` — un note por bug documentado
- [[Agente Bridge]]
- [[Guía de Desarrollo]]
