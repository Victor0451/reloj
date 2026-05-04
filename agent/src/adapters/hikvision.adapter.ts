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
import DigestFetch from "digest-fetch";
import nodeFetch from "node-fetch";
import * as log from "../utils/logger";

// ─── Local Types ────────────────────────────────────────────────────────────

interface DevicePerson {
  employeeNo: string;
  name: string;
  userType?: string;
  doorRight?: string;
  numOfCard?: number;
  numOfFP?: number;
  numOfFace?: number;
}

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
  const current: Record<string, unknown> = {};
  const stack: Record<string, unknown>[] = [current];
  
  const depth = 0;
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

// ─── Nonce Replay Prevention ─────────────────────────────────────────────────

const recentNonces = new Set<string>();
const MAX_NONCE_ENTRIES = 1000;
const PRUNE_BATCH_RATIO = 0.5;

function isNonceValid(nonce: string): boolean {
  if (recentNonces.has(nonce)) {
    return false; // Replay detected
  }

  // Prune if at or above threshold
  if (recentNonces.size >= MAX_NONCE_ENTRIES) {
    const pruneCount = Math.floor(recentNonces.size * PRUNE_BATCH_RATIO);
    const entries = Array.from(recentNonces);
    entries.slice(0, pruneCount).forEach(n => recentNonces.delete(n));
  }

  recentNonces.add(nonce);
  return true;
}

function extractNonceFromWwwAuth(wwwAuth: string): string | null {
  const match = wwwAuth.match(/nonce="([^"]+)"/);
  return match ? match[1] : null;
}

// ─── Digest Auth Client ───────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30000;

/* ─── Legacy Digest Implementation (Rollback) ────────────────────────────────
function generateDigestAuthLegacy(
  wwwAuth: string,
  username: string,
  password: string,
  method: string,
  uri: string
): string {
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
  // MD5 required for Hikvision ISAPI legacy digest auth
  const ha1 = crypto.createHash("md5").update(`${username}:${realm}:${password}`).digest("hex");
  const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
  const response = crypto.createHash("md5").update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest("hex");
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

async function digestRequestLegacy(
  url: string,
  username: string,
  password: string,
  method: string = "GET",
  body?: string,
  contentType: string = "application/xml; charset=utf-8",
  rejectUnauthorized: boolean = true,
  timeoutMs?: number,
  retryCount?: number
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";
    const effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function makeRequest(authHeader?: string) {
      const headers: Record<string, string> = {
        "Content-Type": contentType,
        "User-Agent": "Hikvision-ISAPI-Adapter/1.0",
      };
      if (authHeader) {
        headers["Authorization"] = authHeader;
      }
      const options: http.RequestOptions & { rejectUnauthorized?: boolean; timeout?: number } = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method,
        headers,
        rejectUnauthorized,
        timeout: effectiveTimeoutMs,
      };
      const req = (isHttps ? https : http).request(options, (res) => {
        if (timeoutId) clearTimeout(timeoutId);
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode === 401 && !authHeader) {
            const wwwAuth = res.headers["www-authenticate"];
            if (typeof wwwAuth === "string" && wwwAuth.startsWith("Digest ")) {
              const auth = generateDigestAuthLegacy(wwwAuth, username, password, method, urlObj.pathname);
              makeRequest(auth);
              return;
            }
          }
          resolve({ status: res.statusCode || 500, body: data });
        });
      });
      req.on("error", (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(err);
      });
      timeoutId = setTimeout(() => {
        req.destroy(new Error(`Connection timeout after ${effectiveTimeoutMs}ms`));
      }, effectiveTimeoutMs);
      if (body) req.write(body);
      req.end();
    }
    makeRequest();
  });
}
////////////////////////////////////////////////////////////////////////////////
// ROLLBACK: uncomment above legacy block + remove DigestFetch, swap doDigestRequest
//////////////////////////////////////////////////////////////////////////////// */

/* ─── DigestFetch Implementation ──────────────────────────────────────────── */

