# Fase 1: Infraestructura Base

## Resumen

Esta fase cubre la configuración completa de la infraestructura base del sistema web de gestión biométrica Hikvision, incluyendo el framework Next.js, la interfaz de usuario con shadcn/ui, la base de datos Supabase con su esquema completo, y el sistema de autenticación funcional.

## Entregables

| Componente | Descripción | Estado |
|------------|-------------|--------|
| Proyecto Next.js 16 | App Router + TypeScript | ✅ Completo |
| Tailwind CSS v4 | Framework CSS | ✅ Completo |
| shadcn/ui | 15 componentes de UI | ✅ Completo |
| Supabase Client | Integración browser + server | ✅ Completo |
| Supabase Auth | Login, registro, sesiones | ✅ Completo |
| Esquema SQL | 5 tablas + RLS + triggers | ✅ Completo |
| Middleware | Refresh de sesiones | ✅ Completo |
| Dashboard | Layout con sidebar + KPIs | ✅ Completo |
| Navegación | Sidebar con 8 secciones | ✅ Completo |
| Documentación | README + docs de fase | ✅ Completo |

## Duración

1 semana (estimada según PRD)

## Stack Tecnológico Utilizado

### Frontend
- **Next.js 16.2.3** - Framework React con App Router
- **TypeScript 5+** - Tipado estático
- **React 19** - Biblioteca de UI
- **Tailwind CSS v4** - Framework CSS utility-first
- **shadcn/ui** - Componentes accesibles y customizables

### Backend/Database
- **Supabase** - Backend as a Service
  - PostgreSQL como base de datos
  - Supabase Auth para autenticación
  - Row Level Security (RLS) para aislamiento de datos
  - Realtime subscriptions (listo para fase 2)

### Infraestructura
- **Vercel** - Hosting planificado para producción
- **npm** - Gestor de paquetes

## Estructura de Archivos

```
reloj/
├── src/
│   ├── actions/
│   │   └── auth.ts                 # Server Actions de autenticación
│   ├── app/
│   │   ├── (auth)/                 # Grupo de rutas de autenticación
│   │   │   ├── layout.tsx
│   │   │   ├── login/
│   │   │   │   └── page.tsx        # Página de login
│   │   │   └── signup/
│   │   │       └── page.tsx        # Página de registro
│   │   ├── (dashboard)/            # Grupo de rutas protegidas
│   │   │   ├── layout.tsx          # Layout con sidebar
│   │   │   └── dashboard/
│   │   │       ├── page.tsx        # Dashboard principal
│   │   │       ├── persons/        # Gestión de personas
│   │   │       ├── events/         # Eventos de acceso
│   │   │       ├── reports/        # Reportes
│   │   │       ├── door-control/   # Control de puerta
│   │   │       ├── device-status/  # Estado del dispositivo
│   │   │       ├── audit/          # Auditoría
│   │   │       └── settings/       # Configuración
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Home (redirige según auth)
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx       # Formulario de login
│   │   │   └── SignupForm.tsx      # Formulario de registro
│   │   ├── layout/
│   │   │   └── AppSidebar.tsx      # Sidebar de navegación
│   │   └── ui/                     # Componentes shadcn/ui
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── sonner.tsx
│   │       ├── table.tsx
│   │       └── tooltip.tsx
│   ├── hooks/
│   │   └── use-mobile.ts           # Hook para detección de móvil
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Cliente para browser
│   │   │   └── server.ts           # Cliente para server components
│   │   └── utils.ts                # Utilidades (cn)
│   ├── types/
│   │   └── database.types.ts       # Tipos TypeScript de la DB
│   └── middleware.ts               # Middleware de autenticación
├── supabase/
│   └── schema.sql                  # Esquema completo de la base de datos
├── docs/                           # Documentación del proyecto
├── public/                         # Assets estáticos
├── .env.local                      # Variables de entorno (no trackeado)
├── .env.example                    # Ejemplo de variables
├── .gitignore
├── components.json                 # Configuración de shadcn/ui
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── README.md
```

## Configuración de Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

| Variable | Uso | Visibilidad |
|----------|-----|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Pública (cliente + servidor) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima para operaciones básicas | Pública (cliente + servidor) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio para operaciones admin | **Solo servidor** (nunca exponer) |

## Base de Datos

### Tablas Creadas

Ver documento [`docs/02-esquema-base-de-datos.md`](./02-esquema-base-de-datos.md) para detalles completos.

#### Resumen de Tablas

| Tabla | Propósito | Key Fields |
|-------|-----------|------------|
| `profiles` | Extiende auth.users con datos de usuario | id, email, role |
| `persons` | Personas registradas en el reloj | id, employee_id, name, status |
| `access_events` | Eventos de acceso (fichajes) | id, person_id, event_time, event_type |
| `devices` | Registro de dispositivos Hikvision | id, serial_number, status |
| `audit_logs` | Log inmutable de acciones de operadores | id, user_id, action, created_at |

### Row Level Security (RLS)

RLS habilitado en todas las tablas con políticas específicas por rol:

