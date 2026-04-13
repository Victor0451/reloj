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
| **Fase 2** | Agente Bridge | ⏳ Pendiente | Agente Node.js local para conectar con el reloj Hikvision vía ISAPI |
| **Fase 3** | Gestión de Personas | ⏳ Pendiente | CRUD completo de personas con foto facial y huella |
| **Fase 4** | Eventos y Dashboard | ⏳ Pendiente | Listado de eventos en tiempo real, dashboard con KPIs |
| **Fase 5** | Reportes | ⏳ Pendiente | Reportes de asistencia con exportación PDF y Excel |
| **Fase 6** | Control de Puerta | ⏳ Pendiente | Apertura/cierre remoto de puerta |
| **Fase 7** | QA y Hardening | ⏳ Pendiente | Testing, revisión de seguridad, documentación final |

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
Fase 2: Agente Bridge                 ░░░░░░░░░░░░░░░░░░░░   0%
Fase 3: Gestión de Personas           ░░░░░░░░░░░░░░░░░░░░   0%
Fase 4: Eventos y Dashboard           ░░░░░░░░░░░░░░░░░░░░   0%
Fase 5: Reportes                      ░░░░░░░░░░░░░░░░░░░░   0%
Fase 6: Control de Puerta             ░░░░░░░░░░░░░░░░░░░░   0%
Fase 7: QA y Hardening                ░░░░░░░░░░░░░░░░░░░░   0%
                                       ─────────────────
Progreso Total:                       ░░░░░░░░░░░░░░░░░░░░  ~14%
```

---

### 📝 Registro de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-04-13 | Creación del proyecto, Fase 1 completa | Equipo |

---

*Última actualización: 13 de abril de 2026*
