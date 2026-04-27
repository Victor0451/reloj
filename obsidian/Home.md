---
tags: [moc, proyecto, index]
date: 2026-04-13
status: activo
---

# 🏗️ RELOJ — Hikvision Sistema Web

> [!info] Resumen
> Sistema web full-stack para gestión remota de reloj biométrico **Hikvision DS-K1T320MFWX** vía ISAPI/HTTPS.

---

## 📌 Visión General

| Campo | Valor |
|-------|-------|
| **Proyecto** | reloj |
| **Dispositivo** | [[Dispositivo - DS-K1T320MFWX]] |
| **Stack** | Next.js 16, React 19, TypeScript, Supabase, Tailwind 4 |
| **Agente** | [[Agente Bridge]] |
| **Protocolo** | [[Referencia ISAPI]] |
| **Deploy** | Vercel (frontend) + PM2/Node.js local (agente) |

---

## 📂 Mapa del Vault

### 🏛️ Arquitectura
- [[Arquitectura del Sistema]]
- [[Stack Tecnológico]]
- [[Decisiones de Arquitectura]]
- [[Seguridad]]

### 🗄️ Base de Datos
- [[Esquema de Base de Datos]]
- [[Tabla - profiles]]
- [[Tabla - persons]]
- [[Tabla - access_events]]
- [[Tabla - devices]]
- [[Tabla - audit_logs]]
- [[Tabla - door_commands]]

### 🔌 API ISAPI
- [[Referencia ISAPI]]
- [[Endpoint - deviceInfo]]
- [[Endpoint - UserInfo]]
- [[Endpoint - AcsEvent]]
- [[Endpoint - Door Status]]
- [[Endpoint - Door Control]]

### 📦 Módulos
- [[Módulo - Auth]]
- [[Módulo - Dashboard]]
- [[Módulo - Personas]]
- [[Módulo - Eventos]]
- [[Módulo - Reportes]]
- [[Módulo - Control de Puerta]]
- [[Módulo - Estado del Dispositivo]]
- [[Módulo - Auditoría]]
- [[Módulo - Configuración]]
- [[Módulo - Agente Bridge]]

### 🔄 Fases
- [[Fase 1 - Infraestructura]] ✅
- [[Fase 2 - Agente Bridge]] ✅
- [[Fase 3 - Gestión de Personas]] ✅
- [[Fase 4 - Eventos y Dashboard]] ✅
- [[Fase 5 - Reportes]] ⏳
- [[Fase 6 - Control de Puerta]] ⏳
- [[Fase 7 - QA y Hardening]] ⏳
- [[Fase 8 - Person Provisioning]] ✅ (27-Apr-2026, Sync bidireccional + attendance events)

### 🛠️ Desarrollo
- [[Guía de Desarrollo]]
- [[Convenciones de Código]]
- [[Componentes UI]]
- [[Setup del Entorno]]

### 🧪 QA
- [[Plan de Testing]]
- [[Checklist de Seguridad]]
- [[Checklist de Performance]]

### 🚀 Operaciones
- [[Deploy]]
- [[Agente Bridge - Guía de Instalación]]
- [[Troubleshooting]]
- [[Operación - DS-K1T320MFWX]]
- [[Operación - Sincronización de Personas]]

### 🐛 Bugs & Fixes
- [[Fix - Attendance Events Mapping]] — Attendance events ahora muestran Entrada/Salida correctamente
- [[Operación - Sincronización de Personas]] — Sync bidireccional funcional
- `Bugs & Fixes/` — un note por bug con link al PR

### 📋 Decisiones
- `Decisiones/` — ADRs numerados con contexto y tradeoffs

---

## 📊 Estado del Proyecto

```
Fase 1: Infraestructura Base       ████████████████████ 100% ✅
Fase 2: Agente Bridge              ████████████████████ 100% ✅
Fase 3: Gestión de Personas        ████████████████████ 100% ✅
Fase 4: Eventos y Dashboard        ████████████████████ 100% ✅
Fase 5: Reportes                   ░░░░░░░░░░░░░░░░░░░░   0%
Fase 6: Control de Puerta          ░░░░░░░░░░░░░░░░░░░░   0%
Fase 7: QA y Hardening             ░░░░░░░░░░░░░░░░░░░░   0%
Fase 8: Person Provisioning       ████████████████████ 100% ✅
                                     ─────────────────
Progreso Total:                     ████████████░░░░░░░░░ ~71%
```

---

## 🔗 Links Externos

| Servicio | URL |
|----------|-----|
| [[Supabase Dashboard]] | https://app.supabase.com |
| [[Vercel Dashboard]] | https://vercel.com |
| [[Next.js Docs]] | https://nextjs.org/docs |
| [[shadcn/ui Docs]] | https://ui.shadcn.com |
| [[Tailwind CSS Docs]] | https://tailwindcss.com |
