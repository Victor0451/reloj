# Acceso remoto a reloj Hikvision (Guía completa)

## 🎯 Objetivo

Permitir que tu sistema (Next.js u otros) se conecte al reloj desde fuera de la red local, evaluando todas las opciones posibles:

- Desde la más simple ⚠️
- Hasta la más profesional 🚀

---

# 🔴 1. Port Forwarding (la menos recomendada)

## 📌 Qué es

Abrís un puerto en tu router para exponer el reloj directamente a internet.

Internet → Router → Reloj (192.168.100.60)

## ⚙️ Configuración

En el router:

Puerto externo: 8080  
IP interna: 192.168.100.60  
Puerto interno: 80  
Protocolo: TCP  

Acceso:

http://TU_IP_PUBLICA:8080

## ✅ Ventajas

- Fácil y rápido
- No requiere infraestructura extra
- Funciona inmediatamente

## ❌ Desventajas

- Muy inseguro
- Bots escanean puertos
- Hikvision es target frecuente
- Posibles vulnerabilidades firmware

## 🧠 Cuándo usarlo

Solo para pruebas temporales

---

# 🟡 2. Reverse Proxy (nivel intermedio)

## 📌 Qué es

Servidor intermedio:

Internet → Nginx → Reloj

## ✅ Ventajas

- HTTPS
- Autenticación extra
- Logs y control

## ❌ Desventajas

- Requiere configuración
- Sigue siendo acceso público

---

# 🟢 3. VPN (RECOMENDADO)

## 📌 Qué es

Cliente remoto → VPN → red local → reloj

## Opciones

- WireGuard
- OpenVPN
- Tailscale (recomendado)

## ✅ Ventajas

- Muy seguro
- No exponés el reloj
- Acceso como red local

## ❌ Desventajas

- Setup inicial

---

# 🟣 4. Agent local (PRO)

## 📌 Qué es

Reloj → Agent local → Backend cloud

## Flujo

1. Usuario ficha
2. Agent consulta reloj
3. Envía a backend
4. Next.js guarda datos

## ✅ Ventajas

- Seguro
- Escalable
- Ideal SaaS

## ❌ Desventajas

- Desarrollo extra

---

# 🔵 5. ISUP (enterprise)

## 📌 Qué es

Reloj envía datos directamente al servidor

ISAPI = pull  
ISUP = push  

## ✅ Ventajas

- Tiempo real
- Escalable

## ❌ Desventajas

- Complejo
- No REST

---

# 🏁 Comparación

| Opción | Seguridad | Complejidad | Recomendación |
|-------|----------|------------|--------------|
| Port Forwarding | Baja | Baja | No usar |
| Reverse Proxy | Media | Media | Opcional |
| VPN | Alta | Media | Recomendada |
| Agent | Alta | Media | Ideal |
| ISUP | Muy alta | Alta | Enterprise |

---

# 🎯 Recomendación

## MVP

Next.js local + VPN

## Escalable

Agent + backend cloud

---

# 💡 Resumen

NO expongas el reloj directo  
Usá VPN  
Pensá en agent si crece
