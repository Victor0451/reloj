import { IsapiError } from '../isapi/client';

/**
 * Transient device error codes that indicate temporary failures.
 * These should NOT be treated as real errors — the sync can be retried.
 */
export enum TransientError {
  NOT_AVAILABLE = 'notAvailable',
  DEVICE_BUSY = 'deviceBusy',
  NO_MATCH = 'noMatch',
  MORE_DATA = 'moreData',
}

/**
 * Classifies whether an error is a "real" error that should be recorded,
 * versus a transient condition that can be safely retried.
 *
 * Current behavior:
 * - HTTP 401 (auth failure) → real error, don't retry
 * - IsapiError with transient code → not a real error, retry
 * - Generic errors → real error (conservative)
 *
 * Note: Device-level transient error codes (notAvailable, deviceBusy, etc.)
 * are defined but not yet consistently thrown — this function is forward-
 * compatible with proper error code propagation when that is implemented.
 */
export function isRealError(error: unknown): boolean {
  // HTTP auth failures — always fatal, never transient
  if (error instanceof IsapiError && error.statusCode === 401) {
    return true; // real error, don't retry
  }
  // Transient device errors — not real errors
  if (error instanceof IsapiError && error.code) {
    return !Object.values(TransientError).includes(error.code as TransientError);
  }
  // Fallback for generic errors — be conservative, treat as real error
  return true;
}