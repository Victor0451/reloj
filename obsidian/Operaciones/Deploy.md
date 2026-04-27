---
tags: [operaciones, deploy]
date: 2026-04-13
---

# Deploy

> [!info] Resumen
> Frontend en Vercel, agente en PM2 local.

---

## Frontend (Next.js → Vercel)

1. Conectar repo de GitHub a Vercel
2. Agregar env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Deploy automático en push a `main`

## Agente Bridge (Node.js → PM2)

```bash
cd agent
npm install --production
cp .env.example .env
# Editar .env

pm2 start npm --name "agent-bridge" -- start
pm2 save
pm2 startup
```

## Ver También

- [[Agente Bridge - Guía de Instalación]]
- [[Troubleshooting]]
