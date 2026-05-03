# Plan de Deployment: Reloj System

## Objetivo

Deployar el sistema completo en la nube (Vercel + Supabase) con el Agent Bridge corriendo en un VPS externo, conectando al dispositivo Hikvision via Cloudflare Tunnel.

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UBICACIÓN A (donde está el reloj)                                          │
│                                                                              │
│  ┌──────────────┐                                                           │
│  │   Hikvision  │◄── LAN ──────► cloudflared (daemon local)                 │
│  │   Device     │              expose: hikvision.tudominio.com:443         │
│  └──────────────┘                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Internet (HTTPS)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  INTERNET                                                                       │
│                                                                              │
│  ┌─────────────────────┐     ┌───────────────────┐     ┌───────────────┐   │
│  │  Cloudflare         │────►│  VPS (Agent Bridge)│────►│  Supabase     │   │
│  │  Tunnel Endpoint    │     │  (DigitalOcean)    │     │  (Cloud DB)   │   │
│  └─────────────────────┘     └───────────────────┘     └───────┬───────┘   │
│                                                                │            │
│                                                                │            │
│                                                                ▼            │
│                                                    ┌───────────────────┐   │
│                                                    │  Vercel           │   │
│                                                    │  (Next.js App)   │   │
│                                                    └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Stack Tecnológico Recomendado

| Componente | Opción Recomendada | Alternativas |
|------------|---------------------|--------------|
| **VPS (Agent)** | DigitalOcean ($4-6/mes) | Hetzner, Linode, AWS EC2 |
| **Túnel** | Cloudflare Tunnel (gratis) | Wireguard VPN, ngrok |
| **Base de datos** | Supabase (tier free) | — |
| **Frontend** | Vercel (hobby free) | — |
| **Dominio** | Cloudflare Registrar o cualquier registrador | — |
| **OS del VPS** | Ubuntu 22.04 LTS | Debian, Rocky Linux |

---

## Fases del Deployment

---

## Fase 0: Pre-requisitos (usuario)

