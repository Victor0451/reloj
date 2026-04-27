---
tags: [qa, seguridad, checklist]
date: 2026-04-13
---

# Checklist de Seguridad

> [!warning] Importante
> Revisar antes de cada deploy a producción.

---

## Backend / Base de Datos

- [ ] RLS habilitado en todas las tablas
- [ ] Policies correctas por rol
- [ ] `service_role_key` nunca en código cliente
- [ ] Triggers de auditoría funcionando
- [ ] No hay queries raw sin parámetros

## Frontend

- [ ] No hay credenciales en bundles (`npm run build` clean)
- [ ] Formularios con validación server-side
- [ ] CSRF protegido (Next.js + Supabase lo manejan)
- [ ] Inputs sanitizados (no XSS)
- [ ] HTTPS forzado

## Agente Bridge

- [ ] `.env` no commiteado
- [ ] Digest Auth funcionando
- [ ] No expone puertos públicos
- [ ] Logs no contienen credenciales
- [ ] Reconexión automática funcionando

## Auditoría

- [ ] `audit_logs` sin políticas DELETE/UPDATE
- [ ] Cada acción de operador queda registrada
- [ ] Logs inmutables verificados

## Ver También

- [[Seguridad]]
- [[Plan de Testing]]
