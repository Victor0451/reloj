# Arquitectura Multi-Marca - RELOJ

> **Diseño del sistema de adaptadores para soporte agnóstico de dispositivos biométricos**

---

## 🎯 Principio Fundamental

**El código core del sistema NO debe conocer las particularidades de ninguna marca.**

Cada dispositivo (Hikvision, ZKTeco, Suprema, Dahua) tiene su propia:
- API y protocolos de comunicación
- Formato de datos
- Autenticación
- Eventos y estados

La solución: **Adapter Pattern**

---

## 🏗️ Arquitectura de Adaptadores

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Next.js)                     │
│         Supabase Realtime ←→ Dashboard + Controles          │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ REST API / Realtime
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                    │
│    devices │ sync_logs │ events │ persons │ door_status    │
└─────────────────────────────────────────────────────────────┘
                              ↑
                              │ Query / Subscribe
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     AGENT BRIDGE (Node.js)                  │
│                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌──────────┐ │
│  │ Sync Loops  │───→│  AdapterManager   │───→│ Adapters │ │
│  │             │    │    (Factory)      │    │          │ │
│  └─────────────┘    └──────────────────┘    └──────────┘ │
│                           ↑                   │           │
│                     createAdapter(brand)     │           │
└───────────────────────────────────────────────┼───────────┘
                                                ↓
                              ┌─────────────────────────────┐
                              │      DISPOSITIVOS           │
                              │  ┌─────┐ ┌─────┐ ┌─────┐   │
                              │  │Hik- │ │ZKT- │ │Sup- │   │
                              │  │vis- │ │eco  │ │rema │   │
                              │  │ion  │ │     │ │     │   │
                              │  └─────┘ └─────┘ └─────┘   │
                              └─────────────────────────────┘
```

---

## 📐 Interfaz Común: `IDeviceAdapter`

```typescript
// agent/src/core/interfaces.ts

export interface IDeviceAdapter {
  // Identificación
  readonly brand: string;
  readonly model: string;
  
  // Configuración de conexión
  getApiBaseUrl(): string;
  getAuthHeaders(): Record<string, string>;
  
  // Device Info
  getDeviceInfo(): Promise<DeviceInfo>;
  
  // Door/Door Status
  getDoorStatus(): Promise<DoorStatus>;
  lockDoor(doorId: string): Promise<void>;
  unlockDoor(doorId: string): Promise<void>;
  
  // Personas
  getPersons(params?: PersonQueryParams): Promise<Person[]>;
  getPersonById(personId: string): Promise<Person | null>;
  createPerson(person: CreatePersonInput): Promise<string>; // returns personId
  updatePerson(personId: string, person: UpdatePersonInput): Promise<void>;
  deletePerson(personId: string): Promise<void>;
  
  // Eventos
  getEvents(params?: EventQueryParams): Promise<DeviceEvent[]>;
  getUnreadEventCount(): Promise<number>;
  markEventsAsRead(eventIds: string[]): Promise<void>;
  
  // Salud del dispositivo
  ping(): Promise<boolean>;
  getFingerprint(): Promise<string>; // Para verificar sync
}
```

---

## 🏭 AdapterManager (Factory)

```typescript
// agent/src/core/adapter-manager.ts

import { IDeviceAdapter } from './interfaces';

class AdapterManager {
  private adapters = new Map<string, new (config: DeviceConfig) => IDeviceAdapter>();
  
  registerAdapter(brand: string, adapterClass: new (config: DeviceConfig) => IDeviceAdapter): void {
    this.adapters.set(brand.toLowerCase(), adapterClass);
  }
  
  createAdapter(config: DeviceConfig): IDeviceAdapter {
    const adapterClass = this.adapters.get(config.brand.toLowerCase());
    if (!adapterClass) {
      throw new Error(`Adapter no encontrado para brand: ${config.brand}`);
    }
    return new adapterClass(config);
  }
  
  getSupportedBrands(): string[] {
    return Array.from(this.adapters.keys());
  }
}

