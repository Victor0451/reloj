# Implementación de Gestión API para Reloj Hikvision DS-K1T320 con Next.js

## 1. Objetivo

Este documento describe cómo implementar la gestión del reloj Hikvision DS-K1T320 desde un proyecto **Next.js**, usando la API HTTP/ISAPI del dispositivo.

Cubre:

- Conexión HTTP con autenticación Digest.
- Lectura de información del reloj.
- Configuración de hora y zona horaria.
- Alta, búsqueda y modificación de usuarios.
- Asignación de tarjetas.
- Lectura de eventos.
- Identificación de eventos válidos de asistencia.
- Sincronización periódica con base de datos.
- Recomendaciones para producción.

Flujo validado con `curl`:

```txt
IP del reloj: 192.168.100.60
Autenticación: Digest Auth
Formato usuarios/eventos: JSON
Formato hora: XML
```

---

## 2. Arquitectura recomendada

El reloj debe tratarse como un **dispositivo periférico**. El sistema Next.js debe ser el sistema principal.

```txt
[ Reloj Hikvision ]
        |
        | ISAPI / HTTP Digest
        |
[ Backend Next.js ]
        |
        | Prisma / Drizzle / SQL
        |
[ Base de datos ]
        |
        |
[ Panel web ]
```

El navegador nunca debería comunicarse directo con el reloj.

Correcto:

```txt
Browser → Next.js API Route → Reloj Hikvision
```

Incorrecto:

```txt
Browser → Reloj Hikvision
```

Motivos:

- CORS.
- Credenciales expuestas.
- Red local inaccesible desde browser externo.
- Digest Auth.
- Seguridad.

---

## 3. Requisitos del entorno

El backend Next.js debe poder alcanzar la IP del reloj.

Ejemplo:

```txt
Servidor Next.js: 192.168.100.23
Reloj Hikvision: 192.168.100.60
```

Si el reloj está en red local `192.168.x.x`, un deployment en Vercel no podrá acceder directamente.

Opciones válidas:

- Ejecutar Next.js en servidor local.
- Usar VPN.
- Usar un worker local.
- Exponer un servicio intermedio seguro.
- Evaluar ISUP en una etapa avanzada.

---

## 4. Instalación de Digest Auth

El reloj usa **Digest Authentication**. El `fetch` nativo de Node/Next.js no replica automáticamente el handshake Digest.

Instalar:

```bash
npm install digest-fetch
```

---

## 5. Variables de entorno

Archivo `.env`:

```env
HIKVISION_HOST=192.168.100.60
HIKVISION_PORT=80
HIKVISION_USERNAME=admin
HIKVISION_PASSWORD=evol@2601
HIKVISION_PROTOCOL=http
```

En producción, no guardar passwords en texto plano dentro de la base de datos sin cifrado.

---

## 6. Cliente base Hikvision

Crear:

```txt
src/lib/hikvision/client.ts
```

