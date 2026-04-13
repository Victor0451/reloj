import * as log from "./logger";

/**
 * Set up top-level error handlers to prevent uncaught crashes.
 */
export function setupErrorHandlers() {
  process.on("uncaughtException", (err) => {
    log.error("agent", "Uncaught exception — logging but NOT exiting", {
      err,
    });
  });

  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    log.error("agent", "Unhandled promise rejection — logging but NOT exiting", {
      err,
    });
  });
}