export const adapterManager = new AdapterManager();
```

---

## 🔌 Implementación: HikvisionAdapter

```typescript
// agent/src/adapters/hikvision.adapter.ts

import { IDeviceAdapter, DeviceConfig, Person, DeviceEvent } from '../core/interfaces';
import { DigestAuthClient } from '../isapi/client';

export class HikvisionAdapter implements IDeviceAdapter {
  readonly brand = 'hikvision';
  
  private client: DigestAuthClient;
  private baseUrl: string;
  
  constructor(private config: DeviceConfig) {
    this.baseUrl = `http://${config.ip}`;
    this.client = new DigestAuthClient({
      host: config.ip,
      username: config.username,
      password: config.password
    });
  }
  
  async getDeviceInfo(): Promise<DeviceInfo> {
    const response = await this.client.get('/ISAPI/System/deviceInfo');
    // Parsear XML de respuesta Hikvision
    return parseHikvisionDeviceInfo(response);
  }
  
  async lockDoor(doorId: string): Promise<void> {
    // ISAPI endpoint específico de Hikvision
    await this.client.put(`/ISAPI/AccessControl/RemoteControl/door/${doorId}`, {
      cmd: 'lock'
    });
  }
  
  // ... más implementaciones específicas de Hikvision
}
```

---

## 🔄 Sync Loops Refactorizados

Los sync loops ahora usan el `AdapterManager` en lugar de硬编码:

```typescript
// agent/src/sync/heartbeat-loop.ts

export async function startHeartbeatLoop(supabase: SupabaseClient) {
  const devices = await fetchDevices(supabase);
  
  for (const device of devices) {
    const adapter = adapterManager.createAdapter(device);
    
    try {
      const isAlive = await adapter.ping();
      const fingerprint = await adapter.getFingerprint();
      
      await supabase.from('devices').update({
        is_online: isAlive,
        last_seen: new Date().toISOString(),
        sync_fingerprint: fingerprint
      }).eq('id', device.id);
      
    } catch (error) {
      console.error(`Error en heartbeat para ${device.name}:`, error);
    }
  }
}
```

---

## 📊 Beneficios de Esta Arquitectura

| Aspecto | Antes (Hardcoded) | Después (Adaptadores) |
|---------|-------------------|----------------------|
| **Agregar nueva marca** | Modificar TODO el código | Crear nuevo archivo adapter |
| **Testing** | Mockear toda la lógica | Mockear solo el adapter |
| **Mantenimiento** | Cambios arriesgados | Cambios aislados por marca |
| **Escalabilidad** | Límite práctico ~3 marcas | Ilimitado |

---

## 📝 Registro de Adaptadores

```typescript
// agent/src/index.ts

import { adapterManager } from './core/adapter-manager';
import { HikvisionAdapter } from './adapters/hikvision.adapter';
import { ZKTecoAdapter } from './adapters/zkteco.adapter';
import { SupremaAdapter } from './adapters/suprema.adapter';

// Registrar adaptadores disponibles
adapterManager.registerAdapter('hikvision', HikvisionAdapter);
adapterManager.registerAdapter('zkteco', ZKTecoAdapter);
adapterManager.registerAdapter('suprema', SupremaAdapter);
adapterManager.registerAdapter('dahua', DahuaAdapter);
```

---

## 🔮 Próximos Pasos

1. ✅ **HikvisionAdapter** - Implementado y funcionando
2. ⬜ **ZKTecoAdapter** - Para dispositivos ZKTeco (SF400, C3-400)
3. ⬜ **SupremaAdapter** - Para dispositivos BioEntry
4. ⬜ **DahuaAdapter** - Para dispositivos Dahua

---

## 🔗 Referencias

- [[../Módulos/Agente Bridge]]
- [[../Desarrollo/Conectividad/Arquitectura del Sistema de Conectividad]]
- [[../Desarrollo/Conectividad/API y Endpoints]]
