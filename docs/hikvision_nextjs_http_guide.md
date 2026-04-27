# Gestión HTTP del Reloj Hikvision DS-K1T320 desde Next.js

## 1. Objetivo

Documentar de forma precisa cómo conectarse y gestionar el reloj Hikvision vía HTTP desde un backend Next.js, replicando correctamente el comportamiento de `curl`.

---

## 2. Problema típico

Si con `curl` funciona pero en Next.js no:

Casi siempre el problema es:

- Autenticación Digest
- Headers incorrectos
- Diferencias en body (XML/JSON)
- Problemas de red (especialmente si usás Vercel)

---

## 3. Regla de oro

TODO lo que funcione en curl debe replicarse 1:1 en código.

Ejemplo:

curl:

```
curl --digest -u admin:password \
  -H "Content-Type: application/xml" \
  -X GET \
  http://192.168.1.50/ISAPI/System/deviceInfo
```

Next.js equivalente:

```ts
await client.fetch("http://192.168.1.50/ISAPI/System/deviceInfo", {
  method: "GET",
  headers: {
    "Content-Type": "application/xml",
  }
});
```

---

## 4. Problema clave: Digest Auth

El reloj usa Digest Authentication.

Fetch nativo NO lo maneja correctamente.

### Solución

Instalar:

```
npm install digest-fetch
```

---

## 5. Cliente Hikvision en Next.js

```ts
import DigestFetch from "digest-fetch";

export class HikvisionClient {
  private client;
  private baseUrl;

  constructor({ host, port = 80, username, password }) {
    this.client = new DigestFetch(username, password);
    this.baseUrl = `http://${host}:${port}`;
  }

  async request(path, options = {}) {
    const res = await this.client.fetch(this.baseUrl + path, {
      ...options,
      headers: {
        Accept: "application/xml",
        ...(options.body ? { "Content-Type": "application/xml" } : {}),
        ...(options.headers || {}),
      },
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${text}`);
    }

    return text;
  }

  async getDeviceInfo() {
    return this.request("/ISAPI/System/deviceInfo");
  }
}
```

---

## 6. Endpoint en Next.js

```ts
export const runtime = "nodejs";

export async function GET() {
  const client = new HikvisionClient({
    host: "192.168.1.50",
    username: "admin",
    password: "123456"
  });

  const data = await client.getDeviceInfo();

  return new Response(data, {
    headers: { "Content-Type": "application/xml" }
  });
}
```

---

## 7. Gestión de personas

Ejemplo POST:

```ts
async createPerson() {
  const xml = `
<UserInfo>
  <employeeNo>123</employeeNo>
  <name>Juan Perez</name>
</UserInfo>
`;

  return this.request("/ISAPI/AccessControl/UserInfo/Record", {
    method: "POST",
    body: xml
  });
}
```

---

## 8. Problemas comunes

### 401
- No estás usando Digest
- Password incorrecto

### 403
- Usuario sin permisos

### 404
- Endpoint incorrecto

### 415
- Content-Type incorrecto

### Timeout
- El servidor no está en la misma red

---

## 9. Problema con Vercel

Si el reloj está en:

```
192.168.x.x
```

Vercel NO puede acceder.

Soluciones:

- correr backend local
- usar VPN
- usar servidor intermedio

---

## 10. Flujo correcto

1. Test connection
2. Leer info dispositivo
3. Crear persona
4. Leer eventos
5. Automatizar sync

---

## 11. Conclusión

- Usar Digest Auth SIEMPRE
- Replicar curl exactamente
- Nunca usar fetch directo sin Digest
- Backend debe estar en la misma red
