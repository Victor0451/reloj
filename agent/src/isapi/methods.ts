import type { Config } from "../config";
import { isapiRequest } from "./client";
import { parseXml, extractText } from "./xml";

// ─── Types ───────────────────────────────────────────────────────────────

export interface DeviceInfo {
  serialNumber: string;
  model: string;
  firmwareVersion: string;
  deviceName: string;
  raw?: Record<string, unknown>;
}

export interface AcsEvent {
  employeeId: string;
  eventTime: string;
  major: number;
  minor: number;
  eventType: string;
  verifyMode: string;
  raw?: Record<string, unknown>;
}

export interface DoorStatus {
  doorNo: number;
  status: "open" | "closed" | "alarm" | "unknown";
  raw?: Record<string, unknown>;
}

// ─── ISAPI Endpoints ─────────────────────────────────────────────────────

const ENDPOINTS = {
  deviceInfo: "/ISAPI/System/deviceInfo",
  acsEvents: "/ISAPI/AccessControl/AcsEvent",
  doorStatus: "/ISAPI/AccessControl/Door/status/1",
  doorControl: "/ISAPI/AccessControl/RemoteControl/door/1",
} as const;

// ─── Typed Methods ───────────────────────────────────────────────────────

/**
 * Fetch device information via ISAPI.
 * Returns serial number, model, firmware version, etc.
 */
export async function getDeviceInfo(config: Config): Promise<DeviceInfo> {
  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.deviceInfo,
    "GET"
  );

  const parsed = parseXml(response.rawXml ?? "");

  // Hikvision ISAPI wraps data in <DeviceInfo> or similar root element
  // We need to navigate the parsed structure
  const serialNumber = extractText(parsed, ["DeviceInfo", "serialNumber"]) ?? "unknown";
  const model = extractText(parsed, ["DeviceInfo", "model"]) ?? "unknown";
  const firmwareVersion = extractText(parsed, ["DeviceInfo", "firmwareVersion"]) ?? "unknown";
  const deviceName = extractText(parsed, ["DeviceInfo", "deviceName"]) ?? "Device";

  return {
    serialNumber,
    model,
    firmwareVersion,
    deviceName,
    raw: parsed,
  };
}

/**
 * Fetch access control events (fichajes) from the device.
 * Returns a list of events since the given startTime.
 */
export async function getAcsEvents(
  config: Config,
  options?: { startTime?: string; endTime?: string; maxResults?: number }
): Promise<AcsEvent[]> {
  const startTime = options?.startTime ?? new Date(Date.now() - 300000).toISOString(); // last 5 min
  const endTime = options?.endTime ?? new Date().toISOString();
  const maxResults = options?.maxResults ?? 50;

  // ISAPI AcsEvent expects an XML body with search criteria
  // Note: Values come from trusted sources (config or new Date()) but we sanitize for defense-in-depth
  const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<searchEvents>
  <searchID>1</searchID>
  <searchResultPosition>0</searchResultPosition>
  <maxResults>${escapeXml(String(maxResults))}</maxResults>
  <timeSearchType>dateTime</timeSearchType>
  <searchStartTime>${escapeXml(startTime)}</searchStartTime>
  <searchEndTime>${escapeXml(endTime)}</searchEndTime>
  <eventTypes>
    <eventType>access</eventType>
  </eventTypes>
</searchEvents>`;

  const response = await isapiRequest<Record<string, unknown>>(
    config,
    ENDPOINTS.acsEvents,
    "POST",
    requestBody
  );

  const parsed = parseXml(response.rawXml ?? "") as Record<string, unknown>;

  // Parse events from XML — structure varies by device firmware
  // This is a best-effort parser; adjust based on actual device responses
  const events: AcsEvent[] = [];

  // Try common ISAPI response structures
  const responseStatus = parsed.responseStatus as Record<string, unknown> | undefined;
  const searchResult = parsed.searchResult as Record<string, unknown> | undefined;

  const matchList = (
    (responseStatus?.searchResult as Record<string, unknown>)?.matchList ??
    (searchResult as Record<string, unknown>)?.matchList
  ) as Record<string, unknown> | undefined;

  const matchItem = matchList?.matchItem;

  const items = Array.isArray(matchItem) ? matchItem : matchItem ? [matchItem] : [];

  for (const item of items) {
    const obj = item as Record<string, unknown>;
    const eventDesc = obj.eventDescription as Record<string, unknown> | undefined;
    events.push({
      employeeId: String(obj.employeeNo ?? obj.cardNo ?? "unknown"),
      eventTime: String(obj.time ?? new Date().toISOString()),
      major: Number(obj.majorEventType ?? 0),
      minor: Number(obj.minorEventType ?? 0),
      eventType: mapEventType(Number(obj.majorEventType ?? 0), Number(obj.minorEventType ?? 0)),
      verifyMode: mapVerifyMode(Number(eventDesc?.verificationMode ?? 0)),
      raw: obj,
    });
  }

  return events;
}

/**
 * Get current door status (open/closed/alarm).
 */
export async function getDoorStatus(config: Config, doorNo = 1): Promise<DoorStatus> {
  const response = await isapiRequest<Record<string, unknown>>(
    config,
    `${ENDPOINTS.doorStatus}/${doorNo}`,
    "GET"
  );

  const parsed = parseXml(response.rawXml ?? "");

  const statusText = extractText(parsed, ["DoorStatus", "doorStatus"]) ?? "unknown";
  const status = mapDoorStatus(statusText);

  return {
    doorNo,
    status,
    raw: parsed,
  };
}

/**
 * Send a remote door control command (open/close).
 */
export async function controlDoor(
  config: Config,
  doorNo: number,
  action: "open" | "close" | "alwaysopen" | "alwaysclose"
): Promise<void> {
  const requestBody = `<?xml version="1.0" encoding="utf-8"?>
<RemoteControlDoor>
  <doorNo>${doorNo}</doorNo>
  <controlType>${action}</controlType>
</RemoteControlDoor>`;

  await isapiRequest(
    config,
    `${ENDPOINTS.doorControl}/${doorNo}`,
    "PUT",
    requestBody
  );
}

// ─── Mapping Helpers ─────────────────────────────────────────────────────

function mapEventType(major: number, _minor: number): string {
  // Hikvision major event codes for Access Control
  switch (major) {
    case 1:
      return "access_granted";
    case 2:
      return "access_denied";
    case 3:
      return "door_open";
    case 4:
      return "door_close";
    case 5:
      return "duress_alarm";
    default:
      return `event_${major}`;
  }
}

function mapVerifyMode(code: number): string {
  // Verification mode codes
  switch (code) {
    case 1:
      return "password";
    case 2:
      return "card";
    case 3:
      return "fingerprint";
    case 4:
      return "face";
    case 5:
      return "card_and_password";
    case 6:
      return "card_and_fingerprint";
    default:
      return "unknown";
  }
}

function mapDoorStatus(text: string): DoorStatus["status"] {
  const lower = text.toLowerCase();
  if (lower.includes("open")) return "open";
  if (lower.includes("close")) return "closed";
  if (lower.includes("alarm")) return "alarm";
  return "unknown";
}

// ─── XML Sanitization ───────────────────────────────────────────────────

/**
 * Escape XML special characters to prevent injection.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
