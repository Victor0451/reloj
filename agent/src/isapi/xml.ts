import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
});

/**
 * Parse ISAPI XML response into a JavaScript object.
 */
export function parseXml<T = Record<string, unknown>>(xml: string): T {
  const result = parser.parse(xml);
  return result as T;
}

/**
 * Safely extract a nested value from a parsed XML object.
 * Returns undefined if path doesn't exist.
 */
export function extractValue(
  obj: unknown,
  path: string[]
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Extract text value from a parsed XML element.
 * Handles both { "#text": "value" } and direct string forms.
 */
export function extractText(obj: unknown, path: string[]): string | undefined {
  const val = extractValue(obj, path);
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    return String((val as Record<string, unknown>)["#text"] ?? val);
  }
  return String(val);
}
