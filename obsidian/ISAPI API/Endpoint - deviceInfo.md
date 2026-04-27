---
tags: [isapi, endpoint]
date: 2026-04-13
---

# Endpoint - deviceInfo

> [!info] Resumen
> Obtiene información del dispositivo Hikvision.

---

## Request

```
GET /ISAPI/System/deviceInfo
```

## Response (XML)

```xml
<DeviceInfo>
  <serialNumber>ABC123</serialNumber>
  <model>DS-K1T320MFWX</model>
  <firmwareVersion>V2.3.1</firmwareVersion>
  <deviceName>Hikvision Device</deviceName>
</DeviceInfo>
```

## Uso

- **Heartbeat**: cada 60s para verificar conectividad
- **Registro**: al iniciar el agente para poblar `devices`

## Ver También

- [[Agente Bridge]]
- [[Referencia ISAPI]]
