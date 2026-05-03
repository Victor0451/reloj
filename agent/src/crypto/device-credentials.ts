/**
 * Device Credentials Encryption/Decryption
 *
 * Uses AES-256-GCM with a versioned payload format to allow future key rotation.
 *
 * Payload format: v1:<keyId>:<ivBase64>:<authTagBase64>:<ciphertextBase64>
 *
 * Env vars:
 *   DEVICE_CREDENTIAL_ACTIVE_KEY_ID  - ID of key to use for encryption
 *   DEVICE_CREDENTIAL_KEYS_JSON      - JSON object { "keyId": "hexKey" }
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const PAYLOAD_VERSION = "v1";

/** Thrown when decryption fails due to config or data issues */
export class CryptoError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "KEY_MISSING"
      | "KEY_NOT_FOUND"
      | "INVALID_PAYLOAD"
      | "DECRYPT_FAILED"
      | "ENCRYPT_FAILED"
  ) {
    super(message);
    this.name = "CryptoError";
  }
}

interface KeyEntry {
  key: string; // hex-encoded 32-byte key
}

interface KeysJson {
  [keyId: string]: string;
}

/** Get the active key ID from env */
function getActiveKeyId(): string {
  const keyId = process.env.DEVICE_CREDENTIAL_ACTIVE_KEY_ID;
  if (!keyId) {
    throw new CryptoError(
      "DEVICE_CREDENTIAL_ACTIVE_KEY_ID env var is not set",
      "KEY_MISSING"
    );
  }
  return keyId;
}

/** Load all keys from DEVICE_CREDENTIAL_KEYS_JSON env var */
function loadKeys(): KeysJson {
  const keysJson = process.env.DEVICE_CREDENTIAL_KEYS_JSON;
  if (!keysJson) {
    throw new CryptoError(
      "DEVICE_CREDENTIAL_KEYS_JSON env var is not set",
      "KEY_MISSING"
    );
  }
  try {
    return JSON.parse(keysJson) as KeysJson;
  } catch {
    throw new CryptoError(
      "DEVICE_CREDENTIAL_KEYS_JSON is not valid JSON",
      "INVALID_PAYLOAD"
    );
  }
}

/** Get the active hex key for encryption */
function getActiveKey(): { keyId: string; key: Buffer } {
  const keyId = getActiveKeyId();
  const keys = loadKeys();
  const hexKey = keys[keyId];
  if (!hexKey) {
    throw new CryptoError(
      `No key found for active key ID "${keyId}"`,
      "KEY_NOT_FOUND"
    );
  }
  return { keyId, key: Buffer.from(hexKey, "hex") };
}

/** Get a key by its ID (for decryption) */
function getKeyById(keyId: string): Buffer | null {
  const keys = loadKeys();
  const hexKey = keys[keyId];
  if (!hexKey) {
    return null;
  }
  return Buffer.from(hexKey, "hex");
}

/**
 * Encrypt a plaintext device password.
 * Returns a versioned payload: v1:<keyId>:<iv>:<tag>:<ciphertext>
 */
export function encryptDevicePassword(plaintext: string): string {
  if (!plaintext) {
    throw new CryptoError("Cannot encrypt empty password", "ENCRYPT_FAILED");
  }

  const { keyId, key } = getActiveKey();

  // Generate random IV for each encryption
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Payload: v1:<keyId>:<ivBase64>:<authTagBase64>:<ciphertextBase64>
  return [
    PAYLOAD_VERSION,
    keyId,
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext,
  ].join(":");
}

/**
 * Decrypt a device password payload.
 * Handles:
 *   - v1: versioned payloads (current)
 *   - Legacy plaintext (no prefix, direct password)
 */
export function decryptDevicePassword(payload: string): string {
  if (!payload || payload.length === 0) {
    throw new CryptoError("Cannot decrypt empty payload", "DECRYPT_FAILED");
  }

  // Legacy fallback: plaintext password (no encryption prefix)
  if (!payload.startsWith(`${PAYLOAD_VERSION}:`)) {
    return payload;
  }

  const parts = payload.split(":");
  if (parts.length !== 5) {
    throw new CryptoError(
      `Invalid v1 payload format: expected 5 parts, got ${parts.length}`,
      "INVALID_PAYLOAD"
    );
  }

  const [, keyId, ivBase64, authTagBase64, ciphertextBase64] = parts;

  const key = getKeyById(keyId);
  if (!key) {
    throw new CryptoError(
      `Key "${keyId}" not found in key ring`,
      "KEY_NOT_FOUND"
    );
  }

  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const ciphertext = ciphertextBase64;

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, "base64", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
  } catch (err) {
    throw new CryptoError(
      `Decryption failed: ${err instanceof Error ? err.message : "unknown"}`,
      "DECRYPT_FAILED"
    );
  }
}

/** Check if a payload is already encrypted (v1 format) */
export function isEncryptedPayload(payload: string): boolean {
  return Boolean(payload && payload.startsWith(`${PAYLOAD_VERSION}:`));
}
