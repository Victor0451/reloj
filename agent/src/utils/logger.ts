export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  msg: string;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function formatLog(
  level: LogLevel,
  module: string,
  msg: string,
  data?: Record<string, unknown>
): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    msg,
    ...data,
  };
  return JSON.stringify(entry);
}

function log(level: LogLevel, module: string, msg: string, data?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] >= LEVEL_ORDER[currentLevel]) {
    const output = formatLog(level, module, msg, data);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

export function debug(module: string, msg: string, data?: Record<string, unknown>) {
  log("debug", module, msg, data);
}

export function info(module: string, msg: string, data?: Record<string, unknown>) {
  log("info", module, msg, data);
}

export function warn(module: string, msg: string, data?: Record<string, unknown>) {
  log("warn", module, msg, data);
}

export function error(
  module: string,
  msg: string,
  data?: Record<string, unknown> & { err?: Error }
) {
  const logData = data?.err
    ? { ...data, stack: data.err.stack, message: data.err.message }
    : data;
  log("error", module, msg, logData);
}