- **profiles**: Los usuarios ven su propio perfil; admins ven todos
- **persons**: Todos los autenticados pueden ver; admin y hr_operator pueden gestionar
- **access_events**: Todos los autenticados pueden ver; sistema inserta
- **devices**: Todos los autenticados pueden ver; admin y technician pueden gestionar
- **audit_logs**: Todos los autenticados pueden ver; solo sistema inserta (inmutable)

### Triggers

| Trigger | Función |
|---------|---------|
| `on_auth_user_created` | Crea automáticamente un perfil cuando se registra un usuario |
| `set_updated_at_*` | Actualiza automáticamente el campo `updated_at` en cada UPDATE |

## Autenticación

### Flujo de Autenticación

```
┌──────────┐     ┌───────────┐     ┌───────────┐     ┌──────────┐
│  /login  │────>│ auth.ts   │────>│ Supabase  │────>│ /dashboard│
│          │<────│ (action)  │<────│ Auth      │<────│ (redirect)│
└──────────┘     └───────────┘     └───────────┘     └──────────┘
```

1. Usuario ingresa email y password en `/login`
2. El formulario llama a la Server Action `login()` en `src/actions/auth.ts`
3. La acción llama a `supabase.auth.signInWithPassword()`
4. Si es exitoso, redirige a `/dashboard`
5. El middleware mantiene las cookies de sesión actualizadas
6. Las rutas de `(dashboard)` verifican la sesión en el layout

### Server Actions

| Action | Ubicación | Función |
|--------|-----------|---------|
| `login()` | `src/actions/auth.ts` | Inicia sesión con email/password |
| `signup()` | `src/actions/auth.ts` | Crea nueva cuenta |
| `logout()` | `src/actions/auth.ts` | Cierra sesión |

### Middleware

Ubicación: `src/middleware.ts`

- Se ejecuta en cada request
- Refresca las cookies de sesión de Supabase automáticamente
- No bloquea rutas (las páginas verifican auth por su cuenta)

## Componentes de UI

### shadcn/ui Instalados

| Componente | Uso Principal |
|------------|---------------|
| `button` | Botones con variantes (default, destructive, outline, etc.) |
| `card` | Contenedores con header, content, footer |
| `input` | Campos de texto y formularios |
| `label` | Etiquetas de formularios |
| `table` | Tablas de datos |
| `dropdown-menu` | Menús desplegables |
| `dialog` | Modales y diálogos |
| `form` | Formularios con validación |
| `avatar` | Fotos de perfil |
| `badge` | Etiquetas de estado |
| `separator` | Líneas divisorias |
| `skeleton` | Placeholders de carga |
| `sonner` | Notificaciones toast |
| `sheet` | Paneles laterales (drawer) |
| `sidebar` | Barra lateral de navegación |
| `tooltip` | Tooltips informativos |

## Rutas del Sistema

| Ruta | Tipo | Descripción |
|------|------|-------------|
| `/` | Público | Redirige a `/login` o `/dashboard` según sesión |
| `/login` | Público | Página de inicio de sesión |
| `/signup` | Público | Página de registro |
| `/dashboard` | Protegido | Dashboard principal |
| `/dashboard/persons` | Protegido | Gestión de personas |
| `/dashboard/events` | Protegido | Eventos de acceso |
| `/dashboard/reports` | Protegido | Reportes de asistencia |
| `/dashboard/door-control` | Protegido | Control remoto de puerta |
| `/dashboard/device-status` | Protegido | Estado del dispositivo |
| `/dashboard/audit` | Protegido | Log de auditoría |
| `/dashboard/settings` | Protegido | Configuración del sistema |

## Build y Deploy

### Comandos Disponibles

```bash
npm run dev      # Desarrollo (http://localhost:3000)
npm run build    # Build de producción
npm start        # Servidor de producción
npm run lint     # Ejecutar ESLint
```

### Resultado del Build

```
Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /dashboard
├ ƒ /dashboard/audit
├ ƒ /dashboard/device-status
├ ƒ /dashboard/door-control
├ ƒ /dashboard/events
├ ƒ /dashboard/persons
├ ƒ /dashboard/reports
├ ƒ /dashboard/settings
├ ƒ /login
└ ƒ /signup
```

- `ƒ` (Dynamic): Se renderiza en el servidor bajo demanda
- `○` (Static): Contenido estático pre-renderizado

## Criterios de Cumplimiento

- ✅ El proyecto compila sin errores de TypeScript
- ✅ Login funcional con Supabase Auth
- ✅ Registro funcional con perfil automático
- ✅ Rutas protegidas requieren autenticación
- ✅ Sidebar con navegación completa a todas las secciones
- ✅ Dashboard con estructura de KPIs lista
- ✅ Esquema de base de datos aplicado con RLS
- ✅ Responsive design con Tailwind CSS
- ✅ Dark mode soportado

## Siguiente Fase

**Fase 2: Agente Bridge**

- Agente Node.js en la red local del cliente
- Comunicación con el reloj vía ISAPI/HTTPS
- Sincronización de eventos cada 30 segundos
- Heartbeat para monitoreo de estado online/offline
