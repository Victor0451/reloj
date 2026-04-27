---
tags: [desarrollo, guía]
date: 2026-04-13
---

# Guía de Desarrollo

> [!info] Resumen
> Todo lo necesario para desarrollar en el proyecto reloj.

---

## Setup

```bash
# 1. Clonar repo
git clone <repo> reloj && cd reloj

# 2. Instalar dependencias (Next.js)
npm install

# 3. Instalar dependencias (Agente)
cd agent && npm install && cd ..

# 4. Configurar .env.local
cp .env.example .env.local
# Editar con credenciales de Supabase

# 5. Configurar agente
cd agent && cp .env.example .env
# Editar con credenciales de Supabase + dispositivo

# 6. Ejecutar migraciones en Supabase Dashboard → SQL Editor
#    - supabase/migrations/001_create_door_commands.sql
#    - supabase/migrations/002_fix_handle_new_user_trigger.sql
```

## Comandos

| Comando | Directorio | Función |
|---------|-----------|---------|
| `npm run dev` | raíz | Next.js dev server |
| `npm run build` | raíz | Build producción |
| `npm run lint` | raíz | ESLint |
| `npm run dev` | `agent/` | Agente con hot reload |
| `npm start` | `agent/` | Agente producción |

## Convenciones

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Archivos | kebab-case | `login-form.tsx` |
| Componentes | PascalCase | `LoginForm.tsx` |
| Funciones | camelCase | `createUser()` |
| Tipos | PascalCase | `Database`, `UserProfile` |
| Imports | `@/*` alias | `@/components/ui/button` |

## Estructura

```
reloj/
├── agent/                    # [[Agente Bridge]]
├── src/
│   ├── actions/              # Server Actions
│   ├── app/                  # Next.js App Router
│   │   ├── (auth)/           # Login, signup
│   │   └── (dashboard)/      # Páginas protegidas
│   ├── components/
│   │   ├── auth/             # Formularios
│   │   ├── layout/           # AppSidebar, ThemeToggle
│   │   └── ui/               # shadcn/ui + custom
│   ├── lib/supabase/         # Clientes
│   └── types/                # TS types
├── supabase/
│   ├── schema.sql            # Esquema completo
│   └── migrations/           # Migraciones
└── docs/                     # Documentación técnica
```

## Ver También

- [[Convenciones de Código]]
- [[Componentes UI]]
- [[Setup del Entorno]]
