# Sistema de Autenticación

## Descripción General

Este documento detalla la implementación del sistema de autenticación para el sistema web de gestión biométrica Hikvision, basado en Supabase Auth con Next.js Server Actions y middleware.

## Arquitectura

```
┌───────────────────────────────────────────────────────────────┐
│                        Navegador                              │
│                                                               │
│  ┌────────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ /login     │    │ /signup     │    │ /dashboard/*     │   │
│  │ LoginForm  │    │ SignupForm  │    │ (protegido)      │   │
│  └─────┬──────┘    └──────┬──────┘    └────────┬─────────┘   │
│        │                  │                    │              │
└────────┼──────────────────┼────────────────────┼──────────────┘
         │                  │                    │
         ▼                  ▼                    ▼
┌───────────────────────────────────────────────────────────────┐
│                      Next.js Server                           │
│                                                               │
│  ┌─────────────────────┐     ┌─────────────────────────────┐ │
│  │ Server Actions      │     │ middleware.ts               │ │
│  │ src/actions/auth.ts │     │ - Refresh cookies de sesión │ │
│  │                     │     │ - No bloquea rutas          │ │
│  │ • login()           │     └──────────────┬──────────────┘ │
│  │ • signup()          │                    │                 │
│  │ • logout()          │                    │                 │
│  └──────────┬──────────┘                    │                 │
│             │                               │                 │
│             ▼                               ▼                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ lib/supabase/server.ts                                │    │
│  │ • createServerClient() con cookies                    │    │
│  │ • Integración con @supabase/ssr                       │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────────┐
│                      Supabase Cloud                         │
│                                                               │
│  ┌─────────────────┐    ┌──────────────────────────────────┐ │
│  │ Supabase Auth   │───>│ Tabla: profiles                  │ │
│  │ • signIn()      │    │ • Trigger: handle_new_user()     │ │
│  │ • signUp()      │    │ • RLS por rol                    │ │
│  │ • signOut()     │    └──────────────────────────────────┘ │
│  │ • getUser()     │                                         │
│  └─────────────────┘                                         │
└───────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. Server Actions (`src/actions/auth.ts`)

Archivo de funciones de servidor que interactúan directamente con Supabase Auth.

#### `login(formData: FormData)`

Inicia sesión con email y contraseña.

```typescript
export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
```

**Flujo:**
1. Recibe el FormData del formulario de login
2. Extrae email y password
3. Llama a `signInWithPassword` de Supabase
4. Si hay error, retorna `{ error: mensaje }`
5. Si es exitoso, redirige a `/dashboard`

**Uso en componente:**
```tsx
<form action={handleSubmit}>
  <Input name="email" type="email" />
  <Input name="password" type="password" />
  <Button type="submit">Iniciar Sesión</Button>
</form>
```

#### `signup(formData: FormData)`

Crea una nueva cuenta de usuario.

```typescript
export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
```

**Flujo:**
1. Recibe el FormData del formulario de registro
2. Extrae email, password y nombre completo
3. Llama a `signUp` con metadatos (`full_name`)
4. El trigger `handle_new_user()` en Supabase crea automáticamente el perfil
5. Si hay error, retorna `{ error: mensaje }`
6. Si es exitoso, redirige a `/dashboard`

#### `logout()`

Cierra la sesión del usuario actual.

```typescript
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### 2. Clientes de Supabase

#### Cliente de Browser (`src/lib/supabase/client.ts`)

Se usa en componentes de cliente (`'use client'`).

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database.types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Uso típico:**
```tsx
'use client'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data } = await supabase.from('persons').select('*')
```

#### Cliente de Server (`src/lib/supabase/server.ts`)

Se usa en Server Components y Server Actions.

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database.types'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado en Server Components
          }
        },
      },
    }
  )
}
```

**Diferencia clave con el cliente browser:**
- Maneja cookies de forma explícita a través del `cookieStore` de Next.js
- Permite que las Server Actions lean y escriban cookies de sesión

### 3. Middleware (`src/middleware.ts`)

Se ejecuta en cada request antes de que llegue a la página.

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => 
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // Refresh de la sesión (no bloquea)
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Funciones del middleware:**
1. Crea un cliente de Supabase para el request
2. Llama a `getUser()` para refrescar las cookies de sesión
3. Propaga las cookies actualizadas al response
4. No bloquea ninguna ruta (las páginas verifican auth por su cuenta)

**Matcher:**
- Excluye archivos estáticos (`_next/static`, imágenes, favicon, assets)
- Se aplica a todas las demás rutas

### 4. Protección de Rutas

#### Página de Login (`src/app/(auth)/login/page.tsx`)

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginForm from '@/components/auth/LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LoginForm />
}
```

