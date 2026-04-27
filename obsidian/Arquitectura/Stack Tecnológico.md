---
tags: [stack, tecnologías]
date: 2026-04-13
---

# Stack Tecnológico

> [!info] Resumen
> Tecnologías usadas en cada capa del sistema.

---

## Frontend

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16.2.3 | Framework principal (App Router) |
| React | 19.2.4 | Biblioteca UI |
| TypeScript | 5.x | Tipado estático |
| Tailwind CSS | 4.x | Styling utility-first |
| shadcn/ui | latest | Componentes accesibles |
| base-ui | 1.4.0 | Primitivos de UI |
| lucide-react | 1.8.0 | Iconos |
| next-themes | 0.4.6 | Dark/light mode |
| sonner | 2.0.7 | Notificaciones toast |

## Backend / Datos

| Tecnología | Uso |
|------------|-----|
| Supabase | Backend as a Service |
| PostgreSQL | Base de datos |
| Supabase Auth | Autenticación JWT |
| Row Level Security | Aislamiento de datos por rol |

## Agente Bridge

| Tecnología | Uso |
|------------|-----|
| Node.js | Runtime del agente |
| tsx | Ejecución TypeScript sin build |
| @supabase/supabase-js | Cliente Supabase |
| digest-fetch | Digest Auth para ISAPI |
| fast-xml-parser | Parseo XML de ISAPI |
| zod | Validación de configuración |

## Infraestructura

| Servicio | Uso |
|----------|-----|
| Vercel | Hosting frontend |
| Supabase Cloud | DB + Auth + Storage |
| PM2 | Process manager del agente |

## Ver También

- [[Arquitectura del Sistema]]
- [[Guía de Desarrollo]]
