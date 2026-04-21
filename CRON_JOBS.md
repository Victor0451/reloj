# Configuración de Tareas Programadas (Cron Jobs)

Este documento describe cómo configurar las tareas programadas para monitoreo automático de conectividad de dispositivos.

## Tareas Disponibles

### 1. Verificación de Conectividad
Verifica la conectividad de todos los dispositivos registrados y actualiza su estado en la base de datos.

**Ruta**: `/api/check-connectivity`
**Frecuencia recomendada**: Cada 2 minutos

### 2. Verificación de Inactividad
Marca como offline los dispositivos que no han sido vistos en un cierto periodo.

**Ruta**: Script en `scripts/check-inactivity.ts`
**Frecuencia recomendada**: Cada 5 minutos

## Configuración con Crontab (Linux/Mac)

Para configurar las tareas programadas en sistemas Linux o Mac, sigue estos pasos:

1. Abre el editor de crontab:
```bash
crontab -e
```

2. Agrega las siguientes líneas:

```bash
# Verificar conectividad cada 2 minutos
*/2 * * * * curl -s https://tu-dominio.com/api/check-connectivity

# Verificar inactividad cada 5 minutos
*/5 * * * * cd /ruta/al/proyecto && node scripts/check-inactivity.js
```

## Configuración con GitHub Actions

También puedes usar GitHub Actions para ejecutar estas tareas:

```yaml
name: Health Check

on:
  schedule:
    - cron: '*/2 * * * *'  # Cada 2 minutos
  workflow_dispatch:

jobs:
  connectivity-check:
    runs-on: ubuntu-latest
    steps:
      - name: Call Health Check API
        run: |
          curl -s -H "Authorization: Bearer ${{ secrets.CRON_AUTH_TOKEN }}" \
            https://tu-dominio.com/api/check-connectivity
```

## Configuración del Token de Autenticación

Para proteger las rutas de API, configura la variable de entorno:

```bash
CRON_AUTH_TOKEN=tu-token-secreto-aqui
```

## Monitoreo y Logs

Todos los resultados de las verificaciones se registran en la consola y pueden ser vistos en:
- Los logs del servidor
- La tabla de eventos de la base de datos (si configurada)
- Notificaciones por email/slack (si configuradas)