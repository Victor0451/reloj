import type { Config } from "../config";

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

async function digestFetch(
  url: string,
  username: string,
  password: string,
  method: "GET" | "PUT" | "POST" = "GET",
  body?: string
): Promise<Response> {
  // digest-fetch package for Digest Auth
  const DigestFetch = (await import("digest-fetch")).default;
  // Constructor: (username, password, options?)
  const client = new DigestFetch(username, password, { algorithm: "MD5" });

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  };

  if (body) {
    options.body = body;
  }

  return client.fetch(url, options);
}

export async function isapiRequest<T = unknown>(
  config: Config,
  path: string,
  method: "GET" | "PUT" | "POST" = "GET",
  body?: string
): Promise<IsapiResponse<T>> {
  const url = `${buildBaseUrl(config)}${path}`;

  const response = await digestFetch(
    url,
    config.deviceUsername,
    config.devicePassword,
    method,
    body
  );

  const rawText = await response.text();

  if (!response.ok) {
    const err: IsapiError = new Error(
      `ISAPI ${method} ${path} failed: ${response.status} ${response.statusText}`
    );
    err.statusCode = response.status;
    throw err;
  }

  return {
    statusCode: response.status,
    data: rawText as unknown as T,
    rawXml: rawText,
  };
}
