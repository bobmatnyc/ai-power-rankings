/**
 * #103: timestamp-without-time-zone values read as UTC.
 *
 * Why: every `timestamp` column holds a UTC wall clock with no zone. Parsed in the
 *   process TZ, the 06:00 UTC cron run read as 10:00 UTC under America/New_York and the
 *   gap check reported it four hours late.
 * What: Pins parseNaiveUtcTimestamp's rule, the driver parsers in naiveUtcTypes, and
 *   check-ingestion-gap.mjs reading a zone-less started_at. Every expectation is an
 *   absolute instant, so the file passes under any process TZ;
 *   naive-utc-timestamp-tz.test.ts runs the script under two zones explicitly.
 * Test: `npx vitest run tests/unit/naive-utc-timestamp.test.ts`, under TZ=UTC and
 *   TZ=America/New_York.
 */

import { describe, expect, it } from "vitest";
import {
  PG_TIMESTAMP_OID,
  naiveUtcTypes,
  parseNaiveUtcTimestamp,
} from "../../lib/db/naive-utc-timestamp.mjs";
import { evaluateIngestionRuns } from "../../scripts/check-ingestion-gap.mjs";

const iso = (value: unknown): string | null => {
  const date = parseNaiveUtcTimestamp(value);
  if (date === null) return null;
  return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString();
};

describe("parseNaiveUtcTimestamp", () => {
  it.each([
    ["Postgres text, microseconds", "2026-10-23 06:00:03.123456", "2026-10-23T06:00:03.123Z"],
    ["Postgres text, no fraction", "2026-10-23 06:00:03", "2026-10-23T06:00:03.000Z"],
    ["ISO T form, no zone", "2026-10-23T06:00:03.5", "2026-10-23T06:00:03.500Z"],
    ["date only", "2026-10-23", "2026-10-23T00:00:00.000Z"],
    ["timestamptz text, +00", "2026-10-23 06:00:03.123+00", "2026-10-23T06:00:03.123Z"],
    ["timestamptz text, -04", "2026-10-23 02:00:03-04", "2026-10-23T06:00:03.000Z"],
    ["half-hour offset", "2026-10-23 11:30:03+05:30", "2026-10-23T06:00:03.000Z"],
    ["ISO Z", "2026-10-23T06:00:03.123Z", "2026-10-23T06:00:03.123Z"],
    ["epoch ms", Date.parse("2026-10-23T06:00:03.123Z"), "2026-10-23T06:00:03.123Z"],
    ["Date", new Date("2026-10-23T06:00:03.123Z"), "2026-10-23T06:00:03.123Z"],
    ["infinity", "infinity", "invalid"],
    ["null", null, null],
    ["undefined", undefined, null],
  ])("%s", (_label, input, expected) => {
    expect(iso(input)).toBe(expected);
  });

  it("returns a copy of a Date, never the caller's object", () => {
    const original = new Date("2026-10-23T06:00:03.123Z");
    expect(parseNaiveUtcTimestamp(original)).not.toBe(original);
  });
});

describe("naiveUtcTypes", () => {
  it("parses timestamp (OID 1114) text as UTC", () => {
    const parse = naiveUtcTypes.getTypeParser(PG_TIMESTAMP_OID, "text");
    expect((parse("2026-10-23 06:00:03.123") as Date).toISOString()).toBe("2026-10-23T06:00:03.123Z");
  });

  it("leaves timestamptz and other types on the driver default", () => {
    const tz = naiveUtcTypes.getTypeParser(1184, "text");
    expect((tz("2026-10-23 06:00:03.123+00") as Date).toISOString()).toBe("2026-10-23T06:00:03.123Z");
    expect(naiveUtcTypes.getTypeParser(23, "text")("42")).toBe(42);
  });
});

describe("check-ingestion-gap reads a zone-less started_at as UTC", () => {
  it("dates and ages the 2026-10-23 06:00 UTC run from its UTC wall clock", () => {
    const now = Date.parse("2026-10-23T17:00:03.123Z");
    const result = evaluateIngestionRuns(
      [{ started_at: "2026-10-23 06:00:03.123", status: "completed", articles_ingested: 2, error_log: [] }],
      now
    );

    expect(result.lines[0]).toBe(
      "OK: last ingestion run 11.0h ago (2026-10-23T06:00:03.123Z), status='completed', 2 articles ingested"
    );
    expect(result.lines).toContain("LAST_RUN_STARTED=2026-10-23T06:00:03.123Z");
  });
});
