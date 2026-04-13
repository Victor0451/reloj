export interface BackoffOptions {
  minDelay?: number;
  maxDelay?: number;
  jitterRange?: number;
}

const DEFAULT_OPTS: Required<BackoffOptions> = {
  minDelay: 1000,
  maxDelay: 60000,
  jitterRange: 1000,
};

/**
 * Calculate exponential backoff with jitter.
 * Formula: min(baseDelay * 2^attempt + jitter, maxDelay)
 */
export function calculateBackoff(
  attempt: number,
  opts?: BackoffOptions
): number {
  const { minDelay, maxDelay, jitterRange } = { ...DEFAULT_OPTS, ...opts };
  const baseDelay = minDelay * Math.pow(2, attempt);
  const jitter = Math.random() * jitterRange;
  return Math.min(baseDelay + jitter, maxDelay);
}

export interface RetryOptions extends BackoffOptions {
  maxAttempts?: number;
  onRetry?: (attempt: number, delay: number, err: Error) => void;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  ...DEFAULT_OPTS,
  maxAttempts: 5,
  onRetry: () => {},
};

/**
 * Wrap an async function with retry using exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOptions
): Promise<T> {
  const { maxAttempts, onRetry, ...backoffOpts } = {
    ...DEFAULT_RETRY,
    ...opts,
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxAttempts - 1) {
        const delay = calculateBackoff(attempt, backoffOpts);
        onRetry(attempt + 1, delay, lastError);
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Unknown error after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
