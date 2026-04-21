/**
 * Hikvision ISAPI Adapter
 * Implementación de IDeviceAdapter para dispositivos Hikvision
 */

import {
  IDeviceAdapter,
  DeviceInfo,
  AccessEvent,
  EventQueryOptions,
  Person,
  SyncResult,
  DoorStatus,
  DoorAction,
  HealthCheckResult,
  AdapterConfig,
  registerAdapter,
} from "../core/interfaces";

import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";
import * as log from "../utils/logger";

// ─── XML Parser ────────────────────────────────────────────────────────────────

function parseXmlResponse(xml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  // Simple XML parser for Hikvision responses
  const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
  let match;
  
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, key, value] = match;
    result[key] = value.trim();
  }
  
  return result;
}

function extractXmlText(xml: string, path: string[]): string | undefined {
  const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
  let match;
  let current: Record<string, unknown> = {};
  const stack: Record<string, unknown>[] = [current];
  
  let depth = 0;
  const openTags: string[] = [];
  
  // Simple approach: extract text from specific paths
  const fullPath = path.join(".*");
  const regex = new RegExp(`<(${path.join(".*<")})>([^<]*)</\\1>`, "i");
  const textMatch = xml.match(regex);
  if (textMatch) {
    return textMatch[2].trim();
  }
  
  return undefined;
}

// ─── Digest Auth Client ───────────────────────────────────────────────────────

async function digestRequest(
  url: string,
  username: string,
  password: string,
  method: string = "GET",
  body?: string,
  contentType: string = "application/xml; charset=utf-8"
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";

    function makeRequest(authHeader?: string) {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "User-Agent": "Hikvision-ISAPI-Adapter/1.0",
      };
      
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }

      const options: http.RequestOptions & { rejectUnauthorized?: boolean } = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        rejectUnauthorized: false,
      };

      const req = (isHttps ? https : http).request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          // Si necesitamos autenticación
          if (res.statusCode === 401 && !authHeader) {
            const wwwAuth = res.headers["www-authenticate"];
            if (typeof wwwAuth === "string" && wwwAuth.startsWith("Digest ")) {
              const auth = generateDigestAuth(wwwAuth, username, password, method, urlObj.pathname);
              makeRequest(auth);
              return;
            }
          }
          resolve({ status: res.statusCode || 500, body: data });
        });
      });

      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    }

    makeRequest();
  });
}

function generateDigestAuth(
  wwwAuth: string,
  username: string,
  password: string,
  method: string,
  uri: string
): string {
  // Parse Digest params
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(wwwAuth)) !== null) {
    params[match[1]] = match[2];
  }

  const nonce = params["nonce"];
  const realm = params["realm"];
  const qop = params["qop"] || "auth";

  const cnonce = crypto.randomBytes(16).toString("hex");
  const nc = "00000001";

  const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
  const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
  const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");

  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

// ─── Hikvision Adapter ───────────────────────────────────────────────────────

export class HikvisionAdapter implements IDeviceAdapter {
  readonly brand = "hikvision";
  readonly version = "1.0.0";

  private config: Required<AdapterConfig>;
  private baseUrl: string;

  constructor(config: AdapterConfig) {
    this.config = {
      ip: config.ip,
      port: config.port ?? 443,
      username: config.username,
      password: config.password,
      timeout: config.timeout ?? 10000,
      serialNumber: config.serialNumber ?? config.ip,
    };
    this.baseUrl = `https://${this.config.ip}:${this.config.port}`;
  }

  // ── Device Info ────────────────────────────────────────────────────────────

