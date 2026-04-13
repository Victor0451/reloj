# Guía de Desarrollo - Fase 1

## Requisitos Previos

| Herramienta | Versión Mínima | Verificación |
|-------------|----------------|--------------|
| Node.js | 20.x | `node --version` |
| npm | 10.x | `npm --version` |
| Git | 2.x | `git --version` |

## Configuración del Entorno

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Crear archivo `.env.local` en la raíz:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

> ⚠️ **Importante**: El archivo `.env.local` está en `.gitignore` y no se commitea.

### 3. Configurar Base de Datos

1. Ir a [app.supabase.com](https://app.supabase.com)
2. Seleccionar el proyecto
3. Ir a **SQL Editor**
4. Ejecutar el contenido de `supabase/schema.sql`

### 4. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## Estructura del Proyecto

```
reloj/
├── src/
│   ├── actions/           # Server Actions
│   ├── app/               # App Router (rutas)
│   │   ├── (auth)/        # Grupo: login, signup
│   │   └── (dashboard)/   # Grupo: todas las páginas protegidas
│   ├── components/
│   │   ├── auth/          # LoginForm, SignupForm
│   │   ├── layout/        # AppSidebar
│   │   └── ui/            # Componentes shadcn/ui
│   ├── hooks/             # Hooks personalizados
│   ├── lib/
│   │   └── supabase/      # Clientes browser y server
│   └── types/             # Tipos TypeScript
├── supabase/
│   └── schema.sql         # Esquema de la DB
├── docs/                  # Documentación
├── public/                # Assets estáticos
├── .env.local             # Variables de entorno
└── .env.example           # Ejemplo de variables
```

## Convenciones de Código

### Import Aliases

```typescript
// ✅ Usar @/ para imports absolutos
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

// ❌ No usar imports relativos profundos
import { Button } from '../../../components/ui/button'
```

### Naming

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Archivos | kebab-case | `login-form.tsx` |
| Componentes | PascalCase | `LoginForm.tsx` |
| Funciones | camelCase | `createUser()` |
| Constantes | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Tipos/Interfaces | PascalCase | `Database`, `UserProfile` |
| Variables | camelCase | `userData`, `isLoading` |

### Server Components vs Client Components

```typescript
// Server Component (default)
// - Puede acceder a DB directamente
// - No puede usar hooks (useState, useEffect)
// - No puede usar event handlers (onClick, onSubmit)
export default async function ServerPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('persons').select('*')
  return <div>{/* ... */}</div>
}
```

```typescript
// Client Component
// Requiere 'use client' al inicio del archivo
'use client'

import { useState } from 'react'

export default function ClientComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

### Server Actions

```typescript
// Server Action: se define en src/actions/
'use server'

import { createClient } from '@/lib/supabase/server'

export async function miAccion(formData: FormData) {
  const supabase = await createClient()
  // Lógica del servidor...
  return { success: true, data: result }
}
```

```typescript
// Uso en componente cliente
'use client'

import { miAccion } from '@/actions/miAccion'

export default function MiForm() {
  async function handleSubmit(formData: FormData) {
    const result = await miAccion(formData)
    if (result.success) {
      // Manejar éxito
    }
  }

  return <form action={handleSubmit}>{/* ... */}</form>
}
```

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor de desarrollo en `localhost:3000` |
| `npm run build` | Compila la aplicación para producción |
| `npm start` | Inicia el servidor de producción (después de build) |
| `npm run lint` | Ejecuta ESLint para verificar código |

## Patrones Comunes

### Crear una Nueva Página en el Dashboard

1. Crear la carpeta en `src/app/(dashboard)/dashboard/mi-pagina/`
2. Crear `page.tsx`:

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function MiPaginaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Página</h1>
        <p className="text-muted-foreground">Descripción de la página</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sección</CardTitle>
          <CardDescription>Descripción</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Contenido */}
        </CardContent>
      </Card>
    </div>
  )
}
```

3. Agregar la ruta en el sidebar (`src/components/layout/AppSidebar.tsx`):

```typescript
const menuItems = [
  // ... items existentes
  {
    title: 'Mi Página',
    href: '/dashboard/mi-pagina',
    icon: MiIcono,
  },
]
```

### Agregar un Nuevo Componente de UI

```bash
npx shadcn@latest add <componente>
```

Ejemplo:
```bash
npx shadcn@latest add select tabs
```

### Hacer Querys a Supabase

**En Server Component:**
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MiPagina() {
  const supabase = await createClient()
  
  const { data: persons, error } = await supabase
    .from('persons')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
  }

  return <div>{/* Usar data */}</div>
}
```

**En Client Component:**
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function MiComponente() {
  const [persons, setPersons] = useState([])

  useEffect(() => {
    async function fetchPersons() {
      const supabase = createClient()
      const { data } = await supabase
        .from('persons')
        .select('*')
        .eq('status', 'active')
      setPersons(data || [])
    }
    fetchPersons()
  }, [])

  return <div>{/* Usar persons */}</div>
}
```

