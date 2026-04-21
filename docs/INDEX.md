# Documentación del Proyecto - Hikvision Sistema Web

## Índice de Documentación

### 📋 Documento Principal
- [**PRD - Documento de Requisitos del Producto**](../PRD-Hikvision-Sistema-Web.md) - Especificación completa del sistema

---

### 📖 Documentación por Fase

#### Fase 1: Infraestructura Base ✅
| Documento | Descripción |
|-----------|-------------|
| [01 - Fase 1: Infraestructura](./01-fase-1-infraestructura.md) | Resumen completo de la fase 1, entregables, stack tecnológico, estructura de archivos |
| [02 - Esquema de Base de Datos](./02-esquema-base-de-datos.md) | Detalle de tablas, columnas, RLS policies, triggers, índices y relaciones |
| [03 - Autenticación](./03-autenticacion.md) | Implementación del sistema de auth con Supabase, Server Actions, middleware y flujos |
| [04 - Guía de Desarrollo](./04-guia-de-desarrollo.md) | Manual para desarrolladores: comandos, convenciones, patrones, troubleshooting |
| [05 - Arquitectura Técnica](./05-arquitectura-tecnica.md) | Diagramas de arquitectura, decisiones técnicas, patrones de diseño, seguridad |

#### Planificación Completa
| Documento | Descripción |
|-----------|-------------|
| [06 - Plan de Fases Futuras (2-7)](./06-plan-de-fases-futuras.md) | Plan detallado de todas las fases restantes: arquitectura, entregables, endpoints ISAPI, criterios de aceptación y cronograma |

---

### 🏗️ Fases Futuras

| Fase | Nombre | Estado | Descripción |
|------|--------|--------|-------------|
| **Fase 1** | Infraestructura Base | ✅ Completa | Auth, dashboard, schema DB |
| **Fase 2** | Agente Bridge | ✅ Completa | Agente Node.js local ISAPI con adapter pattern (14-Abr-2026) |
| **Fase 3** | Gestión de Personas | ✅ Completa | CRUD personas con sincronización |
| **Fase 3.5** | Consolidación | ✅ Completa | Legacy cleanup, verification, adapter pattern stable (21-Abr-2026) |
| **Fase 4** | Eventos y Dashboard | ⏳ Pendiente | Listado de eventos en tiempo real, KPIs |
| **Fase 5** | Reportes | ⏳ Pendiente | Reportes de asistencia PDF/Excel |
| **Fase 6** | Control de Puerta | ⏳ Pendiente | Apertura/cierre remoto |
| **Fase 7** | QA y Hardening | ⏳ Pendiente | Testing, seguridad, docs finales |

---

### 📂 Estructura de Archivos Clave

```
reloj/
├── docs/
│   └── INDEX.md                          ← Este archivo
│   ├── 01-fase-1-infraestructura.md      ← Resumen de fase 1
│   ├── 02-esquema-base-de-datos.md       ← Esquema SQL completo
│   ├── 03-autenticacion.md               ← Sistema de auth
│   ├── 04-guia-de-desarrollo.md          ← Manual de desarrollo
│   └── 05-arquitectura-tecnica.md        ← Arquitectura y decisiones
│
├── supabase/
│   └── schema.sql                        ← Script SQL para ejecutar en Supabase
│
├── src/
│   ├── actions/auth.ts                   ← Server Actions de autenticación
│   ├── app/
│   │   ├── (auth)/                       ← Rutas de login/signup
│   │   └── (dashboard)/                  ← Rutas protegidas del dashboard
│   ├── components/
│   │   ├── auth/                         ← LoginForm, SignupForm
│   │   ├── layout/                       ← AppSidebar
│   │   └── ui/                           ← Componentes shadcn/ui
│   ├── lib/supabase/                     ← Clientes browser y server
│   └── types/database.types.ts           ← Tipos TypeScript de la DB
│
├── .env.example                          ← Ejemplo de variables de entorno
├── README.md                             ← README principal del proyecto
└── package.json                          ← Dependencias y scripts
```

---

### 🔗 Enlaces Externos

| Servicio | URL |
|----------|-----|
| Supabase Dashboard | https://app.supabase.com |
| Vercel Dashboard | https://vercel.com |
| Next.js Docs | https://nextjs.org/docs |
| shadcn/ui | https://ui.shadcn.com |
| Tailwind CSS | https://tailwindcss.com |

---

### 📊 Estado del Proyecto

```
Fase 1: Infraestructura Base          ████████████████████ 100% ✅
Fase 2: Agente Bridge                 ████████████████████ 100% ✅
Fase 3: Gestión de Personas           ████████████████████ 100% ✅
Fase 3.5: Consolidación               ████████████████████ 100% ✅
Fase 4: Eventos y Dashboard           ░░░░░░░░░░░░░░░░░░░░   0%
Fase 5: Reportes                      ░░░░░░░░░░░░░░░░░░░░   0%
Fase 6: Control de Puerta             ░░░░░░░░░░░░░░░░░░░░   0%
Fase 7: QA y Hardening                ░░░░░░░░░░░░░░░░░░░░   0%
                                       ─────────────────
Progreso Total:                       █████████████░░░░░░░░  ~50%
```

---

### 📝 Registro de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-04-13 | Creación del proyecto, Fase 1 completa | Equipo |
| 2026-04-13 | Fase 3 completa: Persons CRUD | Equipo |
| 2026-04-14 | Fase 2 completada + Judgment Day aprobación (XML fix) | Equipo |
| 2026-04-21 | Fase 3.5 Consolidación: legacy files archived to sync/legacy/, adapter pattern verified, 3 sync loops confirmed working | Equipo |

---

*Última actualización: 21 de abril de 2026*
