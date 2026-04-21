# Hikvision - Sistema Web de Gestión Biométrica

Sistema web para gestionar terminales biométricos Hikvision DS-K1T320MFWX (reconocimiento facial + huella dactilar) de forma centralizada y remota.

## 🚀 Tecnologías

- **Frontend**: Next.js 16.2.3 (App Router) + TypeScript + React 19.2.4
- **UI**: shadcn/ui + Tailwind CSS v4
- **Base de Datos**: Supabase (PostgreSQL + Realtime + Auth)
- **Agent Bridge**: Node.js (multi-brand adapter architecture)
- **Deploy**: Vercel (frontend) + PM2 (agente local)

## 📋 Requisitos

- Node.js 20+
- npm
- Cuenta en Supabase
- Device password (configurado en variables de entorno)

## 🛠️ Instalación

1. **Clonar el repositorio**
   ```bash
   git clone <repo-url>
   cd reloj
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   
   Crear un archivo `.env.local` en la raíz del proyecto:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   ```

4. **Configurar la base de datos en Supabase**
   
   - Ir al **SQL Editor** en tu proyecto de Supabase
   - Ejecutar el script en `supabase/schema.sql`

5. **Iniciar el servidor de desarrollo**
   ```bash
   npm run dev
   ```

   La aplicación estará disponible en `http://localhost:3000`

## 📁 Estructura del Proyecto

```
├── src/
│   ├── actions/              # Server Actions (auth, devices, persons, events, sync, door, reports)
│   ├── app/
│   │   ├── (auth)/          # Rutas de autenticación
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/     # Rutas del dashboard protegidas
│   │   │   └── dashboard/
│   │   │       ├── persons/
│   │   │       ├── events/
│   │   │       ├── reports/
│   │   │       ├── door-control/
│   │   │       ├── devices/
│   │   │       ├── device-status/
│   │   │       ├── audit/
│   │   │       ├── connectivity/
│   │   │       ├── sync-status/
│   │   │       └── settings/
│   │   ├── api/             # API routes
│   │   │   ├── devices/refresh/
│   │   │   └── check-connectivity/
│   │   ├── layout.tsx       # Root layout con ErrorBoundary
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/            # Login/Signup forms
│   │   ├── layout/          # Sidebar, theme provider
│   │   ├── devices/         # Device list, cards, sync dashboard
│   │   ├── persons/         # Persons table, dialog, photo upload, CSV import
│   │   ├── events/          # Events table
│   │   ├── reports/         # Report preview
│   │   ├── door/            # Door control card
│   │   └── ui/              # shadcn/ui components
│   ├── lib/
│   │   ├── supabase/        # Clientes Supabase (client, server, admin)
│   │   ├── device-connectivity.ts
│   │   ├── utils.ts
│   │   ├── cron-jobs.ts
│   │   └── test-realtime.js
│   ├── types/               # Tipos TypeScript
│   │   ├── database.types.ts
│   │   ├── device.types.ts
│   │   ├── person.types.ts
│   │   ├── event.types.ts
│   │   ├── door.types.ts
│   │   └── report.types.ts
│   ├── hooks/               # Custom hooks
│   │   └── use-mobile.ts
│   └── middleware.ts        # Middleware de autenticación
├── scripts/                 # Testing scripts para dispositivos
│   ├── test-event-sub.ts
│   ├── test-event-variant.ts
│   └── test-acs-endpoints.ts
├── agent/                   # Agent Bridge (Node.js)
│   └── src/
│       ├── index.ts
│       ├── adapters/
│       │   ├── hikvision/
│       │   │   └── HikvisionAdapter.ts
│       │   └── index.ts     # AdapterManager + IDeviceAdapter
│       └── loops/
│           ├── heartbeat-loop.ts
│           ├── event-sync-loop.ts
│           └── person-sync-loop.ts
├── supabase/
│   └── schema.sql           # Esquema de base de datos
├── docs/                    # Documentación del proyecto
└── .env.example             # Template de variables de entorno (no trackeado)
```

## ▶️ Cómo Ejecutar

### Frontend

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores de Supabase

# Iniciar servidor de desarrollo
npm run dev
```

### Agent Bridge

```bash
cd agent

# Instalar dependencias del agente
npm install

# Configurar variables de entorno
cp ../.env.example .env
# Editar .env con DEVICE_PASSWORD y SUPABASE_URL

# Iniciar el agente
npm start
# o con PM2 para producción
pm2 start dist/index.js --name reloj-agent
```

> El agente se conecta al dispositivo Hikvision via ISAPI y sincroniza eventos/personas con Supabase.

## 🔐 Roles de Usuario

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **Administrador** | Control total del sistema | Todo |
| **Operador RRHH** | Gestión del personal | Alta/baja personas, ver eventos, reportes |
| **Supervisor** | Monitoreo | Solo lectura: eventos, reportes, dashboard |
| **Técnico** | Mantenimiento del dispositivo | Estado del dispositivo, firmware, configuración |

## 📦 Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor de desarrollo |
| `npm run build` | Compilar para producción |
| `npm start` | Iniciar servidor de producción |
| `npm run lint` | Ejecutar linter |

## 🏗️ Arquitectura

```
┌─────────────────────────────────┐
│    Navegador / Operador         │
└──────────────┬──────────────────┘
               │ HTTPS
┌──────────────▼──────────────────┐
│    Next.js App (Vercel)         │
│    + React Error Boundary       │
└──────────────┬──────────────────┘
               │ Supabase SDK
┌──────────────▼──────────────────┐
│    Supabase (PostgreSQL)        │
│    + Realtime Subscriptions     │
└──────────────┬──────────────────┘
               │ WebSocket/HTTP
┌──────────────▼──────────────────┐
│    Agent Bridge (Node.js)       │
│    + Multi-Brand Adapters       │
└──────────────┬──────────────────┘
               │ ISAPI/HTTPS
┌──────────────▼──────────────────┐
│    Hikvision DS-K1T320MFWX      │
└─────────────────────────────────┘
```

## ✅ Fases Completadas

| Fase | Estado | Descripción |
|------|---------|-------------|
| Fase 1: Infraestructura | ✅ Completo | Base de datos, auth, Supabase |
| Fase 2: Refactorización Multi-Marca | ✅ Completo | Adapter pattern, HikvisionAdapter |
| Fase 3: Gestión de Personas | ✅ Completo | CRUD, foto facial, huella, sync |
| Fase 3.5: Consolidación | ✅ Completo | Integración de loops, legacy removal |
| Fase 4: Eventos y Dashboard | ✅ Completo | Realtime, KPIs, filtros |
| Fase 5: Reportes | ✅ Completo | PDF/Excel export |
| Fase 6: Control de Puerta | ✅ Completo | Apertura/cierre remoto, estado |
| Fase 7: QA y Hardening | ✅ Completo | Security fixes, Error Boundary, docs |

## 📄 Licencia

Privado - Hikvision Biometric System
