---
tags: [isapi, referencia, api]
date: 2026-04-13
---

# Referencia ISAPI

> [!info] Resumen
> Todos los endpoints ISAPI del Hikvision DS-K1T320MFWX usados por el [[Agente Bridge]].

---

## Autenticación

- **Tipo**: Digest Auth
- **Credenciales**: `DEVICE_USERNAME` / `DEVICE_PASSWORD` en `.env`
- **Base URL**: `https://{DEVICE_IP}:{DEVICE_PORT}`

---

## Endpoints

### System

| Método | Endpoint | Función | Módulo |
|--------|----------|---------|--------|
| GET | `/ISAPI/System/deviceInfo` | Info del dispositivo | [[Endpoint - deviceInfo]] |

### Access Control - UserInfo

| Método | Endpoint | Función | Módulo |
|--------|----------|---------|--------|
| POST | `/ISAPI/AccessControl/UserInfo/Search` | Listar personas | [[Endpoint - UserInfo]] |
| POST | `/ISAPI/AccessControl/UserInfo/Record` | Registrar persona | [[Endpoint - UserInfo]] |
| PUT | `/ISAPI/AccessControl/UserInfo/Modify` | Modificar persona | [[Endpoint - UserInfo]] |
| DELETE | `/ISAPI/AccessControl/UserInfo/Delete` | Eliminar persona | [[Endpoint - UserInfo]] |

### Access Control - Events

| Método | Endpoint | Función | Módulo |
|--------|----------|---------|--------|
| POST | `/ISAPI/AccessControl/AcsEvent` | Consultar eventos | [[Endpoint - AcsEvent]] |

### Access Control - Door

| Método | Endpoint | Función | Módulo |
|--------|----------|---------|--------|
| GET | `/ISAPI/AccessControl/Door/status/1` | Estado de puerta | [[Endpoint - Door Status]] |
| PUT | `/ISAPI/AccessControl/Door/param/1` | Configurar puerta | [[Endpoint - Door Control]] |
| PUT | `/ISAPI/AccessControl/RemoteControl/door/1` | Abrir/cerrar | [[Endpoint - Door Control]] |

### Intelligent - Face Detection

| Método | Endpoint | Función | Módulo |
|--------|----------|---------|--------|
| POST | `/ISAPI/Intelligent/FDLib/FDSearch` | Buscar en librería de caras | [[Endpoint - UserInfo]] |
| POST | `/ISAPI/Intelligent/FDLib/FaceDataRecord` | Agregar foto facial | [[Endpoint - UserInfo]] |

---

## Formato de Respuesta

Todos los endpoints devuelven **XML**. Se parsea con `fast-xml-parser`.

Ejemplo deviceInfo:
```xml
<DeviceInfo>
  <serialNumber>ABC123</serialNumber>
  <model>DS-K1T320MFWX</model>
  <firmwareVersion>V2.3.1</firmwareVersion>
  <deviceName>Hikvision Device</deviceName>
</DeviceInfo>
```

---

## Ver También

- [[Agente Bridge]]
- [[Endpoint - deviceInfo]]
- [[Endpoint - UserInfo]]
- [[Endpoint - AcsEvent]]
