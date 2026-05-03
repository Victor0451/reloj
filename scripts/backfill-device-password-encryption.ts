/**
 * Backfill: Encrypt legacy plaintext device passwords
 *
 * Run this ONCE to migrate existing devices from plaintext to encrypted passwords.
 * Idempotent: safe to run multiple times. Only updates rows that need migration.
 *
 * Usage:
 *   npx tsx scripts/backfill-device-password-encryption.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { encryptDevicePassword, isEncryptedPayload } from "../src/lib/crypto/device-credentials";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

async function backfill() {
  console.log("🔐 Device Password Encryption Backfill");
  console.log("=====================================\n");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("📋 Fetching all devices...");
  const { data: devices, error: fetchError } = await (supabase as any)
    .from("devices")
    .select("id, name, ip_address, device_password_encrypted");

  if (fetchError) {
    console.error("❌ Failed to fetch devices:", fetchError.message);
    process.exit(1);
  }

  if (!devices || devices.length === 0) {
    console.log("✅ No devices found. Nothing to do.");
    return;
  }

  console.log(`📊 Found ${devices.length} device(s)\n`);

  const toMigrate: Array<{ id: string; name: string; ip_address: string | null; password: string }> = [];
  const alreadyEncrypted: string[] = [];
  const errors: Array<{ name: string; error: string }> = [];

  // Classify each device
  for (const device of devices) {
    const password = device.device_password_encrypted || "";

    if (!password) {
      // Skip devices with no password
      continue;
    }

    if (isEncryptedPayload(password)) {
      alreadyEncrypted.push(device.name);
    } else {
      toMigrate.push({
        id: device.id,
        name: device.name,
        ip_address: device.ip_address,
        password,
      });
    }
  }

  console.log(`📦 Status:`);
  console.log(`   - Already encrypted: ${alreadyEncrypted.length}`);
  console.log(`   - Need migration:    ${toMigrate.length}\n`);

  if (toMigrate.length === 0) {
    console.log("✅ All devices already have encrypted passwords.");
    return;
  }

  // Migrate each device
  console.log("🔄 Migrating devices...\n");
  let successCount = 0;
  let errorCount = 0;

  for (const device of toMigrate) {
    try {
      console.log(`   Migrating: ${device.name} (${device.ip_address})...`);

      const encryptedPassword = encryptDevicePassword(device.password);

      const { error: updateError } = await (supabase as any)
        .from("devices")
        .update({ device_password_encrypted: encryptedPassword })
        .eq("id", device.id);

      if (updateError) {
        console.error(`   ❌ Error updating ${device.name}: ${updateError.message}`);
        errors.push({ name: device.name, error: updateError.message });
        errorCount++;
      } else {
        console.log(`   ✅ ${device.name} migrated successfully`);
        successCount++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error(`   ❌ Unexpected error for ${device.name}: ${message}`);
      errors.push({ name: device.name, error: message });
      errorCount++;
    }
  }

  console.log("\n📋 Migration Summary:");
  console.log(`   - Success: ${successCount}`);
  console.log(`   - Errors:  ${errorCount}`);
  console.log(`   - Already encrypted: ${alreadyEncrypted.length}`);

  if (errors.length > 0) {
    console.log("\n❌ Devices that failed to migrate:");
    for (const { name, error } of errors) {
      console.log(`   - ${name}: ${error}`);
    }
    process.exit(1);
  }

  console.log("\n✅ Migration complete!");
}

backfill().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
