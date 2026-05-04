/**
 * Unit tests for dedup.ts
 * Run: npx tsx --test agent/src/sync/dedup.test.ts
 */

import { createDedupKey, EventDeduplicator, type DedupEventLike } from "./dedup";
import { describe, it } from "node:test";
import assert from "node:assert";

describe("createDedupKey", () => {
  it("produces consistent key for Date input", () => {
    const event: DedupEventLike = {
      employeeId: "emp-123",
      eventTime: new Date("2026-05-03T10:00:00.000Z"),
      cardReaderNo: 1,
    };
    const key = createDedupKey(event);
    assert.ok(key.startsWith("emp-123|"), `key=${key}`);
    assert.ok(key.includes("|1"), `key=${key}`);
  });

  it("produces same key for ISO string input", () => {
    const dateEvent: DedupEventLike = {
      employeeId: "emp-123",
      eventTime: new Date("2026-05-03T10:00:00.000Z"),
      cardReaderNo: 1,
    };
    const stringEvent: DedupEventLike = {
      employeeId: "emp-123",
      eventTime: "2026-05-03T10:00:00.000Z",
      cardReaderNo: 1,
    };
    assert.strictEqual(createDedupKey(dateEvent), createDedupKey(stringEvent));
  });

  it("uses 0 for null/undefined cardReaderNo", () => {
    const withNull: DedupEventLike = {
      employeeId: "emp-123",
      eventTime: new Date("2026-05-03T10:00:00.000Z"),
      cardReaderNo: null as any,
    };
    const withUndefined: DedupEventLike = {
      employeeId: "emp-123",
      eventTime: new Date("2026-05-03T10:00:00.000Z"),
      cardReaderNo: undefined,
    };
    const key = createDedupKey(withNull);
    assert.ok(key.endsWith("|0"), `key=${key}`);
    assert.strictEqual(createDedupKey(withNull), createDedupKey(withUndefined));
  });
});

describe("EventDeduplicator", () => {
  it("returns false (new) on first call", () => {
    const dedup = new EventDeduplicator();
    const event: DedupEventLike = {
      employeeId: "emp-1",
      eventTime: new Date(),
      cardReaderNo: 1,
    };
    assert.strictEqual(dedup.isDuplicate(event), false);
  });

  it("returns true (duplicate) on second call with same event", () => {
    const dedup = new EventDeduplicator();
    const event: DedupEventLike = {
      employeeId: "emp-1",
      eventTime: new Date("2026-05-03T10:00:00Z"),
      cardReaderNo: 1,
    };
    assert.strictEqual(dedup.isDuplicate(event), false);
    assert.strictEqual(dedup.isDuplicate(event), true);
  });

  it("keeps distinct employeeId events separate", () => {
    const dedup = new EventDeduplicator();
    const event1: DedupEventLike = {
      employeeId: "emp-1",
      eventTime: new Date("2026-05-03T10:00:00Z"),
      cardReaderNo: 1,
    };
    const event2: DedupEventLike = {
      employeeId: "emp-2",
      eventTime: new Date("2026-05-03T10:00:00Z"),
      cardReaderNo: 1,
    };
    assert.strictEqual(dedup.isDuplicate(event1), false);
    assert.strictEqual(dedup.isDuplicate(event2), false);
  });

  it("keeps distinct cardReaderNo events separate", () => {
    const dedup = new EventDeduplicator();
    const event1: DedupEventLike = {
      employeeId: "emp-1",
      eventTime: new Date("2026-05-03T10:00:00Z"),
      cardReaderNo: 1,
    };
    const event2: DedupEventLike = {
      employeeId: "emp-1",
      eventTime: new Date("2026-05-03T10:00:00Z"),
      cardReaderNo: 2,
    };
    assert.strictEqual(dedup.isDuplicate(event1), false);
    assert.strictEqual(dedup.isDuplicate(event2), false);
  });

  it("reset clears all keys", () => {
    const dedup = new EventDeduplicator();
    const event: DedupEventLike = {
      employeeId: "emp-1",
      eventTime: new Date("2026-05-03T10:00:00Z"),
      cardReaderNo: 1,
    };
    assert.strictEqual(dedup.isDuplicate(event), false);
    assert.strictEqual(dedup.isDuplicate(event), true);
    dedup.reset();
    assert.strictEqual(dedup.isDuplicate(event), false);
  });

  it("size reflects tracked keys", () => {
    const dedup = new EventDeduplicator();
    assert.strictEqual(dedup.size, 0);
    dedup.isDuplicate({ employeeId: "a", eventTime: new Date(), cardReaderNo: 1 });
    assert.strictEqual(dedup.size, 1);
    dedup.isDuplicate({ employeeId: "b", eventTime: new Date(), cardReaderNo: 1 });
    assert.strictEqual(dedup.size, 2);
  });
});
