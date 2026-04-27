# RELOJ - Sistema de Gestión de Relojes Biométricos

> **Sistema centralizado para gestión de dispositivos biométricos de múltiples marcas**

---

## 📋 Resumen Ejecutivo

**RELOJ** es un sistema de gestión de relojes biométricos que permite administrar dispositivos de diferentes marcas (Hikvision, ZKTeco, Suprema, Dahua, etc.) desde una única plataforma.

### Dispositivo Actual en Producción
- **Marca:** Hikvision
- **Modelo:** DS-K1T320MFWX
- **IP:** `192.168.1.175`
- **Serial:** `DS-K1T320MFWX20221110V030500ENK95444359`
- **Firmware:** V3.5.0

### Stack Tecnológico
- **Frontend:** Next.js 16 + TypeScript + Tailwind
- **Backend/API:** Supabase (PostgreSQL + Realtime + Edge Functions)
- **Agent Bridge:** Node.js + TypeScript
- **Comunicación Dispositivo:** ISAPI sobre HTTP/Digest Auth

---

## 🎯 Objetivo Principal

**Hacer el sistema AGNÓSTICO de marcas.**

En lugar de hardcodear lógica para cada marca, implementar una arquitectura de **adaptadores** que permita:
- Conectar nuevos dispositivos sin cambiar código core
- Mantener la lógica de cada marca aislada
- Extender soporte fácilmente

---

## 📁 Estructura del Proyecto

```
reloj/
├── agent/                      # Bridge entre Supabase y dispositivos
│   ├── src/
│   │   ├── core/              # Interfaces y factory (AGNÓSTICO)
│   │   │   ├── interfaces.ts
│   │   │   ├── adapter-manager.ts
│   │   │   └── index.ts
│   │   ├── adapters/          # Implementaciones por marca
│   │   │   └── hikvision.adapter.ts
│   │   ├── sync/              # Loops de sincronización
│   │   │   ├── heartbeat-loop.ts
│   │   │   ├── event-sync-loop.ts
│   │   │   └── person-sync-loop.ts
│   │   └── isapi/             # Cliente HTTP con Digest Auth
│   ├── package.json
│   └── .env                   # Credenciales de dispositivos
├── supabase/
│   └── migrations/            # Esquema de base de datos
├── src/                       # Frontend Next.js
│   ├── components/
│   ├── types/
│   └── app/
└── scripts/
    └── diagnose-clock.sh
```

---

## 🔗 Enlaces Rápidos

- [[Arquitectura/Arquitectura Multi-Marca]] - Diseño del sistema de adaptadores
- [[Arquitectura/Estado del Proyecto]] - Timeline y roadmap
- [[Módulos/Agente Bridge]] - Documentación del agente
- [[Desarrollo/Conectividad/README]] - Sistema de conectividad

---

## 🚀 Estado Actual

El proyecto se encuentra en **fase de refactorización** para soportar múltiples marcas. Ver [[Arquitectura/Estado del Proyecto]] para detalles completos.

---

## 👤 Contacto

Desarrollado por Gentleman Programming
