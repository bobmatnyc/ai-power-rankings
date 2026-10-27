import { describe, expect, it } from "vitest";
import { isoWeekKey, previousIsoWeek, windowForWeek } from "../../lib/weekly-digest-window";

/**
 * ISO-week window and key for the weekly digest (#181).
 *
 * Why: the digest is keyed by ISO week and reads the previous full Monday to
 * Sunday UTC week. ISO week-years differ from calendar years around 1 January,
 * and a wrong key would store a digest twice or never.
 * What: pure date maths, no database, no network.
 * Test: `npx vitest run tests/unit/weekly-digest-window-181.test.ts`.
 */

const iso = (d: Date) => d.toISOString();

describe("isoWeekKey (#181)", () => {
  it.each([
    ["2026-10-26T07:30:00Z", "2026-W44"], // a Monday
    ["2026-11-01T23:59:59Z", "2026-W44"], // the Sunday of that week
    ["2020-12-31T12:00:00Z", "2020-W53"], // 53-week year
    ["2021-01-03T12:00:00Z", "2020-W53"], // 2021 days that still belong to ISO 2020
    ["2021-01-04T00:00:00Z", "2021-W01"],
    ["2024-12-30T00:00:00Z", "2025-W01"], // December days that belong to the next ISO year
    ["2027-01-01T00:00:00Z", "2026-W53"],
  ])("%s is %s", (when, key) => {
    expect(isoWeekKey(new Date(when))).toBe(key);
  });
});

describe("previousIsoWeek (#181)", () => {
  it("on a Monday run returns the week that ended the day before, Monday to Sunday UTC", () => {
    const w = previousIsoWeek(new Date("2026-10-26T07:30:00Z"));
    expect(w.week).toBe("2026-W43");
    expect(iso(w.start)).toBe("2026-10-19T00:00:00.000Z");
    expect(iso(w.end)).toBe("2026-10-25T23:59:59.999Z");
  });

  it("gives the same window for any instant of the current week", () => {
    const monday = previousIsoWeek(new Date("2026-10-26T00:00:00Z"));
    const sunday = previousIsoWeek(new Date("2026-11-01T23:59:59Z"));
    expect(sunday).toEqual(monday);
  });

  it("crosses a year boundary: the Monday run of 5 January 2026 reads the week that began in 2025, keyed 2026-W01", () => {
    const w = previousIsoWeek(new Date("2026-01-05T07:30:00Z"));
    expect(w.week).toBe("2026-W01");
    expect(iso(w.start)).toBe("2025-12-29T00:00:00.000Z");
    expect(iso(w.end)).toBe("2026-01-04T23:59:59.999Z");
  });

  it("keys the last December week of 2025 as 2025-W52", () => {
    const w = previousIsoWeek(new Date("2025-12-29T07:30:00Z"));
    expect(w.week).toBe("2025-W52");
    expect(iso(w.end)).toBe("2025-12-28T23:59:59.999Z");
  });

  it("keys a week that spans 1 January by its ISO year", () => {
    const w = previousIsoWeek(new Date("2025-01-06T07:30:00Z"));
    expect(w.week).toBe("2025-W01");
    expect(iso(w.start)).toBe("2024-12-30T00:00:00.000Z");
    expect(iso(w.end)).toBe("2025-01-05T23:59:59.999Z");
  });

  it("returns W53 for the last week of a 53-week year", () => {
    const w = previousIsoWeek(new Date("2021-01-04T07:30:00Z"));
    expect(w.week).toBe("2020-W53");
    expect(iso(w.start)).toBe("2020-12-28T00:00:00.000Z");
  });
});

describe("windowForWeek (#181)", () => {
  it("round-trips a key to its window", () => {
    const w = windowForWeek("2026-W43");
    expect(w && iso(w.start)).toBe("2026-10-19T00:00:00.000Z");
    expect(w && iso(w.end)).toBe("2026-10-25T23:59:59.999Z");
  });

  it.each(["2026-W00", "2026-W54", "2026-43", "26-W43", "2026-W4", "weekly", "2025-W53", ""])(
    "rejects %j",
    (key) => {
      // 2025 has 52 ISO weeks, so its W53 does not exist.
      expect(windowForWeek(key)).toBeNull();
    }
  );

  it("accepts W53 only in a 53-week year", () => {
    expect(windowForWeek("2020-W53")?.week).toBe("2020-W53");
    expect(windowForWeek("2026-W53")?.week).toBe("2026-W53");
  });
});
