export interface DedupKey {
  employeeId: string;
  eventTime: string;
  major: number;
  minor: number;
}

/**
 * Create a composite deduplication key for an access event.
 */
export function createDedupKey(event: DedupKey): string {
  return `${event.employeeId}|${event.eventTime}|${event.major}|${event.minor}`;
}

/**
 * Check if a dedup key has been seen.
 * If not, mark it as seen and return true (new event).
 * If already seen, return false (duplicate).
 */
export class EventDeduplicator {
  private seenKeys: Set<string>;
  private maxSize: number;

  constructor(maxSize = 10000) {
    this.seenKeys = new Set();
    this.maxSize = maxSize;
  }

  isDuplicate(key: DedupKey): boolean {
    const composite = createDedupKey(key);

    if (this.seenKeys.has(composite)) {
      return true;
    }

    this.seenKeys.add(composite);

    // Prevent unbounded growth
    if (this.seenKeys.size > this.maxSize) {
      // Remove oldest entries (first 50%)
      const keys = Array.from(this.seenKeys);
      this.seenKeys.clear();
      for (const key of keys.slice(keys.length / 2)) {
        this.seenKeys.add(key);
      }
    }

    return false;
  }

  /**
   * Reset the deduplication state (e.g., on restart recovery).
   */
  reset() {
    this.seenKeys.clear();
  }

  get size(): number {
    return this.seenKeys.size;
  }
}
