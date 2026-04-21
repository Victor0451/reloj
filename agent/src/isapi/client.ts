import type { Config } from "../config";
import https from "node:https";
import http from "node:http";
import crypto from "node:crypto";

export interface IsapiResponse<T = unknown> {
  statusCode: number;
  data: T;
  rawXml?: string;
}

export interface IsapiError extends Error {
  statusCode?: number;
}

function buildBaseUrl(config: Config): string {
  const port = config.devicePort !== 443 ? `:${config.devicePort}` : "";
  return `https://${config.deviceIp}${port}`;
}

/**
 * Parse WWW-Authenticate Digest header
 */
function parseDigestParams(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  // Match key="value" or key=value patterns
  const regex = /(\w+)="([^"]+)"|(\w+)=([^\s,]+)/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    if (key && value) {
      params[key] = value;
    }
  }
  return params;
}

/**
 * Custom Digest Auth implementation for Hikvision devices
 */
async function digestFetch(
  url: string,
  username: string,
  password: string,
  method: "GET" | "PUT" | "POST" = "GET",
  body?: string,
  contentType: string = "application/xml; charset=utf-8"
): Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === "https:";

    const options: http.RequestOptions & { rejectUnauthorized?: boolean } = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        "Content-Type": contentType,
        "User-Agent": "Node.js ISAPI Client",
      },
      rejectUnauthorized: false, // Accept self-signed certs
    };

    const req = (isHttps ? https : http).request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const headers: Record<string, string | string[] | undefined> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          headers[key] = value;
        }

        if (res.statusCode === 200) {
          resolve({ status: res.statusCode || 200, body: data, headers });
          return;
        }

        if (res.statusCode === 401) {
          const authHeader = headers["www-authenticate"];
          if (typeof authHeader === "string" && authHeader.startsWith("Digest ")) {
            const params = parseDigestParams(authHeader);
            const nonce = params.nonce;
            const realm = params.realm;
            const qop = params.qop || "auth";
            const opaque = params.opaque;

            // Generate cnonce and nc
            const cnonce = crypto.randomBytes(16).toString("hex");
            const nc = "00000001";

            // HA1 = MD5(username:realm:password)
            const ha1 = crypto
              .createHash("md5")
              .update(`${username}:${realm}:${password}`)
              .digest("hex");

            // HA2 = MD5(method:uri)
            const uri = urlObj.pathname + urlObj.search;
            const ha2 = crypto
              .createHash("md5")
              .update(`${method}:${uri}`)
              .digest("hex");

            // response = MD5(HA1:nonce:nc:cnonce:qop:HA2)
            const response = crypto
              .createHash("md5")
              .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
              .digest("hex");

            // Build authorization header
            let authValue = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
            if (opaque) {
              authValue += `, opaque="${opaque}"`;
            }

            // Make authenticated request
            const authOptions: http.RequestOptions = {
              ...options,
              headers: {
                ...options.headers,
                Authorization: authValue,
              },
            };

            const authReq = (isHttps ? https : http)
              .request(authOptions, (authRes) => {
                let authData = "";
                authRes.on("data", (chunk) => {
                  authData += chunk;
                });
                authRes.on("end", () => {
                  const authHeaders: Record<string, string | string[] | undefined> = {};
                  for (const [key, value] of Object.entries(authRes.headers)) {
                    authHeaders[key] = value;
                  }
                  resolve({
                    status: authRes.statusCode || 500,
                    body: authData,
                    headers: authHeaders,
                  });
                });
              })
              .on("error", reject);

            if (body) {
              authReq.write(body);
            }
            authReq.end();
            return;
          }
        }

        resolve({ status: res.statusCode || 500, body: data, headers });
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

export async function isapiRequest<T = unknown>(
  config: Config,
  path: string,
  method: "GET" | "PUT" | "POST" = "GET",
  body?: string,
  contentType: string = "application/xml; charset=utf-8"
): Promise<IsapiResponse<T>> {
  const url = `${buildBaseUrl(config)}${path}`;

  const response = await digestFetch(
    url,
    config.deviceUsername,
    config.devicePassword,
    method,
    body,
    contentType
  );

  if (response.status >= 400) {
    const err: IsapiError = new Error(
      `ISAPI ${method} ${path} failed: ${response.status}`
    );
    err.statusCode = response.status;
    throw err;
  }

  return {
    statusCode: response.status,
    data: response.body as unknown as T,
    rawXml: response.body,
  };
}