  async getDeviceInfo(): Promise<DeviceInfo> {
    const response = await digestRequest(
      `${this.baseUrl}/ISAPI/System/deviceInfo`,
      this.config.username,
      this.config.password
    );

    if (response.status !== 200) {
      throw new Error(`Failed to get device info: ${response.status}`);
    }

    const xml = parseXmlResponse(response.body);

    return {
      serialNumber: String(xml["serialNumber"] || xml["deviceID"] || "unknown"),
      model: String(xml["model"] || "unknown"),
      firmwareVersion: String(xml["firmwareVersion"] || "unknown"),
      deviceName: String(xml["deviceName"] || "Hikvision Device"),
      manufacturer: "hikvision",
      macAddress: xml["macAddress"] as string | undefined,
      deviceType: xml["deviceType"] as string | undefined,
    };
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  async sendHeartbeat(): Promise<void> {
    // Hikvision no tiene endpoint de heartbeat específico
    // Simplemente verificamos que responde
    await this.healthCheck();
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async getUsers(): Promise<Person[]> {
    try {
      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo`,
        this.config.username,
        this.config.password,
        "GET"
      );

      // Si el endpoint no existe, intentar Alternative
      if (response.status === 404) {
        const altResponse = await digestRequest(
          `${this.baseUrl}/ISAPI/AccessControl/UserInfo/Search`,
          this.config.username,
          this.config.password,
          "POST",
          `<?xml version="1.0" encoding="utf-8"?>
<SearchInfo>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>500</maxResults>
</SearchInfo>`
        );

        if (altResponse.status !== 200) {
          return [];
        }

        return this.parseUsersFromXml(altResponse.body);
      }

      if (response.status !== 200) {
        return [];
      }

      return this.parseUsersFromXml(response.body);
    } catch (err) {
      if ((err as Error).message.includes("socket") || (err as Error).message.includes("ECONNREFUSED")) {
        log.warn("hikvision", "Connection error getting users", { error: (err as Error).message });
        return [];
      }
      throw err;
    }
  }

  private parseUsersFromXml(xml: string): Person[] {
    const users: Person[] = [];
    
    // Parse EmployeeInfo blocks
    const userRegex = /<EmployeeInfo>([\s\S]*?)<\/EmployeeInfo>/g;
    let match;
    
    while ((match = userRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const parsed = parseXmlResponse(itemXml);
      
      users.push({
        id: String(parsed["employeeNo"] || "0"),
        employeeId: String(parsed["employeeNo"] || "0"),
        employeeNo: parsed["employeeNo"] as string,
        name: parsed["name"] as string || "Unknown",
        cardNumber: parsed["cardNumber"] as string,
      });
    }
    
    return users;
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  async getEvents(options?: EventQueryOptions): Promise<AccessEvent[]> {
    const startTime = options?.startTime ?? new Date(Date.now() - 86400000); // Default 24h
    const endTime = options?.endTime ?? new Date();
    const maxResults = options?.maxResults ?? 100;

    // Try JSON format first (required for ACS devices like DS-K1T320)
    const jsonBody = JSON.stringify({
      AcsEventCond: {
        searchID: `sync_${Date.now()}`,
        searchResultPosition: 0,
        maxResults: maxResults,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    try {
      // Try JSON endpoint
      const jsonResponse = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`,
        this.config.username,
        this.config.password,
        "POST",
        jsonBody,
        "application/json"
      );

      if (jsonResponse.status === 200) {
        const data = JSON.parse(jsonResponse.body);
        return this.parseJsonEvents(data);
      }

      // If JSON fails, try XML format
      const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<searchEvents>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>${maxResults}</maxResults>
  <timeSearchType>point</timeSearchType>
  <startTime>${startTime.toISOString()}</startTime>
  <endTime>${endTime.toISOString()}</endTime>
</searchEvents>`;

      const xmlResponse = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/AcsEvent`,
        this.config.username,
        this.config.password,
        "POST",
        xmlBody
      );

      if (xmlResponse.status === 404 || xmlResponse.status === 500) {
        log.warn("hikvision", "Events endpoint not available", { status: xmlResponse.status });
        return [];
      }

      if (xmlResponse.status !== 200) {
        throw new Error(`Failed to get events: ${xmlResponse.status}`);
      }

      // Parse events from XML
      return this.parseXmlEvents(xmlResponse.body);
    } catch (err) {
      // If connection error, return empty (not fatal)
      if ((err as Error).message.includes("socket") || (err as Error).message.includes("ECONNREFUSED")) {
        log.warn("hikvision", "Connection error getting events", { error: (err as Error).message });
        return [];
      }
      throw err;
    }
  }

