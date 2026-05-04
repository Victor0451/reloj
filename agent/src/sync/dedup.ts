export interface DedupEventLike {
  employeeId: string;
  eventTime: Date | string;
  cardReaderNo?: number | null;
}

/**
 * Create a composite deduplication key for an access event.
 * Canonical format: employeeId|<unix-ms>|<cardReaderNo-or-0>
 */
export function createDedupKey(event: DedupEventLike): string {
  const employeeId = event.employeeId || "";
  const eventTimeMs =
    typeof event.eventTime === "string"
      ? new Date(event.eventTime).getTime()
      : event.eventTime.getTime();
  const cardReaderNo = event.cardReaderNo ?? 0;

  return `${employeeId}|${eventTimeMs}|${cardReaderNo}`;
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

  isDuplicate(event: DedupEventLike): boolean {
    const key = createDedupKey(event);

    if (this.seenKeys.has(key)) {
      return true;
    }

    this.seenKeys.add(key);

    // Prevent unbounded growth
    if (this.seenKeys.size > this.maxSize) {
      // Remove oldest entries (first 50%)
      const keys = Array.from(this.seenKeys);
      this.seenKeys.clear();
      for (const k of keys.slice(keys.length / 2)) {
        this.seenKeys.add(k);
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
