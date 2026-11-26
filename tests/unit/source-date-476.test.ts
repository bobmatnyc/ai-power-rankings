import { describe, expect, it } from "vitest";
import { normalizeSourceDate, parseSourceDate } from "../../lib/services/source-date.mjs";

/**
 * Why: #476 — Tavily's RFC 2822 `published_date` was stored raw and the gap
 * detector printed `sourceDate=invalid` for every 2026-11-25 candidate.
 */
describe("normalizeSourceDate (#476)", () => {
  it.each([
    ["Sun, 22 Nov 2026 06:00:00 GMT", "2026-11-22T06:00:00.000Z"],
    ["22 Nov 2026 06:00 +0200", "2026-11-22T04:00:00.000Z"],
    ["Mon, 23 Nov 2026 01:15:00 -0500", "2026-11-23T06:15:00.000Z"],
    ["Mon, 23 Nov 2026 01:15:00 EST", "2026-11-23T06:15:00.000Z"],
    ["2026-11-22T10:00:00.000Z", "2026-11-22T10:00:00.000Z"],
    ["2026-11-22T10:00:00+02:00", "2026-11-22T08:00:00.000Z"],
    // A zone-less ISO value is UTC, as everywhere else in the project (#103).
    ["2026-11-22 10:00:00", "2026-11-22T10:00:00.000Z"],
    ["2026-11-22", "2026-11-22T00:00:00.000Z"],
  ])("stores %j as %j", (raw, iso) => {
    expect(normalizeSourceDate(raw)).toBe(iso);
  });

  it.each(["2 days ago", "Tue, 31 Feb 2026 00:00:00 GMT", "Sun, 22 Foo 2026 06:00:00 GMT", "2026-11-22\nALERT[STALLED]"])(
    "keeps unparseable %j as the raw text",
    (raw) => {
      expect(normalizeSourceDate(raw)).toBe(raw);
    }
  );

  it("stores an absent date as null", () => {
    expect(normalizeSourceDate(null)).toBeNull();
    expect(normalizeSourceDate(undefined)).toBeNull();
    expect(normalizeSourceDate("")).toBeNull();
  });
});

describe("parseSourceDate (#476)", () => {
  it("reads stored ISO text, Date values and RFC 2822 text, and returns null otherwise", () => {
    expect(parseSourceDate("Sun, 22 Nov 2026 06:00:00 GMT")?.toISOString()).toBe("2026-11-22T06:00:00.000Z");
    expect(parseSourceDate(new Date("2026-11-22T06:00:00Z"))?.toISOString()).toBe("2026-11-22T06:00:00.000Z");
    expect(parseSourceDate("yesterday at noon")).toBeNull();
    expect(parseSourceDate(null)).toBeNull();
  });
});
