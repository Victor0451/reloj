# Hikvision - Sistema Web de Gestión Biométrica

Sistema web para gestionar terminales biométricos Hikvision DS-K1T320MFWX (reconocimiento facial + huella dactilar) de forma centralizada y remota.

## 🚀 Tecnologías

- **Frontend**: Next.js 16 (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4
- **Base de Datos**: Supabase (PostgreSQL + Realtime + Auth)
- **Deploy**: Vercel (frontend) + PM2 (agente local)

## 📋 Requisitos

- Node.js 20+
- npm
- Cuenta en Supabase

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
│   ├── actions/              # Server Actions (auth, etc.)
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
│   │   │       ├── device-status/
│   │   │       ├── audit/
│   │   │       └── settings/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── auth/            # Componentes de autenticación
│   │   ├── layout/          # Sidebar y layouts
│   │   └── ui/              # Componentes shadcn/ui
│   ├── lib/
│   │   └── supabase/        # Clientes de Supabase
│   │       ├── client.ts    # Cliente browser
│   │       └── server.ts    # Cliente server
│   ├── types/               # Tipos TypeScript
│   │   └── database.types.ts
│   └── middleware.ts        # Middleware de autenticación
├── supabase/
│   └── schema.sql           # Esquema de base de datos
├── docs/                    # Documentación del proyecto
└── .env.local               # Variables de entorno (no trackeado)
```

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
└──────────────┬──────────────────┘
               │ Supabase SDK
┌──────────────▼──────────────────┐
│    Supabase (PostgreSQL)        │
└──────────────┬──────────────────┘
               │ WebSocket/HTTP
┌──────────────▼──────────────────┐
│    Agente Bridge (Node.js)      │
└──────────────┬──────────────────┘
               │ ISAPI/HTTPS
┌──────────────▼──────────────────┐
│    Hikvision DS-K1T320MFWX      │
└─────────────────────────────────┘
```

## 📝 Próximos Pasos

### Fase 2: Agente Bridge
- [ ] Crear agente Node.js para conectar con el reloj
- [ ] Sincronización de eventos cada 30 segundos
- [ ] Heartbeat para monitoreo de estado

### Fase 3: Gestión de Personas
- [ ] CRUD completo de personas
- [ ] Alta con foto facial y huella
- [ ] Sincronización con el reloj vía ISAPI

### Fase 4: Eventos y Dashboard
- [ ] Listado de eventos en tiempo real
- [ ] Dashboard con KPIs
- [ ] Filtros avanzados

### Fase 5: Reportes
- [ ] Reportes de asistencia
- [ ] Exportación PDF y Excel

### Fase 6: Control de Puerta y Auditoría
- [ ] Apertura/cierre remoto
- [ ] Estado de puerta
- [ ] Log de auditoría completo

## 📄 Licencia

Privado - Hikvision Biometric System