async function doDigestRequest(
  url: string,
  username: string,
  password: string,
  method: string,
  body?: string,
  contentType?: string,
  rejectUnauthorized?: boolean,
  timeoutMs?: number
): Promise<{ status: number; body: string }> {
  const effectiveContentType = contentType ?? "application/xml; charset=utf-8";
  const effectiveRejectUnauthorized = rejectUnauthorized ?? true;
  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === "https:";

  // Build HTTPS agent with rejectUnauthorized option
  const agent = isHttps
    ? new https.Agent({ rejectUnauthorized: effectiveRejectUnauthorized, timeout: effectiveTimeoutMs })
    : undefined;

  const client = new DigestFetch(username, password, { agent });

  const headers: Record<string, string> = { "Content-Type": effectiveContentType };

  // First request to trigger 401 and get www-authenticate challenge
  const challengeResp = await nodeFetch(url, { method, body, headers, agent });

  if (challengeResp.status !== 401) {
    return { status: challengeResp.status, body: await challengeResp.text() };
  }

  // Parse the digest challenge from www-authenticate header
  const wwwAuth = challengeResp.headers.get("www-authenticate");
  if (wwwAuth && wwwAuth.startsWith("Digest ") && !client.hasAuth) {
    client.parseAuth(wwwAuth);

    // Nonce replay prevention
    const nonce = extractNonceFromWwwAuth(wwwAuth);
    if (nonce && !isNonceValid(nonce)) {
      return { status: 401, body: "Nonce replay detected" };
    }

    // Make authenticated request with digest auth header
    const authOptions = client.addAuth(url, { method, body, headers });
    const authResp = await nodeFetch(url, { ...authOptions, agent });

    // Update digest nc for subsequent requests
    client.digest.nc++;

    return { status: authResp.status, body: await authResp.text() };
  }

  return { status: challengeResp.status, body: await challengeResp.text() };
}

/* ─── Public digestRequest (wraps doDigestRequest with retry logic) ─────────── */