**Lógica:**
- Si ya hay sesión activa, redirige al dashboard
- Si no, muestra el formulario de login

#### Layout del Dashboard (`src/app/(dashboard)/layout.tsx`)

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { SidebarInset } from '@/components/ui/sidebar'

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

**Lógica:**
- Si no hay usuario, redirige al login
- Si hay usuario, renderiza el layout con sidebar

#### Home Page (`src/app/page.tsx`)

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
```

**Lógica:**
- Punto de entrada inteligente: redirige según el estado de sesión

## Formularios de UI

### LoginForm (`src/components/auth/LoginForm.tsx`)

Componente de cliente que maneja el estado de loading y errores.

```tsx
'use client'

import { login } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>Ingresá tus credenciales para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Input id="email" name="email" type="email" placeholder="tu@email.com" required />
            <Input id="password" name="password" type="password" required />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </Button>
            <Link href="/signup">Crear cuenta</Link>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### SignupForm (`src/components/auth/SignupForm.tsx`)

Similar al LoginForm pero con campo adicional de `full_name` y llama a `signup()`.

## Perfiles Automáticos

Cuando un usuario se registra, el trigger `handle_new_user()` en Supabase crea automáticamente un perfil:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

La función extrae los metadatos del signup:

```sql
INSERT INTO public.profiles (id, email, full_name, role)
VALUES (
  NEW.id,
  NEW.email,
  COALESCE(NEW.raw_user_metadata->>'full_name', ''),
  COALESCE(NEW.raw_user_metadata->>'role', 'hr_operator')
);
```

Desde la Server Action `signup()`, los metadatos se pasan así:

```typescript
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: fullName,  // → raw_user_metadata->>'full_name'
    },
  },
})
```

## Tokens y Sesiones

### Gestión de Cookies

Supabase Auth usa cookies HTTP para mantener la sesión:

| Cookie | Propósito | Duración |
|--------|-----------|----------|
| `sb-access-token` | JWT con claims del usuario | 1 hora |
| `sb-refresh-token` | Token para refrescar el access token | 60 días (configurable) |

### Flujo de Refresh

1. El access token expira después de 1 hora
2. El middleware llama a `getUser()` en cada request
3. Si el access token expiró, Supabase lo refresca automáticamente usando el refresh token
4. Las nuevas cookies se escriben en el response

## Seguridad

### Medidas Implementadas

| Medida | Implementación |
|--------|----------------|
| HTTPS | Obligatorio en producción (Vercel) |
| Password hashing | Manejado por Supabase (bcrypt) |
| JWT con expiración | Access token de 1 hora |
| Refresh tokens | Rotación automática |
| RLS en la DB | Políticas por rol y usuario |
| CSRF protection | Next.js + Supabase lo manejan |
| HttpOnly cookies | Supabase ssr usa cookies seguras |

### Buenas Prácticas

- ✅ Las Server Actions se ejecutan solo en el servidor
- ✅ Las credenciales nunca se exponen al cliente
- ✅ El service_role key nunca se usa en el browser
- ✅ RLS habilitado en todas las tablas
- ✅ Redirect después de auth/logout

## Errores Manejados

| Escenario | Mensaje de Error |
|-----------|------------------|
| Email no registrado | "No account found with this email" |
| Contraseña incorrecta | "Invalid password" |
| Email ya registrado | "User already registered" |
| Contraseña < 6 caracteres | "Password should be at least 6 characters" |
| Formato de email inválido | Validación nativa del input HTML |

## Próximas Mejoras (Fases Futuras)

| Mejora | Fase | Descripción |
|--------|------|-------------|
| Confirmación de email | F7 | Requerir verificación de email al registrarse |
| Magic Links | F7 | Login sin contraseña vía email |
| MFA/2FA | F7 | Autenticación de dos factores |
| Roles dinámicos | F3 | Poder asignar roles desde la UI |
| Session timeout | F6 | Cerrar sesión por inactividad |
| Password reset | F7 | Recuperar contraseña por email |
