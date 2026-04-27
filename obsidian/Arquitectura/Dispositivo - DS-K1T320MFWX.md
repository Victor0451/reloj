---
tags: [dispositivo, hardware]
date: 2026-04-13
---

# Dispositivo - DS-K1T320MFWX

> [!info] Resumen
> Reloj biométrico Hikvision con reconocimiento facial y huella.

---

## Specs

| Campo | Valor |
|-------|-------|
| **Modelo** | DS-K1T320MFWX |
| **Marca** | Hikvision |
| **IP** | 192.168.100.60 |
| **Puerto** | 443 |
| **Protocolo** | ISAPI over HTTPS |
| **Auth** | Digest Auth |
| **Credenciales** | admin / evol@2601 |
| **Certificado** | Expirado Nov 2023 (self-signed CN=tmp_comm.cert) |

## Firmware

- **Versión**: V3.5.0 (build 221110)
- **Nota**: Firmware bloquea operaciones de gestión de usuarios via ISAPI

## Limitaciones ISAPI

> [!warning] Firmware Limitation
> El firmware V3.5.0 del DS-K1T320MFWX bloquea TODAS las operaciones de gestión de usuarios via HTTP ISAPI:

| Endpoint | Resultado |
|----------|-----------|
| `GET /ISAPI/AccessControl/UserInfo` | ❌ notSupport |
| `PUT /ISAPI/AccessControl/UserInfo/1` | ❌ notSupport |
| `POST /ISAPI/AccessControl/UserInfo/Search` | ❌ notSupport |
| `GET /ISAPI/AccessControl/CardInfo` | ❌ notSupport |
| `GET /ISAPI/AccessControl/FingerPrintCfg` | ❌ notSupport |
| `GET /ISAPI/AccessControl/Door/status/1` | ❌ notSupport |

### Lo que SÍ funciona

| Endpoint | Funcionalidad |
|----------|----------------|
| `GET /ISAPI/AccessControl/AcsEvent?format=json` | ✅ Sincronización de eventos |
| `GET /ISAPI/System/deviceInfo` | ✅ Health check |

## Gestión de Personas

Dado que ISAPI user management no funciona, las personas deben crearse por:

1. **Panel LCD del dispositivo** — Para pocas personas
2. **iVMS-4200** — Software Hikvision para gestión en batch

Ver: [[Operación - DS-K1T320MFWX]]

## Ver También

- [[Referencia ISAPI]]
- [[Agente Bridge]]
- [[Operación - DS-K1T320MFWX]]
