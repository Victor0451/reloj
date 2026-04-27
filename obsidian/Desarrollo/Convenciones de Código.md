---
tags: [desarrollo, convenciones]
date: 2026-04-13
---

# Convenciones de Código

> [!info] Resumen
> Estándares de nombramiento, estructura y estilo del proyecto.

---

## Nombramiento

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Archivos | kebab-case | `login-form.tsx` |
| Componentes | PascalCase | `LoginForm.tsx` |
| Funciones | camelCase | `createPerson()` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Tipos/Interfaces | PascalCase | `Database`, `UserProfile` |
| Variables | camelCase | `userData`, `isLoading` |

## Imports

```typescript
// ✅ Usar @/ alias
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

// ❌ No usar imports relativos profundos
import { Button } from '../../../components/ui/button'
```

## Server vs Client Components

```typescript
// Server Component (default)
// - Acceso directo a DB
// - Sin hooks (useState, useEffect)
// - Sin event handlers
export default async function ServerPage() { ... }
```

```typescript
// Client Component
'use client'
// - Hooks permitidos
// - Event handlers
// - Interactive UI
export default function ClientComponent() { ... }
```

## Commits

Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `chore:`

## Ver También

- [[Guía de Desarrollo]]
- [[Stack Tecnológico]]