  private parseJsonEvents(data: any): AccessEvent[] {
    const events: AccessEvent[] = [];
    
    try {
      const eventList = data?.AcsEvent?.AcsEventList?.AcsEvent || [];
      const list = Array.isArray(eventList) ? eventList : [eventList];
      
      for (const event of list) {
        if (!event) continue;
        events.push({
          employeeId: String(event.employeeNo || event.cardNo || "unknown"),
          employeeNo: event.employeeNo,
          cardNo: event.cardNo,
          eventTime: new Date(event.time || Date.now()),
          major: Number(event.majorEventType || 0),
          minor: Number(event.minorEventType || 0),
          eventType: this.mapEventType(Number(event.majorEventType), Number(event.minorEventType)),
          verifyMode: this.mapVerifyMode(Number(event.verificationMode)),
          raw: event,
        });
      }
    } catch (err) {
      log.warn("hikvision", "Failed to parse JSON events", { error: (err as Error).message });
    }
    
    return events;
  }

  private parseXmlEvents(xml: string): AccessEvent[] {
    const events: AccessEvent[] = [];
    
    const matchRegex = /<MatchItem>([\s\S]*?)<\/MatchItem>/g;
    let match;

    while ((match = matchRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      const parsed = parseXmlResponse(itemXml);

      events.push({
        employeeId: String(parsed["employeeNo"] || parsed["cardNo"] || "unknown"),
        employeeNo: parsed["employeeNo"] as string,
        cardNo: parsed["cardNo"] as string,
        eventTime: new Date(parsed["time"] as string || Date.now()),
        major: Number(parsed["majorEventType"] || 0),
        minor: Number(parsed["minorEventType"] || 0),
        eventType: this.mapEventType(Number(parsed["majorEventType"]), Number(parsed["minorEventType"])),
        verifyMode: this.mapVerifyMode(Number(parsed["verificationMode"])),
        raw: parsed,
      });
    }

    return events;
  }

  // ── Persons ────────────────────────────────────────────────────────────────

  async syncPerson(person: Person): Promise<SyncResult> {
    // Hikvision usa EmployeeNo como identificador
    const employeeNo = person.employeeNo || person.employeeId || "0";

    try {
      const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<UserInfo version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <employeeNo>${employeeNo}</employeeNo>
  <name>${this.escapeXml(person.name)}</name>
  <userType>normal</userType>
  <Valid>
    <enable>true</enable>
  </Valid>
</UserInfo>`;

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/1`,
        this.config.username,
        this.config.password,
        "PUT",
        requestBody
      );

      if (response.status !== 200 && response.status !== 201) {
        return {
          success: false,
          employeeNo,
          error: `Failed to sync person: ${response.status}`,
        };
      }

      return { success: true, employeeNo };
    } catch (err) {
      return {
        success: false,
        employeeNo,
        error: (err as Error).message,
      };
    }
  }

