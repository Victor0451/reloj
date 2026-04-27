---
tags: [operaciones, agente, instalación]
date: 2026-04-13
---

# Agente Bridge - Guía de Instalación

> [!info] Resumen
> Pasos para instalar el [[Agente Bridge]] en la red local del cliente.

---

## Requisitos

- Node.js 20+
- Acceso a la red local del reloj Hikvision
- Credenciales de Supabase

## Pasos

### 1. Instalar dependencias

```bash
cd agent
npm install --production
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env`:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `SUPABASE_URL` | URL de Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJ...` |
| `DEVICE_IP` | IP del reloj | `192.168.1.175` |
| `DEVICE_PORT` | Puerto ISAPI | `443` |
| `DEVICE_USERNAME` | Usuario del reloj | `admin` |
| `DEVICE_PASSWORD` | Contraseña del reloj | `****` |

### 3. Ejecutar

```bash
# Desarrollo
npm run dev

# Producción con PM2
pm2 start npm --name "agent-bridge" -- start
pm2 save
pm2 startup
```

### 4. Verificar

```bash
pm2 logs agent-bridge
# Debería mostrar:
# - "Starting Agent Bridge..."
# - "Device found: DS-K1T320MFWX (SN: XXX)"
# - "Device registered: XXX"
# - "All modules started"
```

## Ver También

- [[Agente Bridge]]
- [[Troubleshooting]]
- [[Deploy]]
