# Arquitectura Técnica - Fase 1

## Visión General

Este documento describe la arquitectura técnica completa del sistema web de gestión biométrica Hikvision, implementada durante la Fase 1.

## Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                            USUARIO                                  │
│                        (Navegador Web)                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTPS
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CAPA DE PRESENTACIÓN                          │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Next.js 16 (App Router)                       │    │
│  │                    Vercel Hosting                          │    │
│  │                                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │    │
│  │  │  (auth)      │  │ (dashboard)  │  │ API Routes      │ │    │
│  │  │  /login      │  │ /dashboard   │  │ /api/*          │ │    │
│  │  │  /signup     │  │ /persons     │  │ (Futuro)        │ │    │
│  │  │              │  │ /events      │  │                 │ │    │
│  │  │              │  │ /reports     │  │                 │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ Supabase SDK (@supabase/ssr)
                               │ REST API
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CAPA DE DATOS                                 │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │                    Supabase Cloud                          │    │
│  │                                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │    │
│  │  │  PostgreSQL  │  │    Auth      │  │    Storage      │ │    │
│  │  │  (Tablas +   │  │  (Usuarios,  │  │  (Fotos, Files) │ │    │
│  │  │   RLS)       │  │   JWT)       │  │   (Futuro)      │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ WebSocket / HTTP Polling
                               │ (Fase 2)
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CAPA DE INTEGRACIÓN                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │              Agente Bridge (Node.js)                       │    │
│  │            (Red local del cliente)                         │    │
│  │                                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │    │
│  │  │  Proxy       │  │  Sincroniz.  │  │   Heartbeat     │ │    │
│  │  │  ISAPI       │  │  Eventos     │  │   Monitor       │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │    │
│  └────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               │ HTTPS + Digest Auth + ISAPI
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CAPA DE DISPOSITIVO                           │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │          Hikvision DS-K1T320MFWX                           │    │
│  │          (Reloj Biométrico Facial/Huella)                  │    │
│  │          IP: 192.168.1.175 (red local)                     │    │
│  │                                                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │    │
│  │  │ Reconocim.   │  │  Control     │  │   Eventos       │ │    │
│  │  │  Facial      │  │  de Puerta   │  │   de Acceso     │ │    │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘ │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## Decisiones Arquitectónicas

### 1. Next.js App Router

**Decisión**: Usar App Router en lugar de Pages Router.

**Motivos:**
- Server Components por defecto (menos JavaScript al browser)
- Streaming y Suspense integrados
- Mejor soporte para Server Actions
- Layouts anidados nativos (grupos de rutas)
- SEO-friendly con SSR

**Impacto:**
- Las páginas sin `'use client'` son Server Components
- Las Server Actions reemplazan API Routes para formularios simples
- Los grupos de rutas `(auth)` y `(dashboard)` organizan layouts

### 2. Supabase como Backend

**Decisión**: Usar Supabase (PostgreSQL + Auth + Realtime) como backend completo.

**Motivos:**
- PostgreSQL con Row Level Security (RLS) nativo
- Auth integrado con JWT y refresh tokens
- Realtime subscriptions para datos en vivo
- SDK oficial para JavaScript/TypeScript
- Hosting gestionado (sin infra propia)

**Impacto:**
- No necesitamos un backend Express/API propio para la web
- Las Server Actions de Next.js hacen las veces de API
- RLS protege los datos a nivel de base de datos
- Realtime permite actualizaciones push (para Fase 2)

### 3. @supabase/ssr

**Decisión**: Usar el paquete `@supabase/ssr` en lugar del cliente estándar.

**Motivos:**
- Diseñado específicamente para Next.js App Router
- Manejo correcto de cookies en server y client
- Compatible con middleware de Next.js
- Soporte para SSR y SSG

**Implementación:**
- Dos clientes separados: `client.ts` (browser) y `server.ts` (server)
- El middleware refresca las cookies automáticamente

### 4. shadcn/ui

**Decisión**: Usar shadcn/ui en lugar de una biblioteca de componentes tradicional.

**Motivos:**
- Los componentes se copian al proyecto (no son una dependencia)
- Totalmente customizables (no black box)
- Basados en Radix UI (accesibilidad garantizada)
- Tailwind CSS nativo
- Tree-shakeable (solo se incluye lo que se usa)

**Componentes usados en Fase 1:**
- `button`, `card`, `input`, `label`, `table`
- `dropdown-menu`, `dialog`, `form`, `avatar`
- `badge`, `separator`, `skeleton`, `sonner`
- `sheet`, `sidebar`, `tooltip`

### 5. Tailwind CSS v4

**Decisión**: Usar la última versión de Tailwind CSS.

**Motivos:**
- Mejor performance con nueva engine
- CSS-first configuration
- Soporte nativo para variables CSS
- Integración perfecta con shadcn/ui

### 6. TypeScript Estricto

**Decisión**: Usar TypeScript con tipos definidos para la base de datos.

**Motivos:**
- Autocompletado en queries de Supabase
- Detección de errores en compile time
- Refactor seguro
- Documentación implícita del dominio

**Archivo de tipos:** `src/types/database.types.ts`

```typescript
export type Database = {
  public: {
    Tables: {
      persons: {
        Row: { id: string; name: string; ... }
        Insert: { name: string; ... }
        Update: { name?: string; ... }
      }
      // ... más tablas
    }
  }
}
```

Uso:
```typescript
const supabase = createServerClient<Database>(...)
// → supabase.from('persons') tiene autocompletado
```

### 7. Middleware sin Bloqueo

**Decisión**: El middleware refresca la sesión pero NO bloquea rutas.

**Motivos:**
- Evita problemas de redirect loops
- Las páginas verifican auth por su cuenta
- Más flexible para casos edge
- Compatible con el patrón de `@supabase/ssr`

**Implementación:**
- Cada layout de grupo protegido verifica `getUser()`
- Si no hay usuario, redirige a `/login`
- Las páginas públicas (`/login`, `/signup`) redirigen a `/dashboard` si hay sesión

### 8. Server Actions para Auth

**Decisión**: Usar Server Actions en lugar de API Routes para autenticación.

**Motivos:**
- Menos boilerplate (no necesita endpoints)
- Tipado automático (FormData → función)
- Se ejecutan solo en el servidor
- Integración nativa con formularios HTML

**Patrón:**
```typescript
// Server Action
'use server'
export async function login(formData: FormData) { ... }

// Formulario
<form action={login}>
  <Input name="email" />
  <Input name="password" />
  <Button type="submit">Login</Button>
</form>
```

## Patrones de Diseño

### Repository Pattern (implícito)

Las Server Actions actúan como repositorios para las entidades:

```
src/actions/
├── auth.ts        # Acciones de autenticación
├── persons.ts     # CRUD de personas (Fase 3)
├── events.ts      # Queries de eventos (Fase 4)
└── ...
```

### Layout Pattern

Los grupos de rutas de Next.js permiten layouts separados:

```
(app)/
├── (auth)/layout.tsx     → Layout simple para login/signup
└── (dashboard)/layout.tsx → Layout con sidebar para páginas protegidas
```

### Component Composition

Los componentes de UI se componen en cascada:

```
AppSidebar
├── Sidebar
│   ├── SidebarHeader
│   ├── SidebarContent
│   │   └── SidebarMenu
│   │       └── SidebarMenuButton
│   └── SidebarFooter
│       └── DropdownMenu
```

## Flujo de Datos

### 1. Login

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Usuario ingresa email/password en /login                      │
│ 2. Form submit → Server Action login()                          │
│ 3. login() → supabase.auth.signInWithPassword()                 │
│ 4. Supabase Auth valida credenciales                            │
│ 5. Si OK: Supabase retorna sesión + tokens                      │
│ 6. Supabase ssr escribe cookies en el response                  │
│ 7. redirect('/dashboard')                                       │
│ 8. Browser carga /dashboard con cookies de sesión               │
│ 9. middleware.ts refresca las cookies                           │
│ 10. DashboardLayout verifica getUser() → usuario existe         │
│ 11. Renderiza el dashboard con sidebar                          │
└──────────────────────────────────────────────────────────────────┘
```

### 2. Consulta de Datos (Fase 3+)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. Usuario navega a /dashboard/persons                          │
│ 2. Request llega al servidor (Next.js)                          │
│ 3. middleware.ts refresca cookies                               │
│ 4. PersonsPage (Server Component) se ejecuta                    │
│ 5. createClient() → cliente server con cookies                  │
│ 6. supabase.from('persons').select('*')                         │
│ 7. Supabase evalúa RLS policies según el usuario               │
│ 8. Retorna solo las filas permitidas                            │
│ 9. Server Component renderiza HTML con los datos               │
│ 10. HTML stream llega al browser                                │
└──────────────────────────────────────────────────────────────────┘
```

## Seguridad

### Capas de Seguridad

| Capa | Mecanismo | Función |
|------|-----------|---------|
| **Transporte** | HTTPS (TLS) | Encriptación en tránsito |
| **Autenticación** | Supabase Auth (JWT) | Verificar identidad del usuario |
| **Sesión** | HTTPOnly Cookies | Mantener sesión sin JS |
| **Autorización** | RLS (Row Level Security) | Controlar acceso a datos |
| **Aplicación** | Roles en middleware | Restringir funcionalidades |

### Flujo de Autorización

```
Request → middleware.ts → refresh session
                ↓
        layout.tsx → getUser() → ¿hay sesión?
                ↓                       ↓
              SÍ ↓                       ↓ NO
                ↓                       ↓
        Render layout              redirect('/login')
                ↓
        Page (Server Component)
                ↓
        Query a Supabase → RLS filtra datos
                ↓
        Response con HTML
```

### Protección de Datos Sensibles

| Dato | Protección |
|------|------------|
| Contraseñas | Hasheadas por Supabase (bcrypt) |
| Tokens JWT | En cookies HTTPOnly, expiran en 1h |
| Service Role Key | Solo en server, nunca al browser |
| Credenciales del reloj | Se cifrarán en Supabase Vault (Fase 2+) |
| Fotos faciales | Supabase Storage privado (Fase 3+) |

## Rendimiento

### Optimizaciones Implementadas

| Optimización | Descripción |
|--------------|-------------|
| Server Components | Menos JS enviado al browser |
| SSR en demanda | Páginas se renderizan solo cuando se piden |
| Cookie refresh eficiente | Middleware solo refresca, no bloquea |
| Tailwind CSS | CSS mínimo generado (solo lo usado) |
| shadcn/ui | Componentes tree-shakeables |
| TypeScript | Detección de errores en build time |

### Métricas Objetivo (del PRD)

| Métrica | Objetivo | Estado |
|---------|----------|--------|
| Carga del dashboard | < 2 segundos | ✅ (SSR, sin datos aún) |
| Sync de eventos | < 60 segundos | ⏳ (Fase 2) |
| Reportes 10K eventos | < 5 segundos | ⏳ (Fase 5) |
| Latencia puerta | < 3 segundos | ⏳ (Fase 6) |

## Escalabilidad

### Arquitectura Multi-Dispositivo

El modelo de datos ya soporta múltiples dispositivos:

- `access_events.device_serial` → identifica qué reloj capturó el evento
- `devices` table → registro de todos los relojes gestionados
- El agente bridge puede sincronizar múltiples dispositivos

### Límites Estimados

| Recurso | Límite v1 | Escalable |
|---------|-----------|-----------|
| Dispositivos por org. | 10 | Sí (sin cambios de arquitectura) |
| Personas | 50,000 | Sí (índices en place) |
| Eventos | 5,000,000 | Sí (particionamiento posible) |
| Usuarios del sistema | Ilimitado | Sí (Supabase Auth escala) |

## Monitoreo (Fase 2+)

### Heartbeat del Agente

El agente bridge enviará una señal cada 60 segundos:

```
Agente → Supabase → UPDATE devices SET last_seen_at = NOW()
                                                    ↓
                                             Frontend poll
                                                    ↓
                                       ¿last_seen_at > 120s? → offline
```

### Indicadores de Estado

| Indicador | Fuente | Frecuencia |
|-----------|--------|------------|
| Dispositivo online/offline | Heartbeat del agente | Cada 60s |
| Eventos sincronizados | `access_events.synced_at` | Cada 30s |
| Accesos fallidos | `access_events.event_type` | Realtime |

---

## Diagrama de Secuencia: Consulta con RLS

```
Usuario          Next.js Server          Supabase DB
    │                   │                      │
    │──GET /persons──>│                      │
    │                   │                      │
    │                   │──getUser()─────────>│
    │                   │<─user_id=abc───────│
    │                   │                      │
    │                   │──SELECT * FROM      │
    │                   │  persons            │
    │                   │  WHERE org_id =     │
    │                   │  current_user_org() │
    │                   │  (RLS Policy)       │
    │                   │                      │
    │                   │<─rows (filtered)───│
    │                   │                      │
    │<─HTML render────│                      │
    │                   │                      │
```

---

## Referencias

- [Next.js Architecture](https://nextjs.org/docs/app/building-your-application/rendering)
- [Supabase Architecture](https://supabase.com/docs/guidelines-and-limitations)
- [@supabase/ssr Package](https://github.com/supabase/supabase-js/blob/main/src/lib/SupabaseClient.ts)
- [Row Level Security PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