async function digestRequest(
  url: string,
  username: string,
  password: string,
  method: string = "GET",
  body?: string,
  contentType?: string,
  rejectUnauthorized?: boolean,
  timeoutMs?: number,
  retryCount?: number
): Promise<{ status: number; body: string }> {
  const effectiveContentType = contentType ?? "application/xml; charset=utf-8";
  const effectiveRejectUnauthorized = rejectUnauthorized ?? true;
  const effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const effectiveRetryCount = retryCount ?? 2;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= effectiveRetryCount; attempt++) {
    try {
      const result = await doDigestRequest(url, username, password, method, body, effectiveContentType, effectiveRejectUnauthorized, effectiveTimeoutMs);
      return result;
    } catch (err) {
      lastError = err as Error;

      // Only retry on socket hang up or timeout
      const isRetryable = lastError.message.includes("socket hang up") ||
                          lastError.message.includes("ETIMEDOUT") ||
                          lastError.message.includes("ECONNRESET") ||
                          lastError.message.includes("ENOTFOUND");

      if (isRetryable && attempt < effectiveRetryCount) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
}

/**
 * Format date for Hikvision ISAPI: 2026-04-26T21:57:44-03:00
 * DS-K1T320MFWX requires timezone offset, not UTC ISO string
 */
function formatHikvisionTime(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  // Hardcode -03:00 for Argentina. In production, calculate from timezone.
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}-03:00`;
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
      // SSL: default to true (secure), only disable for self-signed certs
      rejectUnauthorized: config.rejectUnauthorized ?? true,
    };
    this.baseUrl = `https://${this.config.ip}:${this.config.port}`;
  }

  // ── Device Info ────────────────────────────────────────────────────────────

  async getDeviceInfo(): Promise<DeviceInfo> {
    const response = await digestRequest(
      `${this.baseUrl}/ISAPI/System/deviceInfo`,
      this.config.username,
      this.config.password,
      "GET",
      undefined,
      "application/xml; charset=utf-8",
      this.config.rejectUnauthorized
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
        "GET",
        undefined,
        "application/xml; charset=utf-8",
        this.config.rejectUnauthorized
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
</SearchInfo>`,
          "application/xml; charset=utf-8",
          this.config.rejectUnauthorized
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

    // DS-K1T320MFWX rejects startTime/endTime with 400 "badJsonContent" error.
    // Only include time filters when explicitly requested by caller.
    // Note: Even with explicit time filters, some devices may still reject them.
    const hasTimeFilter = options?.startTime !== undefined && options?.endTime !== undefined;

    let position = 0;
    const maxPages = 10;
    const allEvents: AccessEvent[] = [];

    const acsEventCond: Record<string, unknown> = {
      searchID: `sync_${Date.now()}`,
      searchResultPosition: position,
      maxResults: Math.min(maxResults, 200),
      major: 5,
      minor: 38,
    };

    // Only add time filters when caller explicitly provides both startTime and endTime
    // DS-K1T320MFWX needs proper ISO format with timezone offset: 2026-04-26T21:57:44-03:00
    if (hasTimeFilter) {
      acsEventCond.startTime = formatHikvisionTime(startTime);
      acsEventCond.endTime = formatHikvisionTime(endTime);
    }

    const jsonBody = JSON.stringify({ AcsEventCond: acsEventCond });

    try {
      // Try JSON endpoint with pagination loop
      while (true) {
        acsEventCond.searchResultPosition = position;
        const jsonBody = JSON.stringify({ AcsEventCond: acsEventCond });

        log.info("hikvision", "Making JSON events request", {
          url: `${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`,
          body: jsonBody,
          startTime: hasTimeFilter ? formatHikvisionTime(startTime) : "none",
          endTime: hasTimeFilter ? formatHikvisionTime(endTime) : "none",
        });

        const jsonResponse = await digestRequest(
          `${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`,
          this.config.username,
          this.config.password,
          "POST",
          jsonBody,
          "application/json",
          this.config.rejectUnauthorized
        );

        log.info("hikvision", "JSON events response", {
          status: jsonResponse.status,
          bodyLength: jsonResponse.body.length,
          bodyPreview: jsonResponse.body.substring(0, 300),
        });

        if (jsonResponse.status === 200) {
          const data = JSON.parse(jsonResponse.body);
          const parsedEvents = this.parseJsonEvents(data);
          allEvents.push(...parsedEvents);

          log.info("hikvision", `JSON returned ${parsedEvents.length} events, total collected: ${allEvents.length}`, {
            responseStatus: data?.AcsEvent?.responseStatusStrg,
            totalMatches: data?.AcsEvent?.totalMatches,
            numOfMatches: data?.AcsEvent?.numOfMatches,
          });

          // Check if there are more results
          if (data?.AcsEvent?.responseStatusStrg === "MORE" && position < maxPages * 200) {
            position += data.AcsEvent.numOfMatches;
            continue;
          }

          // If response is "NO MATCH" with 0 events AND we applied time filters,
          // retry without time filters to get events from the device's available history.
          // This handles devices that return "NO MATCH" when query range has no events
          // but still have older events available.
          if (
            allEvents.length === 0 &&
            hasTimeFilter &&
            data?.AcsEvent?.responseStatusStrg === "NO MATCH"
          ) {
            log.info("hikvision", "NO MATCH with time filters, retrying without time range to get available events");

            // Make a second request without time filters
            const noTimeFilterCond: Record<string, unknown> = {
              searchID: `sync_${Date.now()}`,
              searchResultPosition: 0,
              maxResults: Math.min(maxResults, 200),
              major: 5,
              minor: 38,
            };
            const noTimeBody = JSON.stringify({ AcsEventCond: noTimeFilterCond });

            const retryResponse = await digestRequest(
              `${this.baseUrl}/ISAPI/AccessControl/AcsEvent?format=json`,
              this.config.username,
              this.config.password,
              "POST",
              noTimeBody,
              "application/json",
              this.config.rejectUnauthorized
            );

            log.info("hikvision", "Retry without time filters response", {
              status: retryResponse.status,
              bodyPreview: retryResponse.body.substring(0, 300),
            });

            if (retryResponse.status === 200) {
              const retryData = JSON.parse(retryResponse.body);
              const retryEvents = this.parseJsonEvents(retryData);
              allEvents.push(...retryEvents);

              log.info("hikvision", `Retry returned ${retryEvents.length} events (total: ${allEvents.length})`, {
                responseStatus: retryData?.AcsEvent?.responseStatusStrg,
                totalMatches: retryData?.AcsEvent?.totalMatches,
              });

              // If retry got events, we're done — don't paginate on fallback
              if (allEvents.length > 0) {
                return allEvents;
              }
            }
          }

          break;
        }

        log.warn("hikvision", "JSON endpoint failed, trying XML fallback", {
          status: jsonResponse.status,
          body: jsonResponse.body.substring(0, 300),
        });
        break;
      }

      // If we got events from JSON, return them
      if (allEvents.length > 0) {
        return allEvents;
      }

      // JSON returned no events, try XML format
      log.info("hikvision", "Attempting XML fallback", { allEventsFromJson: allEvents.length });

      const xmlBody = `<?xml version="1.0" encoding="utf-8"?>
<searchEvents>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>${maxResults}</maxResults>
</searchEvents>`;

      log.info("hikvision", "Making XML events request", {
        url: `${this.baseUrl}/ISAPI/AccessControl/AcsEvent`,
        body: xmlBody,
      });

      const xmlResponse = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/AcsEvent`,
        this.config.username,
        this.config.password,
        "POST",
        xmlBody,
        "application/xml; charset=utf-8",
        this.config.rejectUnauthorized
      );

      log.info("hikvision", "XML events response", {
        status: xmlResponse.status,
        bodyPreview: xmlResponse.body.substring(0, 300),
      });

      if (xmlResponse.status === 404 || xmlResponse.status === 500) {
        log.warn("hikvision", "Events endpoint not available", { status: xmlResponse.status });
        return [];
      }

      if (xmlResponse.status !== 200) {
        log.warn("hikvision", "XML fallback also failed", { status: xmlResponse.status });
        return [];
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
      // DS-K1T320MFWX returns events in InfoList, not AcsEventList.AcsEvent
      const eventList = data?.AcsEvent?.InfoList || [];
      const list = Array.isArray(eventList) ? eventList : [eventList];
      
      for (const event of list) {
        if (!event) continue;

        // Determine eventType: attendance events (major=5, minor=38) use attendanceStatus
        let eventType: string;
        if (event.major === 5 && event.minor === 38) {
          const status = event.attendanceStatus;
          if (status && typeof status === 'string' && status.trim() !== '') {
            eventType = status.trim();
          } else {
            log.warn("hikvision", "Missing or unknown attendanceStatus for minor=38 event", {
              employeeNo: event.employeeNo,
              attendanceStatus: status,
            });
            eventType = "attendance_unknown";
          }
        } else {
          eventType = this.mapEventType(Number(event.major), Number(event.minor));
        }

        const accessEvent: AccessEvent = {
          employeeId: String(event.employeeNo || event.employeeNoString || event.cardNo || "unknown"),
          employeeNo: event.employeeNo,
          cardNo: event.cardNo,
          eventTime: new Date(event.time || Date.now()),
          major: Number(event.major || 0),
          minor: Number(event.minor || 0),
          eventType,
          verifyMode: event.currentVerifyMode,
          doorNo: event.doorNo,
          deviceSerialNo: String(event.serialNo || ''),
          cardReaderNo: event.cardReaderNo,
          label: event.label,
          raw: event,
        };

        // Extract identity from successful authentication events (minor=38)
        // These events contain the detected name and employeeNoString from the device
        if (accessEvent.minor === 38) {
          accessEvent.detectedName = event.name;
          accessEvent.detectedEmployeeNo = event.employeeNoString;
        }

        events.push(accessEvent);
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

  /**
   * Create a new person on the device via POST.
   * Use this for NEW persons - the device assigns the employeeNo.
   * Returns the assigned employeeNo if available.
   */
  async createPerson(person: Person): Promise<SyncResult> {
    const employeeNo = person.employeeNo || person.employeeId || "";
    const name = person.name;

    try {
      const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<UserInfo>
  <employeeNo>${this.escapeXml(employeeNo)}</employeeNo>
  <name>${this.escapeXml(name)}</name>
  <userType>normal</userType>
  <Valid>
    <enable>true</enable>
  </Valid>
  ${person.cardNumber ? `<cardList><card><cardNo>${this.escapeXml(person.cardNumber)}</cardNo></card></cardList>` : ''}
</UserInfo>`;

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/Record`,
        this.config.username,
        this.config.password,
        "POST",
        requestBody,
        "application/xml; charset=utf-8",
        this.config.rejectUnauthorized
      );

      if (response.status !== 200 && response.status !== 201) {
        return {
          success: false,
          employeeNo,
          error: `Create failed: ${response.status}`,
        };
      }

      // POST may succeed but not return the assigned employeeNo in body.
      // Search by name to get the number the device assigned.
      const assignedNo = await this.getAssignedEmployeeNo(name);
      return { success: true, employeeNo: assignedNo ?? employeeNo ?? "assigned" };
    } catch (err) {
      return {
        success: false,
        employeeNo,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Get employeeNo assigned by device after creation.
   * Searches by name since we don't know the number.
   */
  private async getAssignedEmployeeNo(name: string): Promise<string | null> {
    try {
      const persons = await this.getPersons();
      const found = persons.find((p) => p.name === name && p.employeeNo);
      return found?.employeeNo ?? null;
    } catch {
      return null;
    }
  }

  // ── Door Control ──────────────────────────────────────────────────────────

  async getDoorStatus(doorNo: number = 1): Promise<DoorStatus> {
    const response = await digestRequest(
      `${this.baseUrl}/ISAPI/AccessControl/Door/status/${doorNo}`,
      this.config.username,
      this.config.password,
      "GET",
      undefined,
      "application/xml; charset=utf-8",
      this.config.rejectUnauthorized
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
      requestBody,
      "application/xml; charset=utf-8",
      this.config.rejectUnauthorized
    );

    if (response.status !== 200) {
      throw new Error(`Failed to control door: ${response.status}`);
    }
  }

  // ── Legacy Person Methods (XML-based, kept for interface compliance) ──────

  async deletePerson(employeeNo: string): Promise<void> {
    try {
      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/1?employeeNo=${encodeURIComponent(employeeNo)}`,
        this.config.username,
        this.config.password,
        "DELETE",
        undefined,
        "application/xml; charset=utf-8",
        this.config.rejectUnauthorized
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
    // Use JSON POST search endpoint which is supported
    // DS-K1T320MFWX supports /ISAPI/AccessControl/UserInfo/Search?format=json
    try {
      const body = {
        UserInfoSearchCond: {
          searchID: `persons_${Date.now()}`,
          searchResultPosition: 0,
          maxResults: 100,
          EmployeeNoList: [],  // Empty = all persons
        },
      };

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/Search?format=json`,
        this.config.username,
        this.config.password,
        "POST",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );

      if (response.status !== 200) {
        log.warn("hikvision", "getPersons failed", { status: response.status });
        return [];
      }

      const data = JSON.parse(response.body);
      const searchResult = data?.UserInfoSearch;

      if (!searchResult || searchResult.responseStatusStrg !== "OK") {
        return [];
      }

      const personsList = searchResult.UserInfo;
      if (!personsList || !Array.isArray(personsList)) {
        return [];
      }

      return personsList.map((p: any) => ({
        id: String(p.employeeNo || ''),
        employeeId: String(p.employeeNo || ''),
        employeeNo: String(p.employeeNo || ''),
        name: String(p.name || 'Unknown'),
        cardNumber: p.cardNo ? String(p.cardNo) : undefined,
        status: 'active' as const,
      }));
    } catch (err) {
      log.warn("hikvision", "Could not list persons", { error: (err as Error).message });
      return [];
    }
  }

  // ── JSON Person Operations (ISAPI) ─────────────────────────────────────────

/**
   * Find the next available employee number on the device.
   * Scans existing employee numbers and returns the smallest positive integer not in use.
   */
  async getNextAvailableEmployeeNo(): Promise<string | null> {
    try {
      const persons = await this.getPersons();
      const usedNumbers = new Set<number>();

      for (const person of persons) {
        const num = parseInt(person.employeeNo || '0', 10);
        if (!isNaN(num) && num > 0) {
          usedNumbers.add(num);
        }
      }

      // Find the smallest positive integer not in use
      let next = 1;
      while (usedNumbers.has(next)) {
        next++;
      }

      return String(next);
    } catch (err) {
      log.warn("hikvision", "Failed to get next available employeeNo", { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Create a new person on the device via JSON ISAPI.
   * POST /ISAPI/AccessControl/UserInfo/Record?format=json
   *
   * If employeeNo is empty/invalid (e.g., AUTO_xxx), finds next available number on device.
   * If no employeeNo provided and auto-assign fails, returns failure.
   */
  async createPersonOnDevice(person: Person): Promise<SyncResult> {
    const inputEmployeeNo = person.employeeNo || person.employeeId || '';
    // Determine the employeeNo to use
    let employeeNoToUse: string;

    if (inputEmployeeNo && !inputEmployeeNo.startsWith('AUTO_')) {
      // Use provided valid employeeNo
      employeeNoToUse = inputEmployeeNo;
    } else {
      // No valid employeeNo — find next available on device
      const availableNo = await this.getNextAvailableEmployeeNo();
      if (!availableNo) {
        return {
          success: false,
          employeeNo: inputEmployeeNo,
          error: 'Failed to find available employeeNo on device',
        };
      }
      employeeNoToUse = availableNo;
    }

    const name = person.name;

    try {
      const body: Record<string, unknown> = {
        UserInfo: {
          employeeNo: employeeNoToUse,
          name: name,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: "2024-01-01T00:00:00",
            endTime: "2030-12-31T23:59:59",
          },
          doorRight: "1",
          RightPlan: [
            {
              doorNo: 1,
              planTemplateNo: "1",
            },
          ],
        },
      };

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/Record?format=json`,
        this.config.username,
        this.config.password,
        "POST",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );

      if (response.status === 402) {
        return {
          success: false,
          employeeNo: employeeNoToUse,
          error: 'Device capacity reached',
          code: 'deviceFull',
        };
      }

      if (response.status !== 200 && response.status !== 201) {
        return {
          success: false,
          employeeNo: employeeNoToUse,
          error: `Create failed: ${response.status}`,
        };
      }

return { success: true, employeeNo: employeeNoToUse };
    } catch (err) {
      return {
        success: false,
        employeeNo: employeeNoToUse,
        error: (err as Error).message,
      };
    }
  }

  /**
   * Search for a person on device by employeeNo.
   * POST /ISAPI/AccessControl/UserInfo/Search?format=json
   * Returns the person if found, null if not found.
   */
  async searchPersonOnDevice(employeeNo: string): Promise<DevicePerson | null> {
    try {
      const body = {
        UserInfoSearchCond: {
          searchID: `search_${Date.now()}`,
          searchResultPosition: 0,
          maxResults: 10,
          EmployeeNoList: [{ employeeNo }],
        },
      };

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/Search?format=json`,
        this.config.username,
        this.config.password,
        "POST",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );

      if (response.status !== 200) {
        log.warn("hikvision", "searchPersonOnDevice failed", { status: response.status, employeeNo });
        return null;
      }

      const data = JSON.parse(response.body);
      const searchResult = data?.UserInfoSearch;

      if (!searchResult || searchResult.responseStatusStrg !== "OK") {
        return null;
      }

      const persons = searchResult.UserInfo;
      if (!persons || persons.length === 0) {
        return null;
      }

      // Return first match
      const p = persons[0];
      return {
        employeeNo: p.employeeNo,
        name: p.name,
        userType: p.userType,
        doorRight: p.doorRight,
        numOfCard: p.numOfCard ?? 0,
        numOfFP: p.numOfFP ?? 0,
        numOfFace: p.numOfFace ?? 0,
      };
    } catch (err) {
      log.warn("hikvision", "searchPersonOnDevice error", { error: (err as Error).message, employeeNo });
      return null;
    }
  }

  /**
   * Update an existing person on the device via JSON ISAPI.
   * PUT /ISAPI/AccessControl/UserInfo/Modify?format=json
   *
   * If cardNumber changed (previousCardNumber provided and differs), also reassigns card.
   * Handles card conflict: if card already assigned to another employee, removes it first.
   */
  async updatePersonOnDevice(person: Person, previousCardNumber?: string | null): Promise<SyncResult> {
    const employeeNo = person.employeeNo || person.employeeId || '';

    try {
      const body = {
        UserInfo: {
          employeeNo: employeeNo,
          name: person.name,
          userType: "normal",
          Valid: {
            enable: true,
            beginTime: "2024-01-01T00:00:00",
            endTime: "2030-12-31T23:59:59",
          },
          doorRight: "1",
          RightPlan: [
            {
              doorNo: 1,
              planTemplateNo: "1",
            },
          ],
        },
      };

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/UserInfo/Modify?format=json`,
        this.config.username,
        this.config.password,
        "PUT",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );

      if (response.status !== 200 && response.status !== 201) {
        return {
          success: false,
          employeeNo,
          error: `Update failed: ${response.status}`,
        };
      }

      // Card reassignment: if card changed, assign new card (handles conflicts)
      const currentCard = previousCardNumber ?? null;
      if (person.cardNumber !== currentCard) {
        if (person.cardNumber) {
          // Check if card exists on another employee — if so, delete it first
          const existingOwner = await this.findEmployeeByCard(person.cardNumber);
          if (existingOwner && existingOwner !== employeeNo) {
            log.info("hikvision", `Card ${person.cardNumber} already assigned to ${existingOwner}, removing first`);
            await this.deleteCardInfo(existingOwner, person.cardNumber);
          }

          // Assign card to this employee
          const cardResult = await this.assignCardToDevice(employeeNo, person.cardNumber);
          if (!cardResult.success) {
            return {
              success: false,
              employeeNo,
              error: `UserInfo updated but card assign failed: ${cardResult.error}`,
            };
          }
        }
        // If new card is empty but old existed — card stays on device (not removed)
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

  /**
   * Find employeeNo that currently owns a card on the device.
   * Returns employeeNo if found, null if card is not assigned.
   */
  private async findEmployeeByCard(cardNo: string): Promise<string | null> {
    try {
      const body = {
        CardInfoSearchCond: {
          searchID: `card_${Date.now()}`,
          searchResultPosition: 0,
          maxResults: 10,
          CardNoList: [{ cardNo }],
        },
      };

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/CardInfo/Search?format=json`,
        this.config.username,
        this.config.password,
        "POST",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );

      if (response.status !== 200) {
        return null;
      }

      const data = JSON.parse(response.body);
      const searchResult = data?.CardInfoSearch;

      if (!searchResult || searchResult.responseStatusStrg !== "OK") {
        return null;
      }

      const cards = searchResult.CardInfo;
      if (!cards || cards.length === 0) {
        return null;
      }

      return cards[0].employeeNo ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Delete card info for a specific employee from the device.
   * DELETE /ISAPI/AccessControl/CardInfo/Record?format=json
   */
  private async deleteCardInfo(employeeNo: string, cardNo: string): Promise<void> {
    try {
      const body = {
        CardInfoDelCond: {
          employeeNo,
          cardNoList: [cardNo],
        },
      };

      await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/CardInfo/Record?format=json`,
        this.config.username,
        this.config.password,
        "DELETE",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );
    } catch (err) {
      log.warn("hikvision", "Failed to delete card info", { employeeNo, cardNo, error: (err as Error).message });
    }
  }

  /**
   * Assign a card to an existing person on the device.
   * POST /ISAPI/AccessControl/CardInfo/Record?format=json
   */
  async assignCardToDevice(employeeNo: string, cardNo: string): Promise<SyncResult> {
    try {
      const body = {
        CardInfo: {
          employeeNo: employeeNo,
          cardNo: cardNo,
          cardType: "normalCard",
        },
      };

      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/AccessControl/CardInfo/Record?format=json`,
        this.config.username,
        this.config.password,
        "POST",
        JSON.stringify(body),
        "application/json",
        this.config.rejectUnauthorized
      );

      if (response.status !== 200 && response.status !== 201) {
        return {
          success: false,
          employeeNo,
          error: `Card assign failed: ${response.status}`,
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

  /**
   * Sync person: search first, then update or create.
   * This implements the search→update/create pattern per validated ISAPI docs.
   */
  async syncPerson(person: Person): Promise<SyncResult> {
    const employeeNo = person.employeeNo || person.employeeId || '';

    // Step 1: Search to see if person exists on device
    const existing = await this.searchPersonOnDevice(employeeNo);

    if (existing) {
      // Step 2a: Person exists — update
      return this.updatePersonOnDevice(person);
    } else {
      // Step 2b: Person doesn't exist — create
      return this.createPersonOnDevice(person);
    }
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await digestRequest(
        `${this.baseUrl}/ISAPI/System/deviceInfo`,
        this.config.username,
        this.config.password,
        "GET",
        undefined,
        "application/xml; charset=utf-8",
        this.config.rejectUnauthorized
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

  private mapVerifyMode(code: string | number | undefined): string {
    // DS-K1T320MFWX returns string codes like "invalid", "cardOrFaceOrFp"
    if (typeof code === "string") {
      const stringModes: Record<string, string> = {
        invalid: "invalid",
        password: "password",
        card: "card",
        fingerprint: "fingerprint",
        face: "face",
        cardAndPassword: "card_and_password",
        cardAndFingerprint: "card_and_fingerprint",
        faceAndPassword: "face_and_password",
        cardOrFaceOrFp: "card_or_face_or_fp",
      };
      return stringModes[code] || code;
    }
    // Numeric codes for backward compatibility
    if (code === undefined) {
      return "unknown";
    }
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