```ts
import DigestFetch from "digest-fetch";

export type HikvisionClientConfig = {
  host: string;
  port?: number;
  username: string;
  password: string;
  protocol?: "http" | "https";
};

export class HikvisionClient {
  private client: DigestFetch;
  private baseUrl: string;

  constructor(config: HikvisionClientConfig) {
    const protocol = config.protocol ?? "http";
    const port = config.port ?? 80;

    this.client = new DigestFetch(config.username, config.password);
    this.baseUrl = `${protocol}://${config.host}:${port}`;
  }

  async requestText(path: string, options: RequestInit = {}) {
    const response = await this.client.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Accept: "application/json, application/xml, text/plain, */*",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Hikvision HTTP ${response.status}: ${text}`);
    }

    return text;
  }

  async requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const text = await this.requestText(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    return JSON.parse(text) as T;
  }

  async requestXml(path: string, options: RequestInit = {}) {
    return this.requestText(path, {
      ...options,
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml",
        ...(options.headers || {}),
      },
    });
  }
}
```

---

## 7. Factory del cliente

Crear:

```txt
src/lib/hikvision/create-client.ts
```

```ts
import { HikvisionClient } from "./client";

export function createHikvisionClient() {
  const host = process.env.HIKVISION_HOST;
  const username = process.env.HIKVISION_USERNAME;
  const password = process.env.HIKVISION_PASSWORD;

  if (!host || !username || !password) {
    throw new Error("Missing Hikvision environment variables");
  }

  return new HikvisionClient({
    host,
    username,
    password,
    port: Number(process.env.HIKVISION_PORT ?? 80),
    protocol: (process.env.HIKVISION_PROTOCOL as "http" | "https") ?? "http",
  });
}
```

---

## 8. Probar conexión

Endpoint validado:

```txt
GET /ISAPI/System/deviceInfo
```

Servicio:

```txt
src/lib/hikvision/system.ts
```

```ts
import { HikvisionClient } from "./client";

export async function getDeviceInfo(client: HikvisionClient) {
  return client.requestXml("/ISAPI/System/deviceInfo", {
    method: "GET",
  });
}
```

API Route:

```txt
src/app/api/hikvision/test/route.ts
```

```ts
import { NextResponse } from "next/server";
import { createHikvisionClient } from "@/lib/hikvision/create-client";
import { getDeviceInfo } from "@/lib/hikvision/system";

export const runtime = "nodejs";

export async function GET() {
  try {
    const client = createHikvisionClient();
    const xml = await getDeviceInfo(client);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

---

## 9. Gestión de hora del reloj

### 9.1 Leer hora actual

Endpoint:

```txt
GET /ISAPI/System/time
```

Curl validado:

```bash
curl --digest -u 'admin:evol@2601' \
"http://192.168.100.60/ISAPI/System/time"
```

Respuesta correcta para Argentina:

```xml
<Time>
  <timeMode>manual</timeMode>
  <localTime>2026-04-26T21:50:57-03:00</localTime>
  <timeZone>CST+3:00:00</timeZone>
</Time>
```

Importante: en Hikvision, para Argentina UTC-3 se usa:

```txt
CST+3:00:00
```

Aunque parezca invertido, fue validado contra el dispositivo.

### 9.2 Actualizar hora manual

Curl validado:

```bash
curl --digest -u 'admin:evol@2601' \
-X PUT \
-H "Content-Type: application/xml" \
-d '<?xml version="1.0" encoding="UTF-8"?>
<Time>
  <timeMode>manual</timeMode>
  <localTime>2026-04-26T21:57:00-03:00</localTime>
  <timeZone>CST+3:00:00</timeZone>
</Time>' \
"http://192.168.100.60/ISAPI/System/time"
```

Servicio Next.js:

```ts
import { HikvisionClient } from "./client";

export async function getDeviceTime(client: HikvisionClient) {
  return client.requestXml("/ISAPI/System/time", {
    method: "GET",
  });
}

export async function setDeviceTimeManual(
  client: HikvisionClient,
  localTime: string
) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Time>
  <timeMode>manual</timeMode>
  <localTime>${localTime}</localTime>
  <timeZone>CST+3:00:00</timeZone>
</Time>`;

  return client.requestXml("/ISAPI/System/time", {
    method: "PUT",
    body: xml,
  });
}
```

Ejemplo de `localTime`:

```txt
2026-04-26T21:57:00-03:00
```

---

## 10. Crear usuario

Endpoint validado:

```txt
POST /ISAPI/AccessControl/UserInfo/Record?format=json
```

Curl validado:

```bash
curl --digest -u 'admin:evol@2601' \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "UserInfo": {
    "employeeNo": "123",
    "name": "Juan Perez",
    "userType": "normal",
    "Valid": {
      "enable": true,
      "beginTime": "2024-01-01T00:00:00",
      "endTime": "2030-12-31T23:59:59"
    },
    "doorRight": "1",
    "RightPlan": [
      {
        "doorNo": 1,
        "planTemplateNo": "1"
      }
    ]
  }
}' \
"http://192.168.100.60/ISAPI/AccessControl/UserInfo/Record?format=json"
```

Respuesta validada:

```json
{
  "statusCode": 1,
  "statusString": "OK",
  "subStatusCode": "ok"
}
```

Servicio Next.js:

```ts
import { HikvisionClient } from "./client";

export type CreateHikvisionUserInput = {
  employeeNo: string;
  name: string;
  beginTime?: string;
  endTime?: string;
  doorNo?: number;
  planTemplateNo?: string;
};

export async function createUser(
  client: HikvisionClient,
  input: CreateHikvisionUserInput
) {
  const doorNo = input.doorNo ?? 1;
  const planTemplateNo = input.planTemplateNo ?? "1";

  return client.requestJson("/ISAPI/AccessControl/UserInfo/Record?format=json", {
    method: "POST",
    body: JSON.stringify({
      UserInfo: {
        employeeNo: input.employeeNo,
        name: input.name,
        userType: "normal",
        Valid: {
          enable: true,
          beginTime: input.beginTime ?? "2024-01-01T00:00:00",
          endTime: input.endTime ?? "2030-12-31T23:59:59",
        },
        doorRight: String(doorNo),
        RightPlan: [
          {
            doorNo,
            planTemplateNo,
          },
        ],
      },
    }),
  });
}
```

---

## 11. Buscar usuario

Endpoint validado:

```txt
POST /ISAPI/AccessControl/UserInfo/Search?format=json
```

Curl validado:

```bash
curl --digest -u 'admin:evol@2601' \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "UserInfoSearchCond": {
    "searchID": "1",
    "searchResultPosition": 0,
    "maxResults": 10,
    "EmployeeNoList": [
      {
        "employeeNo": "123"
      }
    ]
  }
}' \
"http://192.168.100.60/ISAPI/AccessControl/UserInfo/Search?format=json"
```

Respuesta ejemplo:

```json
{
  "UserInfoSearch": {
    "searchID": "1",
    "responseStatusStrg": "OK",
    "numOfMatches": 1,
    "totalMatches": 1,
    "UserInfo": [
      {
        "employeeNo": "123",
        "name": "Juan Perez",
        "userType": "normal",
        "Valid": {
          "enable": true,
          "beginTime": "2024-01-01T00:00:00",
          "endTime": "2030-12-31T23:59:59",
          "timeType": "local"
        },
        "doorRight": "1",
        "RightPlan": [
          {
            "doorNo": 1,
            "planTemplateNo": "1"
          }
        ],
        "numOfCard": 0,
        "numOfFP": 0,
        "numOfFace": 0
      }
    ]
  }
}
```

Servicio Next.js:

```ts
export async function searchUserByEmployeeNo(
  client: HikvisionClient,
  employeeNo: string
) {
  return client.requestJson("/ISAPI/AccessControl/UserInfo/Search?format=json", {
    method: "POST",
    body: JSON.stringify({
      UserInfoSearchCond: {
        searchID: crypto.randomUUID(),
        searchResultPosition: 0,
        maxResults: 10,
        EmployeeNoList: [
          {
            employeeNo,
          },
        ],
      },
    }),
  });
}
```

---

## 12. Modificar usuario

Endpoint:

```txt
PUT /ISAPI/AccessControl/UserInfo/Modify?format=json
```

Ejemplo:

```bash
curl --digest -u 'admin:evol@2601' \
-X PUT \
-H "Content-Type: application/json" \
-d '{
  "UserInfo": {
    "employeeNo": "123",
    "name": "Juan Perez",
    "userType": "normal",
    "Valid": {
      "enable": true,
      "beginTime": "2024-01-01T00:00:00",
      "endTime": "2030-12-31T23:59:59"
    },
    "doorRight": "1",
    "RightPlan": [
      {
        "doorNo": 1,
        "planTemplateNo": "1"
      }
    ]
  }
}' \
"http://192.168.100.60/ISAPI/AccessControl/UserInfo/Modify?format=json"
```

Servicio:

```ts
export async function updateUser(
  client: HikvisionClient,
  input: CreateHikvisionUserInput
) {
  const doorNo = input.doorNo ?? 1;
  const planTemplateNo = input.planTemplateNo ?? "1";

  return client.requestJson("/ISAPI/AccessControl/UserInfo/Modify?format=json", {
    method: "PUT",
    body: JSON.stringify({
      UserInfo: {
        employeeNo: input.employeeNo,
        name: input.name,
        userType: "normal",
        Valid: {
          enable: true,
          beginTime: input.beginTime ?? "2024-01-01T00:00:00",
          endTime: input.endTime ?? "2030-12-31T23:59:59",
        },
        doorRight: String(doorNo),
        RightPlan: [
          {
            doorNo,
            planTemplateNo,
          },
        ],
      },
    }),
  });
}
```

---

## 13. Asignar tarjeta a usuario

Endpoint validado:

```txt
POST /ISAPI/AccessControl/CardInfo/Record?format=json
```

Curl validado:

```bash
curl --digest -u 'admin:evol@2601' \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "CardInfo": {
    "employeeNo": "123",
    "cardNo": "0001234567",
    "cardType": "normalCard"
  }
}' \
"http://192.168.100.60/ISAPI/AccessControl/CardInfo/Record?format=json"
```

Respuesta validada:

```json
{
  "statusCode": 1,
  "statusString": "OK",
  "subStatusCode": "ok"
}
```

Servicio:

```ts
export async function assignCardToUser(
  client: HikvisionClient,
  input: {
    employeeNo: string;
    cardNo: string;
  }
) {
  return client.requestJson("/ISAPI/AccessControl/CardInfo/Record?format=json", {
    method: "POST",
    body: JSON.stringify({
      CardInfo: {
        employeeNo: input.employeeNo,
        cardNo: input.cardNo,
        cardType: "normalCard",
      },
    }),
  });
}
```

Después de asignar tarjeta, al buscar usuario debería aparecer:

```txt
numOfCard: 1
```

---

## 14. Lectura de eventos

Endpoint validado:

```txt
POST /ISAPI/AccessControl/AcsEvent?format=json
```

### 14.1 Body correcto

El dispositivo requiere:

- `searchID`
- `searchResultPosition`
- `maxResults`
- `major`
- `minor`
- `startTime`
- `endTime`

Ejemplo validado:

```bash
curl --digest -u 'admin:evol@2601' \
-X POST \
-H "Content-Type: application/json" \
-d '{
  "AcsEventCond": {
    "searchID": "9",
    "searchResultPosition": 0,
    "maxResults": 20,
    "major": 5,
    "minor": 38,
    "startTime": "2026-04-26T21:55:00-03:00",
    "endTime": "2026-04-26T23:59:59-03:00"
  }
}' \
"http://192.168.100.60/ISAPI/AccessControl/AcsEvent?format=json"
```

Respuesta validada para check-out:

```json
{
  "AcsEvent": {
    "searchID": "9",
    "totalMatches": 1,
    "responseStatusStrg": "OK",
    "numOfMatches": 1,
    "InfoList": [
      {
        "major": 5,
        "minor": 38,
        "time": "2026-04-26T21:57:44-03:00",
        "cardType": 1,
        "name": "vic",
        "cardReaderNo": 1,
        "doorNo": 1,
        "employeeNoString": "2",
        "type": 0,
        "serialNo": 187,
        "userType": "normal",
        "currentVerifyMode": "cardOrFaceOrFp",
        "attendanceStatus": "checkOut",
        "label": "Check Out",
        "mask": "unknown"
      }
    ]
  }
}
```

### 14.2 Servicio Next.js

```ts
export type HikvisionAcsEvent = {
  major: number;
  minor: number;
  time: string;
  name?: string;
  employeeNoString?: string;
  doorNo?: number;
  serialNo: number;
  currentVerifyMode?: string;
  attendanceStatus?: "checkIn" | "checkOut" | string;
  label?: string;
  cardReaderNo?: number;
  cardType?: number;
  userType?: string;
  mask?: string;
};

export type AcsEventResponse = {
  AcsEvent: {
    searchID: string;
    totalMatches: number;
    responseStatusStrg: "OK" | "MORE" | "NO MATCH" | string;
    numOfMatches: number;
    InfoList?: HikvisionAcsEvent[];
  };
};

export async function searchAttendanceEvents(
  client: HikvisionClient,
  input: {
    startTime: string;
    endTime: string;
    position?: number;
    maxResults?: number;
  }
): Promise<AcsEventResponse> {
  return client.requestJson<AcsEventResponse>(
    "/ISAPI/AccessControl/AcsEvent?format=json",
    {
      method: "POST",
      body: JSON.stringify({
        AcsEventCond: {
          searchID: crypto.randomUUID(),
          searchResultPosition: input.position ?? 0,
          maxResults: input.maxResults ?? 50,
          major: 5,
          minor: 38,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      }),
    }
  );
}
```

---

## 15. Qué evento guardar como asistencia

Evento válido:

```ts
export function isValidAttendanceEvent(event: HikvisionAcsEvent) {
  return (
    event.major === 5 &&
    event.minor === 38 &&
    Boolean(event.employeeNoString) &&
    Boolean(event.attendanceStatus)
  );
}
```

Ejemplo de evento válido:

```json
{
  "major": 5,
  "minor": 38,
  "name": "vic",
  "employeeNoString": "2",
  "attendanceStatus": "checkOut",
  "label": "Check Out",
  "serialNo": 187
}
```

Eventos no útiles para asistencia:

```json
{
  "currentVerifyMode": "invalid"
}
```

Estos eventos pueden ser de puerta, sistema, configuración o intentos inválidos.

---

## 16. Paginación de eventos

Cuando el reloj responde:

```json
"responseStatusStrg": "MORE"
```

significa que hay más eventos para consultar.

Entonces se debe volver a consultar con:

```txt
searchResultPosition = searchResultPosition + numOfMatches
```

Función completa de paginación:

```ts
export async function getAllAttendanceEvents(
  client: HikvisionClient,
  input: {
    startTime: string;
    endTime: string;
    pageSize?: number;
  }
) {
  const pageSize = input.pageSize ?? 50;
  let position = 0;
  const allEvents: HikvisionAcsEvent[] = [];

  while (true) {
    const response = await searchAttendanceEvents(client, {
      startTime: input.startTime,
      endTime: input.endTime,
      position,
      maxResults: pageSize,
    });

    const acs = response.AcsEvent;
    const events = acs.InfoList ?? [];

    allEvents.push(...events);

    if (acs.responseStatusStrg !== "MORE") {
      break;
    }

    position += acs.numOfMatches;

    if (events.length === 0) {
      break;
    }
  }

  return allEvents.filter(isValidAttendanceEvent);
}
```

---

## 17. Modelo de base de datos recomendado

### 17.1 Devices

```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  host VARCHAR(100) NOT NULL,
  port INTEGER DEFAULT 80,
  protocol VARCHAR(10) DEFAULT 'http',
  username VARCHAR(100) NOT NULL,
  password_encrypted TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 17.2 Personas

```sql
CREATE TABLE persons (
  id UUID PRIMARY KEY,
  employee_no VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  dni VARCHAR(20) NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 17.3 Tarjetas

```sql
CREATE TABLE person_cards (
  id UUID PRIMARY KEY,
  person_id UUID NOT NULL REFERENCES persons(id),
  card_no VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 17.4 Eventos crudos

```sql
CREATE TABLE device_events (
  id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES devices(id),
  serial_no INTEGER NOT NULL,
  employee_no VARCHAR(32) NULL,
  person_name VARCHAR(150) NULL,
  event_time TIMESTAMP NOT NULL,
  major INTEGER NOT NULL,
  minor INTEGER NOT NULL,
  attendance_status VARCHAR(30) NULL,
  label VARCHAR(100) NULL,
  verify_mode VARCHAR(100) NULL,
  door_no INTEGER NULL,
  raw_event JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, serial_no)
);
```

### 17.5 Marcaciones procesadas

```sql
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY,
  device_event_id UUID NOT NULL REFERENCES device_events(id),
  person_id UUID NULL REFERENCES persons(id),
  employee_no VARCHAR(32) NOT NULL,
  check_time TIMESTAMP NOT NULL,
  direction VARCHAR(20) NOT NULL,
  source VARCHAR(30) DEFAULT 'hikvision',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Valores de `direction`:

```txt
checkIn
checkOut
```

---

## 18. Sincronización recomendada

No consultar siempre todo el día desde `00:00`.

Usar:

```txt
lastSyncAt → now
```

Ejemplo:

```ts
const startTime = device.lastSyncAt ?? startOfToday();
const endTime = new Date();
```

Guardar los eventos en UTC dentro de la base de datos.

El reloj devuelve:

```txt
2026-04-26T21:57:44-03:00
```

En JavaScript:

```ts
const date = new Date(event.time);
```

Esto interpreta correctamente el offset.

---

## 19. Servicio de sync completo

```ts
import { createHikvisionClient } from "@/lib/hikvision/create-client";
import { getAllAttendanceEvents } from "@/lib/hikvision/events";

export async function syncHikvisionDevice(deviceId: string) {
  const device = await db.device.findUniqueOrThrow({
    where: { id: deviceId },
  });

  const client = createHikvisionClient();

  const start = device.lastSyncAt ?? new Date(Date.now() - 60 * 60 * 1000);
  const end = new Date();

  const startTime = toHikvisionDateTime(start);
  const endTime = toHikvisionDateTime(end);

  const events = await getAllAttendanceEvents(client, {
    startTime,
    endTime,
    pageSize: 50,
  });

  for (const event of events) {
    await db.deviceEvent.upsert({
      where: {
        deviceId_serialNo: {
          deviceId,
          serialNo: event.serialNo,
        },
      },
      create: {
        deviceId,
        serialNo: event.serialNo,
        employeeNo: event.employeeNoString ?? null,
        personName: event.name ?? null,
        eventTime: new Date(event.time),
        major: event.major,
        minor: event.minor,
        attendanceStatus: event.attendanceStatus ?? null,
        label: event.label ?? null,
        verifyMode: event.currentVerifyMode ?? null,
        doorNo: event.doorNo ?? null,
        rawEvent: event,
      },
      update: {},
    });
  }

  await db.device.update({
    where: { id: deviceId },
    data: {
      lastSyncAt: end,
    },
  });

  return {
    synced: events.length,
    startTime,
    endTime,
  };
}
```

---

## 20. Formato de fecha para Hikvision

Para Argentina:

```ts
export function toHikvisionDateTime(date: Date) {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Argentina/Jujuy",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const value = formatter.format(date).replace(" ", "T");

  return `${value}-03:00`;
}
```

Ejemplo:

```txt
2026-04-26T21:57:44-03:00
```

---

## 21. API Route para sincronizar

```txt
src/app/api/devices/[deviceId]/sync-events/route.ts
```

```ts
import { NextResponse } from "next/server";
import { syncHikvisionDevice } from "@/services/hikvision-sync-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ deviceId: string }> }
) {
  try {
    const { deviceId } = await context.params;

    const result = await syncHikvisionDevice(deviceId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
```

---

## 22. Cron recomendado

Para Next.js self-hosted:

```bash
*/5 * * * * curl -X POST http://localhost:3000/api/devices/DEVICE_ID/sync-events
```

Para producción con job interno, usar:

- `node-cron`
- BullMQ
- Trigger desde PM2
- Systemd timer
- Cron clásico

---

## 23. Flujo de alta de persona completo

```txt
1. Crear persona en base de datos.
2. Crear usuario en reloj.
3. Buscar usuario para verificar.
4. Asignar tarjeta.
5. Buscar usuario nuevamente.
6. Confirmar numOfCard = 1.
```

Servicio conceptual:

```ts
export async function provisionUserOnDevice(input: {
  employeeNo: string;
  name: string;
  cardNo?: string;
}) {
  const client = createHikvisionClient();

  await createUser(client, {
    employeeNo: input.employeeNo,
    name: input.name,
  });

  const user = await searchUserByEmployeeNo(client, input.employeeNo);

  if (input.cardNo) {
    await assignCardToUser(client, {
      employeeNo: input.employeeNo,
      cardNo: input.cardNo,
    });
  }

  const updatedUser = await searchUserByEmployeeNo(client, input.employeeNo);

  return {
    created: true,
    user,
    updatedUser,
  };
}
```

---

## 24. Errores comunes y solución

### 24.1 `badJsonFormat`

Ejemplo:

```json
{
  "statusCode": 5,
  "statusString": "Invalid Format",
  "subStatusCode": "badJsonFormat"
}
```

Causa: JSON mal formado.

Error típico:

```json
{"UserInfo":{...}}
```

`{...}` no es JSON válido.

### 24.2 `MessageParametersLack`

Ejemplo:

```json
{
  "statusCode": 6,
  "subStatusCode": "MessageParametersLack",
  "errorMsg": "major"
}
```

Causa: falta un campo requerido.

Para eventos, incluir:

```json
"major": 0,
"minor": 0
```

o:

```json
"major": 5,
"minor": 38
```

### 24.3 `badJsonContent` en `startTime`

Ejemplo:

```json
{
  "subStatusCode": "badJsonContent",
  "errorMsg": "startTime"
}
```

Causa: formato de fecha inválido para el reloj.

Usar formato con offset:

```txt
2026-04-26T21:57:44-03:00
```

No usar:

```txt
2026-04-26T21:57:44
```

### 24.4 No aparecen eventos recientes

Causas posibles:

1. Hora del reloj incorrecta.
2. Zona horaria incorrecta.
3. Rango de consulta equivocado.
4. Se usa `searchResultPosition: 0` y el evento está en páginas posteriores.
5. El evento no fue una autenticación válida.

Primero verificar:

```bash
curl --digest -u 'admin:password' \
"http://IP_RELOJ/ISAPI/System/time"
```

---

## 25. Reglas de negocio recomendadas

### 25.1 El reloj no calcula asistencia

El reloj solo registra eventos:

```txt
vic → checkIn → 21:57
vic → checkOut → 22:30
```

Tu sistema calcula:

- Entrada.
- Salida.
- Horas trabajadas.
- Tardanzas.
- Ausencias.
- Horas extra.

### 25.2 Guardar evento crudo

Siempre guardar:

```ts
rawEvent: event
```

Esto permite auditar problemas después.

### 25.3 No depender del nombre

Usar como clave:

```txt
employeeNoString
```

El nombre puede cambiar.

### 25.4 Anti-duplicado

Usar:

```txt
device_id + serialNo
```

---

## 26. Checklist de producción

Antes de dejarlo operativo:

- [ ] El reloj tiene IP fija o reserva DHCP.
- [ ] El servidor Next.js alcanza la IP del reloj.
- [ ] Digest Auth funciona.
- [ ] `/ISAPI/System/deviceInfo` responde.
- [ ] `/ISAPI/System/time` tiene hora correcta.
- [ ] Zona horaria está como `CST+3:00:00`.
- [ ] Se puede crear usuario.
- [ ] Se puede buscar usuario.
- [ ] Se puede asignar tarjeta.
- [ ] `numOfCard` sube a `1`.
- [ ] Se genera evento `checkIn`.
- [ ] Se genera evento `checkOut`.
- [ ] Se guardan eventos con `device_id + serialNo`.
- [ ] Se paginan eventos cuando `responseStatusStrg = MORE`.
- [ ] Se filtran eventos válidos con `major=5`, `minor=38`.
- [ ] Se guarda `rawEvent`.
- [ ] Se registra log de errores.
- [ ] No se expone el reloj a internet.

---

## 27. Endpoints validados

Sistema:

```txt
GET /ISAPI/System/deviceInfo
GET /ISAPI/System/time
PUT /ISAPI/System/time
```

Usuarios:

```txt
POST /ISAPI/AccessControl/UserInfo/Record?format=json
POST /ISAPI/AccessControl/UserInfo/Search?format=json
PUT  /ISAPI/AccessControl/UserInfo/Modify?format=json
```

Tarjetas:

```txt
POST /ISAPI/AccessControl/CardInfo/Record?format=json
```

Eventos:

```txt
POST /ISAPI/AccessControl/AcsEvent?format=json
```

---

## 28. Resumen final

La integración validada queda así:

```txt
Next.js
  ├── crea usuarios en el reloj
  ├── asigna tarjetas
  ├── configura hora
  ├── lee eventos
  ├── filtra checkIn/checkOut
  ├── guarda eventos crudos
  └── procesa asistencia en la base de datos
```

El evento de asistencia confiable es:

```txt
major = 5
minor = 38
employeeNoString presente
attendanceStatus presente
```

Ejemplo real validado:

```json
{
  "major": 5,
  "minor": 38,
  "time": "2026-04-26T21:57:44-03:00",
  "name": "vic",
  "employeeNoString": "2",
  "serialNo": 187,
  "attendanceStatus": "checkOut",
  "label": "Check Out"
}
```

Con esto, el proyecto Next.js puede gestionar el reloj completamente vía API HTTP/ISAPI.