  async deletePerson(employeeNo: string): Promise<void> {
    try {
      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/1?employeeNo=${employeeNo}`,
        this.config.username,
        this.config.password,
        "DELETE"
      );

      // 404 = persona no existe, no es error
      if (response.status === 404) {
        return;
      }

      if (response.status !== 200 && response.status !== 204) {
        throw new Error(`Failed to delete person: ${response.status}`);
      }
    } catch (err) {
      // Ignorar errores de conexión
      log.warn("hikvision", "Error deleting person", { employeeNo, error: (err as Error).message });
    }
  }

  async getPersons(): Promise<Person[]> {
    // Este endpoint puede no existir en todos los dispositivos
    // Retornar vacío en vez de fallar
    try {
      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/1?format=0`,
        this.config.username,
        this.config.password
      );

      // Endpoint no soportado
      if (response.status === 404 || response.status === 400) {
        log.info("hikvision", "Person listing not supported on this device");
        return [];
      }

      if (response.status !== 200) {
        throw new Error(`Failed to get persons: ${response.status}`);
      }

      const persons: Person[] = [];
      const personRegex = /<UserInfo>([\s\S]*?)<\/UserInfo>/g;
      let match;

      while ((match = personRegex.exec(response.body)) !== null) {
        const parsed = parseXmlResponse(match[1]);
        persons.push({
          id: parsed["employeeNo"] as string,
          employeeNo: parsed["employeeNo"] as string,
          name: parsed["name"] as string,
          status: "active",
        });
      }

      return persons;
    } catch (err) {
      // No es fatal - retornar vacío
      log.warn("hikvision", "Could not list persons", { error: (err as Error).message });
      return [];
    }
  }

  // ── Door Control ──────────────────────────────────────────────────────────

  async getDoorStatus(doorNo: number = 1): Promise<DoorStatus> {
    const response = await digestRequest(
      `${this.baseUrl}/ISAPI/AccessControl/Door/status/${doorNo}`,
      this.config.username,
      this.config.password
    );

    const xml = parseXmlResponse(response.body);
    const statusText = String(xml["doorStatus"] || "unknown").toLowerCase();

    let status: DoorStatus["status"] = "unknown";
    if (statusText.includes("open")) status = "open";
    else if (statusText.includes("close")) status = "closed";
    else if (statusText.includes("lock")) status = "locked";
    else if (statusText.includes("alarm")) status = "alarm";

    return {
      doorNo,
      status,
      doorName: xml["doorName"] as string | undefined,
      locked: statusText.includes("lock"),
      online: true,
      raw: xml,
    };
  }

  async controlDoor(doorNo: number, action: DoorAction): Promise<void> {
    const controlType = {
      open: "open",
      close: "close",
      alwaysopen: "alwaysOpen",
      alwaysclose: "alwaysClose",
      normal: "normal",
    }[action];

    const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<RemoteControlDoor>
  <doorNo>${doorNo}</doorNo>
  <controlType>${controlType}</controlType>
</RemoteControlDoor>`;

    const response = await digestRequest(
      `${this.baseUrl}/ISAPI/AccessControl/RemoteControl/door/${doorNo}`,
      this.config.username,
      this.config.password,
      "PUT",
      requestBody
    );

    if (response.status !== 200) {
      throw new Error(`Failed to control door: ${response.status}`);
    }
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/System/deviceInfo`,
        this.config.username,
        this.config.password
      );

      return {
        reachable: response.status === 200,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        error: response.status !== 200 ? `HTTP ${response.status}` : undefined,
      };
    } catch (err) {
      return {
        reachable: false,
        latency: Date.now() - startTime,
        timestamp: new Date(),
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async disconnect(): Promise<void> {
    // No hay conexiones persistentes que cerrar en este adaptador
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private mapEventType(major: number, minor: number): string {
    switch (major) {
      case 1: return "access_granted";
      case 2: return "access_denied";
      case 3: return "door_open";
      case 4: return "door_close";
      case 5: return "duress_alarm";
      case 6: return "fire_alarm";
      default: return `event_${major}`;
    }
  }

  private mapVerifyMode(code: number): string {
    const modes: Record<number, string> = {
      1: "password",
      2: "card",
      3: "fingerprint",
      4: "face",
      5: "card_and_password",
      6: "card_and_fingerprint",
      7: "face_and_password",
    };
    return modes[code] || "unknown";
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

// Register the adapter
registerAdapter("hikvision", HikvisionAdapter);
