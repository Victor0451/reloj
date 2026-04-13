import { z } from "zod";

const configSchema = z.object({
  supabaseUrl: z.string().url(),
  supabaseServiceRoleKey: z.string().min(10),
  deviceIp: z.string().ip(),
  devicePort: z.coerce.number().int().positive().default(443),
  deviceUsername: z.string().min(1),
  devicePassword: z.string().min(1),
  pollIntervalMs: z.coerce.number().int().positive().default(30000),
  heartbeatIntervalMs: z.coerce.number().int().positive().default(60000),
  doorPollIntervalMs: z.coerce.number().int().positive().default(10000),
  commandPollIntervalMs: z.coerce.number().int().positive().default(2000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const raw = {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    deviceIp: process.env.DEVICE_IP,
    devicePort: process.env.DEVICE_PORT,
    deviceUsername: process.env.DEVICE_USERNAME,
    devicePassword: process.env.DEVICE_PASSWORD,
    pollIntervalMs: process.env.POLL_INTERVAL_MS,
    heartbeatIntervalMs: process.env.HEARTBEAT_INTERVAL_MS,
    doorPollIntervalMs: process.env.DOOR_POLL_INTERVAL_MS,
    commandPollIntervalMs: process.env.COMMAND_POLL_INTERVAL_MS,
    logLevel: process.env.LOG_LEVEL,
  };

  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(
      `Invalid configuration:\n${errors}\n\nCheck your .env file against .env.example`
    );
  }

  return result.data;
}
