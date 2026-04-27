---
tags: [seguridad]
date: 2026-04-13
---

# Seguridad

> [!warning] Importante
> Revisar [[Checklist de Seguridad]] antes de cada deploy.

---

## Capas de Seguridad

| Capa | Mecanismo | Función |
|------|-----------|---------|
| Transporte | HTTPS (TLS) | Encriptación en tránsito |
| Autenticación | Supabase Auth (JWT) | Verificar identidad |
| Sesión | HTTPOnly Cookies | Mantener sesión sin JS |
| Autorización | RLS (Row Level Security) | Controlar acceso a datos |
| Aplicación | Roles en middleware | Restringir funcionalidades |

## Roles

| Rol | Permisos |
|-----|----------|
| `admin` | Control total |
| `hr_operator` | Gestionar personas, ver eventos y reportes |
| `supervisor` | Solo lectura: eventos, reportes, dashboard |
| `technician` | Estado del dispositivo, firmware, config red |

## Datos Sensibles

| Dato | Protección |
|------|------------|
| Contraseñas | Hasheadas por Supabase (bcrypt) |
| Tokens JWT | Cookies HTTPOnly, expiran en 1h |
| Service Role Key | Solo server, nunca al browser |
| Credenciales del reloj | Se cifrarán en Supabase Vault (futuro) |
| Fotos faciales | Supabase Storage privado |

## Ver También

- [[Checklist de Seguridad]]
- [[Arquitectura del Sistema]]
