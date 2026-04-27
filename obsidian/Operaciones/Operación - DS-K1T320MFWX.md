---
tags: [operaciones, dispositivo, guia]
date: 2026-04-26
---

# Operación - DS-K1T320MFWX

> [!info] Resumen
> Guía de operación para el reloj biométrico DS-K1T320MFWX connected al sistema Reloj.

---

## Configuración Actual

| Campo | Valor |
|-------|-------|
| **Nombre en Sistema** | xd |
| **IP** | 192.168.100.60 |
| **Credenciales ISAPI** | admin / evol@2601 |
| **allow_self_signed_cert** | true (para certificado expirado) |

---

## Lo que Funciona

| Funcionalidad | Estado | Notas |
|---------------|--------|-------|
| Health Check | ✅ | Verifica conectividad |
| Sincronización de Eventos | ✅ | Eventos se guardan en Supabase |
| Ver eventos en Dashboard | ✅ | /dashboard/events |
| Ver estado del dispositivo | ✅ | /dashboard/devices |
| Gestión de usuarios via API | ❌ | Firmware no lo soporta |

---

## Gestión de Personas

Dado que el firmware no permite gestión de usuarios via ISAPI HTTP, el flujo de trabajo debe ser:

### Opción 1: Panel LCD del Reloj

1. Ir al reloj físicamente
2. Menú → Gestión de Usuarios → Agregar Persona
3. Ingresar: Nombre, ID de empleado, departamento
4. Configurar método de registro: huella, rostro o tarjeta
5. Guardar

### Opción 2: iVMS-4200

Software oficial de Hikvision para gestión remota:

1. Instalar iVMS-4200 en una PC
2. Asegurarse que la PC está en la misma red que el reloj
3. Agregar el dispositivo al software
4. Gestionar usuarios desde la interfaz gráfica
5. Las personas se sincronizan automáticamente al reloj

---

## Sincronización de Eventos

Una vez que las personas están registradas:

1. Persona registra en el reloj (huella, cara o tarjeta)
2. El reloj genera un evento
3. El **Agent** captura el evento cada 60 segundos
4. El evento aparece en **Dashboard → Eventos**

---

## Cómo Auditar Horarios

1. Ir a **Dashboard → Eventos**
2. Filtrar por:
   - **Persona** (buscar por nombre o ID)
   - **Rango de fechas** (ej: última semana)
   - **Tipo de evento** (acceso concedido, denegado, etc.)
3. Verificar que los eventos corresponden a las personas registradas
4. Exportar a Excel o PDF si es necesario

---

## Limitaciones Conocidas

1. **No se pueden crear usuarios desde la web** — El firmware del dispositivo no lo permite
2. **Personas en el reloj no aparecen automáticamente en la web** — Solo los eventos de acceso se sincronizan
3. **El operador debe crear usuarios** — Desde el LCD del reloj o iVMS-4200

---

## Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| Device offline | Agent no corriendo o red | Verificar pm2, verificar red |
| Sin eventos | No hay personas registradas | Registrar personas primero |
| "socket hang up" | Error en adapter | Regenerado con digest-fetch fix |
| 401 Unauthorized | Contraseña incorrecta | Verificar evol@2601 en BD |

---

## Ver También

- [[Dispositivo - DS-K1T320MFWX]]
- [[Agente Bridge]]
- [[Troubleshooting]]