- [ ] Crear cuenta en [DigitalOcean](https://digitalocean.com) (referral link si necesitás crédito gratis)
- [ ] Crear cuenta en [Cloudflare](https://cloudflare.com)
- [ ] Registrar un dominio (opcional pero recomendado, ~$10-15/año)
- [ ] Verificar que el Hikvision tiene IP fija o configuración DHCP con reserva de IP

---

## Fase 1: VPS — Configuración Inicial

### 1.1 Crear droplet en DigitalOcean

```
Plan: Basic
Variant: Regular (no SSDs especiales)
OS: Ubuntu 22.04 LTS
Size: $4-6/mes (1 vCPU, 1GB RAM suficiente para el agent)
Region: Elegir la más cercana a Ubicación A
Authentication: SSH key (recomendado) o password
```

### 1.2 Configuración básica del VPS

```bash
# Conectar al VPS
ssh root@tu-vps-ip

# Actualizar sistema
apt update && apt upgrade -y

# Crear usuario para el agent (no correr como root)
adduser reloj
usermod -aG sudo reloj

# Configurar firewall básico
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (para cloudflare tunnel)
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 1.3 Instalar dependencias

```bash
# Como usuario reloj
sudo apt install -y curl git

# Instalar Node.js 20.x (el agent usa TypeScript/Node)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # debe ser v20.x
npm --version

# Instalar PM2 (gestor de procesos, mantiene el agent corriendo)
sudo npm install -g pm2
```

---

## Fase 2: Cloudflare Tunnel

### 2.1 Configurar Cloudflare en el VPS

```bash
# Instalar cloudflared (en el VPS)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Verificar
cloudflared --version
```

### 2.2 Crear tunnel en Cloudflare Dashboard

1. Ir a [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Seleccionar el dominio (o agregar uno nuevo)
3. Ir a **Zero Trust** → **Networks** → **Tunnels**
4. Crear un tunnel nuevo:
   - Name: `reloj-tunnel`
   - Type: `Cloudflared` (esta es la opción que corre local pero para el agent...)
5. **OJO ACÁ**: En esta arquitectura el tunnel corre en UBICACIÓN A (donde está el Hikvision), NO en el VPS. El tunnel expone el dispositivo local hacia internet.

### 2.3 Configurar cloudflared en Ubicación A (máquina local)

> El daemon de cloudflared debe correr en una máquina en la RED LOCAL del Hikvision.

```bash
# En la máquina de Ubicación A (puede ser una PC vieja, Raspberry, etc.)
# No necesita ser el VPS, puede ser cualquier máquina en esa red

# Instalar cloudflared
curl -L https://github.com/cloudflare/cloudflare-warp/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Autenticar el tunnel
cloudflared tunnel login

# Crear el tunnel
cloudflared tunnel create reloj-tunnel

# Guardar el token que te da (lo necesitás para el siguiente paso)
```

### 2.4 Configurar el tunnel para el Hikvision

```bash
# En la máquina local, crear archivo de configuración
# Esto expone el Hikvision (asumiendo IP 192.168.1.175:443)

cloudflared tunnel run --token TU_TOKEN_AQUI \
  --loglevel debug \
  --transport-loglevel debug \
  --address 0.0.0.0

# En Cloudflare Dashboard, configurar la ruta pública:
# Subdomain: hikvision
# Domain: tudominio.com
# Type: HTTPS
# URL: localhost:8443 (el cloudflared escuchará localmente y reenviará al Hikvision)
```

### 2.5 Verificar conectividad

```bash
# Desde cualquier lado, probar:
curl -k https://hikvision.tudominio.com

# Debe responder si el tunnel está corriendo y el Hikvision está accesible
```

**NOTA**: Para que el agent en el VPS se conecte al Hikvision via el tunnel,我们需要 crear un DNS interno o usar el dominio público. El agent se conectará a `https://hikvision.tudominio.com` — Cloudflare resolverá esto y reenviará al daemon local.

---

## Fase 3: Agent Bridge — Deployment

### 3.1 Clonar el proyecto en el VPS

```bash
# En el VPS, como usuario reloj
cd ~
git clone https://github.com/TU_USERNAME/reloj.git
cd reloj
```

### 3.2 Configurar variables de entorno

```bash
# Copiar template y configurar
cp agent/.env-old agent/.env

# Editar con los valores correspondientes
nano agent/.env
```

```env
# Supabase (los mismos que usa el frontend)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key

# El dispositivo Hikvision se accede via el tunnel DNS
DEVICE_IP=hikvision.tudominio.com
DEVICE_PORT=443

# Credenciales del dispositivo
DEVICE_USERNAME=admin
DEVICE_PASSWORD=password-del-dispositivo

# Intervals (milliseconds)
POLL_INTERVAL_MS=30000
HEARTBEAT_INTERVAL_MS=60000
LOG_LEVEL=info
```

### 3.3 Instalar dependencias y build

```bash
cd agent
npm install

# Verificar que compila
npm run typecheck

# Build de producción
npm run build  # o lo que tenga el script
```

### 3.4 Configurar PM2 para mantenerlo corriendo

```bash
# Crear archivo de configuración PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'agent-bridge',
    script: 'tsx',
    args: 'src/index.ts',
    cwd: '/home/reloj/reloj/agent',
    env: {
      NODE_ENV: 'production',
    },
    exp_backoff_restart_delay: 100,
    max_restarts: 10,
    watch: false,
    autorestart: true,
  }],
};
EOF

# Arrancar con PM2
pm2 start ecosystem.config.js

# Guardar configuración para reinicios automáticos
pm2 save

# Configurar startup script (en caso de reinicio del VPS)
pm2 startup
```

### 3.5 Monitoreo básico

```bash
# Ver logs en tiempo real
pm2 logs agent-bridge

# Ver status
pm2 status

# Restart si se cae
pm2 restart agent-bridge
```

---

## Fase 4: Vercel — Deployar Frontend

### 4.1 Preparar el proyecto

```bash
# En tu máquina local (no en VPS)
cd reloj

# Verificar que todo compila
npm run build

# Hacer push al repo (GitHub/GitLab)
git push origin main
```

### 4.2 Deployar a Vercel

1. Ir a [vercel.com](https://vercel.com)
2. "New Project"
3. Importar desde GitHub (repositorio reloj)
4. Configuration:
   - Framework: Next.js
   - Root Directory: `.` (no agent/)
   - Environment Variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `CRON_AUTH_TOKEN`
5. Deploy!

### 4.3 Configurar dominio personalizado (opcional)

En Vercel Dashboard → Settings → Domains → agregar tu dominio.

---

## Fase 5: Supabase — Configuración

### 5.1 Verificar migraciones

```bash
# En tu máquina local
cd reloj/supabase

# Aplicar migraciones (si no están aplicadas)
supabase db push

# O desde el dashboard de Supabase, ir a SQL Editor y ejecutar los archivos en orden
```

### 5.2 Configurar auth (si no está)

- En Supabase Dashboard → Authentication → Settings
- Configurar site URL: `https://tu-dominio.vercel.app`
- Redirigir URLs post-auth si es necesario

---

## Fase 6: Configuración de Dominio y DNS

### 6.1 Configurar DNS en Cloudflare

```
# A registros (para el frontend)
@    A    76.76.21.21   (Vercel Anycast)
www  A    76.76.21.21

# CNAME para el tunnel del Hikvision
hikvision CNAME TU_TUNNEL_ID.cfargotunnel.com
```

### 6.2 SSL/TLS

En Cloudflare Dashboard → SSL/TLS:
- Mode: "Full" o "Flexible" (Full si tenés certificado en el tunnel)
- Edge Certificate: habilitar "Always Use HTTPS"

---

## Checklist Final

```
Pre-deployment:
  □ Cuenta DigitalOcean creada
  □ Cuenta Cloudflare creada
  □ Dominio registrado (opcional)
  □ Acceso SSH al VPS configurado
  □ Credenciales Hikvision verified

VPS Setup:
  □ Droplet creado (Ubuntu 22.04)
  □ Usuario 'reloj' creado
  □ Firewall configurado
  □ Node.js 20.x instalado
  □ PM2 instalado

Cloudflare Tunnel:
  □ Tunnel creado en Cloudflare Dashboard
  □ cloudflared instalado en Ubicación A (máquina local)
  □ Tunnel configurado y corriendo
  □ DNS configurado para hikvision.tudominio.com
  □ SSL verificado (curl -k https://hikvision.tudominio.com)

Agent Bridge:
  □ Proyecto clonado en VPS
  □ .env configurado con DEVICE_IP=hikvision.tudominio.com
  □ Dependencias instaladas
  □ TypeScript compila sin errores
  □ PM2 configurado y agent corriendo
  □ Logs verificables (pm2 logs)

Vercel Frontend:
  □ Repo empujado a GitHub
  □ Proyecto importado en Vercel
  □ Variables de entorno configuradas
  □ Deploy exitoso
  □ Dominio configurado (opcional)

Supabase:
  □ Proyecto creado
  □ Migraciones aplicadas
  □ Auth configurado
  □ RLS policies verificadas

Verification:
  □ https://tu-dominio.com muestra la app
  □ Login funciona
  □ Agent está escribiendo eventos en la DB
  □ Dashboard muestra dispositivos y eventos
```

---

## Comandos de Mantenimiento

```bash
# En VPS — Ver logs del agent
pm2 logs agent-bridge --lines 100

# En VPS — Restart agent
pm2 restart agent-bridge

# En VPS — Monitoreo de recursos
htop
pm2 monit

# En Ubicación A — Status del tunnel
cloudflared tunnel list
cloudflared tunnel info TU_TUNNEL_ID

# Ver eventos en Supabase (desde tu máquina)
# Ir al dashboard de Supabase → Table Editor → access_events
```

---

## Troubleshooting Común

| Problema | Solución |
|----------|----------|
| Agent no conecta al Hikvision | Verificar que el tunnel esté corriendo y DNS resuelva |
| PM2 agent se reinicia constantemente | `pm2 logs` para ver el error; usualmente config mal |
| Tunnel no levanta | Verificar token, ejecutar `cloudflared tunnel run` con `--debug` |
| Vercel deploy falla | Revisar logs en Vercel dashboard; verificar variables de entorno |
| Supabase auth no funciona | Verificar site URL y redirect URLs en dashboard |

---

## Costos Mensuales Estimados

| Servicio | Costo |
|----------|-------|
| DigitalOcean VPS ($4-6 droplet) | ~$5-6 |
| Dominio (opcional, .com ~$10/año) | ~$0.83 |
| Cloudflare (tier free) | $0 |
| Supabase (tier free) | $0 |
| Vercel (hobby) | $0 |
| **Total** | **~$5-7/mes** |

---

## Notas Importantes

1. **El tunnel corre en Ubicación A**, no en el VPS. El cloudflared daemon debe estar en la red local del Hikvision para exponerlo.

2. **Para mayor seguridad**: considerar agregar autenticación al tunnel en Cloudflare (Access policy).

3. **Backup del agent**: el código está en Git, pero las credenciales (.env) solo están en el VPS. Considerar usar un secrets manager.

4. **Actualizaciones**: cuando haya cambios en el código, hacer `git pull` en el VPS y `pm2 restart agent-bridge`.

---

*Documento creado como parte del plan de deployment del proyecto Reloj.*
*Fecha: 2026-05-02*