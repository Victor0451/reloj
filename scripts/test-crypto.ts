/**
 * Unit tests for crypto/device-credentials.ts
 *
 * Run with:
 *   npx ts-node scripts/test-crypto.ts
 */

import {
  encryptDevicePassword,
  decryptDevicePassword,
  isEncryptedPayload,
  CryptoError,
} from "../src/lib/crypto/device-credentials";

// Mock env vars for testing
process.env.DEVICE_CREDENTIAL_ACTIVE_KEY_ID = "test-key-1";
process.env.DEVICE_CREDENTIAL_KEYS_JSON = JSON.stringify({
  "test-key-1": "a".repeat(64), // 32 bytes hex = 64 chars
});

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err}`);
    process.exit(1);
  }
}

function assertEqual(actual: any, expected: any, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed${message ? `: ${message}` : ""}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    );
  }
}

function assertThrows(fn: () => void, code: string) {
  try {
    fn();
    throw new Error(`Expected function to throw, but it didn't`);
  } catch (err: any) {
    if (err instanceof CryptoError && err.code === code) {
      return; // Expected
    }
    if (err.message === `Expected function to throw, but it didn't`) {
      throw err;
    }
    throw err;
  }
}

console.log("🧪 Testing crypto/device-credentials.ts\n");

test("encryptDevicePassword produces v1: prefixed payload", () => {
  const encrypted = encryptDevicePassword("my-secret-password");
  assertEqual(encrypted.startsWith("v1:"), true);
});

test("encryptDevicePassword produces 5 parts", () => {
  const encrypted = encryptDevicePassword("my-secret-password");
  const parts = encrypted.split(":");
  assertEqual(parts.length, 5);
  assertEqual(parts[0], "v1");
  assertEqual(parts[1], "test-key-1");
});

test("decryptDevicePassword returns original plaintext", () => {
  const original = "my-secret-password";
  const encrypted = encryptDevicePassword(original);
  const decrypted = decryptDevicePassword(encrypted);
  assertEqual(decrypted, original);
});

test("isEncryptedPayload returns true for v1: payload", () => {
  const encrypted = encryptDevicePassword("test");
  assertEqual(isEncryptedPayload(encrypted), true);
});

test("isEncryptedPayload returns false for plaintext", () => {
  assertEqual(isEncryptedPayload("plaintext-password"), false);
});

test("decryptDevicePassword handles legacy plaintext (no prefix)", () => {
  const legacy = "legacy-plaintext-password";
  const decrypted = decryptDevicePassword(legacy);
  assertEqual(decrypted, legacy);
});

test("decryptDevicePassword throws on empty payload", () => {
  assertThrows(() => decryptDevicePassword(""), "DECRYPT_FAILED");
});

test("encryptDevicePassword throws on empty password", () => {
  assertThrows(() => encryptDevicePassword(""), "ENCRYPT_FAILED");
});

test("decryptDevicePassword throws on invalid v1 format (wrong parts)", () => {
  assertThrows(() => decryptDevicePassword("v1:key:iv"), "INVALID_PAYLOAD");
});

test("decryptDevicePassword throws on unknown key id", () => {
  // Corrupt the key id in the payload
  const encrypted = encryptDevicePassword("test");
  const parts = encrypted.split(":");
  parts[1] = "nonexistent-key";
  const corrupted = parts.join(":");
  assertThrows(() => decryptDevicePassword(corrupted), "KEY_NOT_FOUND");
});

test("encryptDevicePassword throws when no env vars set", () => {
  delete process.env.DEVICE_CREDENTIAL_ACTIVE_KEY_ID;
  delete process.env.DEVICE_CREDENTIAL_KEYS_JSON;
  assertThrows(() => encryptDevicePassword("test"), "KEY_MISSING");
});

console.log("\n✅ All tests passed!");
