---
tags: [desarrollo, setup]
date: 2026-04-13
---

# Setup del Entorno

> [!info] Resumen
> Pasos para configurar el entorno de desarrollo desde cero.

---

## Prerrequisitos

| Herramienta | Versión | Verificación |
|-------------|---------|--------------|
| Node.js | 20.x | `node --version` |
| npm | 10.x | `npm --version` |
| Git | 2.x | `git --version` |

## Pasos

1. **Instalar dependencias**
   ```bash
   npm install           # Next.js
   cd agent && npm install && cd ..  # Agente
   ```

2. **Configurar `.env.local`**
   ```bash
   cp .env.example .env.local
   # Editar con credenciales de Supabase
   ```

3. **Configurar agente**
   ```bash
   cd agent && cp .env.example .env
   # Editar con credenciales + dispositivo
   ```

4. **Ejecutar migraciones**
   - Supabase Dashboard → SQL Editor
   - `001_create_door_commands.sql`
   - `002_fix_handle_new_user_trigger.sql`

5. **Iniciar desarrollo**
   ```bash
   npm run dev           # Next.js
   cd agent && npm run dev  # Agente
   ```

## Ver También

- [[Guía de Desarrollo]]
- [[Deploy]]
