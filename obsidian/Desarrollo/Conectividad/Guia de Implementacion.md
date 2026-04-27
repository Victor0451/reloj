# Guía de Implementación del Sistema de Conectividad

Esta guía proporciona instrucciones paso a paso para implementar y configurar el sistema de conectividad en un nuevo entorno o después de una migración.

## Pre-requisitos

### 1. Dependencias del Sistema

- Node.js 18+ 
- npm o yarn
- Acceso a proyecto Supabase
- Credenciales de API (si se usa verificación programmática)

### 2. Variables de Entorno Requeridas

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu-url-de-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima
SUPABASE_SERVICE_ROLE_KEY=tu-clave-de-servicio

# Sistema de Conectividad
CRON_AUTH_TOKEN=token-secreto-para-cron-jobs
CONNECTIVITY_TIMEOUT=5000

# Opcional
LOG_LEVEL=info
```

### 3. Configuración de Supabase

#### Habilitar Realtime para Tabla Devices

1. Ir a [Supabase Dashboard](https://app.supabase.com)
2. Seleccionar proyecto
3. Ir a **Database** > **Replication**
4. En la tabla `devices`, habilitar:
   - `INSERT`
   - `UPDATE`
   - `DELETE`

#### Verificar Permisos RLS

```sql
-- En SQL Editor de Supabase
-- Verificar que existe política para lectura
SELECT * FROM information_schema.r polices 
WHERE tablename = 'devices';

-- Crear política si no existe
CREATE POLICY "Allow read for authenticated users"
ON devices
FOR SELECT
TO authenticated
USING (true);
```

## Instalación Paso a Paso

### Paso 1: Copiar Archivos de Código

Copiar los siguientes archivos al proyecto:

```
src/
├── lib/
│   ├── device-connectivity.ts    # Librería de conectividad
│   └── cron-jobs.ts             # Funciones de tareas programadas
├── actions/
│   └── device-connectivity.ts    # Server actions
└── components/
    └── devices/
        ├── device-card.tsx      # Componente de tarjeta (actualizado)
        └── connectivity-check-button.tsx
```

### Paso 2: Crear Tabla de Dispositivos

Si la tabla no existe, crear en Supabase:

```sql
CREATE TABLE devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  serial_number TEXT NOT NULL UNIQUE,
  model TEXT,
  ip_address TEXT,
  firmware_version TEXT,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'unknown')),
  last_seen_at TIMESTAMPTZ,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE devices;

-- Crear índice para búsquedas
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);
```

### Paso 3: Crear Página de Conectividad

Crear archivo en `/src/app/(dashboard)/dashboard/connectivity/page.tsx`

### Paso 4: Configurar API Endpoint

Crear archivo en `/src/app/api/check-connectivity/route.ts`

### Paso 5: Actualizar Dashboard

Modificar `/src/app/(dashboard)/dashboard/page.tsx` para mostrar resumen de conectividad

### Paso 6: Configurar Tareas Programadas

#### Opción A: GitHub Actions

Crear archivo `.github/workflows/health-check.yml`:

```yaml
name: Health Check

on:
  schedule:
    - cron: '*/2 * * * *'
  workflow_dispatch:

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run health check
        run: npm run health-check
        env:
          CRON_AUTH_TOKEN: ${{ secrets.CRON_AUTH_TOKEN }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

#### Opción B: Sistema (Linux/Mac)

```bash
# Agregar al crontab
crontab -e

# Agregar línea
*/2 * * * * curl -s -H "Authorization: Bearer $CRON_AUTH_TOKEN" https://tu-dominio.com/api/check-connectivity >> /var/log/reloj-connectivity.log 2>&1
```

## Verificación de Instalación

### 1. Verificar que el Código Compila

```bash
npm run build
```

### 2. Probar Verificación Manual

1. Ir a `/dashboard/devices`
2. Hacer click en botón de verificación de un dispositivo
3. Verificar que el estado se actualiza

### 3. Probar Verificación Masiva

1. Ir a `/dashboard/connectivity`
2. Hacer click en "Verificar Todos"
3. Verificar que todos los estados se actualizan

### 4. Probar API Endpoint

```bash
curl -v -H "Authorization: Bearer $CRON_AUTH_TOKEN" \
  https://tu-dominio.com/api/check-connectivity
```

### 5. Verificar Realtime

1. Abrir `/dashboard/devices` en dos navegadores
2. Actualizar estado de un dispositivo desde Supabase Dashboard
3. Verificar que el cambio se refleja en ambos navegadores sin recargar

## Configuración de Produção

### 1. Variables de Entorno

Configurar en el panel de deployment (Vercel, Railway, etc.):

```
NEXT_PUBLIC_SUPABASE_URL=production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=production-key
CRON_AUTH_TOKEN=production-token-secreto
```

### 2. Secrets de GitHub

Si usa GitHub Actions, configurar en Settings > Secrets:

```
CRON_AUTH_TOKEN=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 3. Monitoreo

Configurar alertas para:
- Errores frecuentes en verificaciones
-离线 dispositivos por > 30 minutos
- Latencia promedio > 500ms

## Mantenimiento

### Tareas Regulares

1. **Revisión de Logs:** Semanal
2. **Limpieza de Datos Antiguos:** Mensual
3. **Actualización de Dependencias:** Según necesidades
4. **Revisión de Métricas:** Mensual

### Scripts de Mantenimiento

```bash
#!/bin/bash
# /scripts/maintenance.sh

# Limpiar logs antiguos
find /var/log/reloj -name "*.log" -mtime +30 -delete

# Respaldar estado de dispositivos
pg_dump $DATABASE_URL --table=devices --data-only > backups/devices-$(date +%Y%m%d).sql

# Verificar integridad de datos
# (ejecutar en Supabase)
# SELECT COUNT(*) FROM devices WHERE status = 'unknown' AND last_seen_at IS NULL;
```

## Troubleshooting Rápido

| Problema | Solución Rápida |
|----------|------------------|
| Dispositivo siempre offline | Verificar IP y conectividad de red |
| No actualiza estado | Verificar permisos RLS en Supabase |
| Realtime no funciona | Habilitar Realtime en Supabase Dashboard |
| Cron no se ejecuta | Verificar configuración de crontab y logs |
| Alto uso de CPU | Reducir frecuencia de verificaciones |

## Referencias

- [[Arquitectura del Sistema de Conectividad]]
- [[Componentes Técnicos]]
- [[API y Endpoints]]
- [[Tareas Programadas]]
- [[Manejo de Errores]]
- [[Troubleshooting]]

---
**Última actualización:** April 15, 2026