---
tags: [modulo, auth]
date: 2026-04-13
---

# Módulo - Auth

> [!info] Resumen
> Autenticación con Supabase Auth, Server Actions y middleware.

---

## Componentes

| Archivo | Tipo | Función |
|---------|------|---------|
| `src/actions/auth.ts` | Server Action | `login()`, `signup()`, `logout()` |
| `src/components/auth/LoginForm.tsx` | Client | Formulario de login |
| `src/components/auth/SignupForm.tsx` | Client | Formulario de registro |
| `src/middleware.ts` | Middleware | Refresh cookies de sesión |

## Flujo

```
/login → LoginForm → login() → Supabase Auth → redirect /dashboard
/signup → SignupForm → signup() → Supabase Auth → trigger → profiles → redirect /dashboard
/logout → logout() → Supabase Auth → redirect /login
```

## Ver También

- [[Módulo - Dashboard]]
- [[Tabla - profiles]]
- [[Esquema de Base de Datos]]