### Manejo de Errores en Server Actions

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

export async function crearPersona(formData: FormData) {
  const supabase = await createClient()
  
  const name = formData.get('name') as string
  
  if (!name) {
    return { error: 'El nombre es requerido' }
  }

  const { data, error } = await supabase
    .from('persons')
    .insert({ name })
    .select()
    .single()

  if (error) {
    return { error: error.message }
  }

  return { success: true, data }
}
```

Uso en el componente:
```typescript
const [error, setError] = useState<string | null>(null)

async function handleSubmit(formData: FormData) {
  setError(null)
  const result = await crearPersona(formData)
  if (result?.error) {
    setError(result.error)
  } else if (result?.success) {
    toast.success('Persona creada')
  }
}
```

## Debugging

### Ver Logs del Servidor

Los `console.log` en Server Components y Server Actions aparecen en la terminal donde corre `npm run dev`.

### Ver Logs del Browser

Los `console.log` en Client Components aparecen en la consola del navegador (F12).

### Inspeccionar Cookies

1. Abrir DevTools (F12)
2. Ir a **Application** → **Cookies**
3. Buscar las cookies de Supabase (`sb-*`)

### Verificar Conexión a Supabase

```typescript
// En un Server Component o Server Action
const supabase = await createClient()
const { data, error } = await supabase.from('persons').select('count').single()
console.log('Conexión OK:', data)
console.log('Error:', error)
```

## Troubleshooting

### Error: "Module not found"

Verificar que el import alias `@/*` esté configurado en `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Error de TypeScript en build

Ejecutar:
```bash
npm run build
```

Leer el error con atención. Los errores más comunes son:
- Tipos incompatibles (usar `as string` o `as const` si es necesario)
- Props inexistentes en componentes shadcn/ui (ver la API de cada componente)

### Redirección infinita login ↔ dashboard

Verificar que:
- El middleware esté configurado correctamente
- Las cookies de Supabase se estén escribiendo
- Las variables de entorno sean correctas

### "Invalid API key" de Supabase

Verificar que:
- `.env.local` existe y tiene las variables correctas
- El servidor se reinició después de crear `.env.local`
- Las keys son las correctas (anon para cliente, service_role para server)

## Git Workflow

### Commits

```bash
git add -A
git commit -m "tipo: descripción"
```

Tipos de commit (Conventional Commits):
- `feat:` nueva funcionalidad
- `fix:` corrección de bug
- `docs:` solo documentación
- `style:` formato, sin cambio de código
- `refactor:` refactorización de código
- `chore:` cambios de configuración, build, etc.

### Branches

| Branch | Uso |
|--------|-----|
| `main` | Código estable, listo para deploy |
| `develop` | Desarrollo (opcional) |
| `feat/nombre-feature` | Nueva funcionalidad |
| `fix/nombre-bug` | Corrección de bug |

## Deploy en Vercel

### Configuración Automática

1. Conectar el repositorio de GitHub a Vercel
2. Agregar las variables de entorno en el dashboard de Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Vercel detecta Next.js automáticamente
4. Deploy en cada push a `main`

### Variables de Entorno en Vercel

Ir a: **Project Settings** → **Environment Variables**

Agregar las mismas variables que están en `.env.local`.

---

## Referencias

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
