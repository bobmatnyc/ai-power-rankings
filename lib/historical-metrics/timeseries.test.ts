import { describe, expect, it } from "vitest";
import {
  interpolateMonthly,
  periodToTime,
  sumMonthlyDownloads,
  type DailyDownload,
} from "./timeseries";

const days: DailyDownload[] = [
  { day: "2025-11-30", downloads: 100 }, // out of window (Nov)
  { day: "2025-12-01", downloads: 10 },
  { day: "2025-12-15", downloads: 20 },
  { day: "2025-12-31", downloads: 30 },
  { day: "2026-01-01", downloads: 5 },
  { day: "2026-01-02", downloads: 7 },
];

describe("sumMonthlyDownloads", () => {
  it("sums only the days within the target calendar month", () => {
    expect(sumMonthlyDownloads(days, "2025-12")).toBe(60);
    expect(sumMonthlyDownloads(days, "2026-01")).toBe(12);
  });

  it("returns 0 for a month with no matching days", () => {
    expect(sumMonthlyDownloads(days, "2026-05")).toBe(0);
  });

  it("ignores malformed entries and coerces non-numbers to 0", () => {
    const messy = [
      { day: "2026-02-01", downloads: 4 },
      { day: "2026-02-02", downloads: Number.NaN },
      { day: undefined as unknown as string, downloads: 9 },
    ];
    expect(sumMonthlyDownloads(messy, "2026-02")).toBe(4);
  });

  it("rejects a malformed period argument", () => {
    expect(() => sumMonthlyDownloads(days, "2026")).toThrow(/YYYY-MM/);
    expect(() => sumMonthlyDownloads(days, "Dec-2025")).toThrow();
  });
});

describe("periodToTime", () => {
  it("maps a period to the first-of-month UTC timestamp", () => {
    expect(periodToTime("2026-01")).toBe(Date.UTC(2026, 0, 1));
    expect(periodToTime("2025-12")).toBe(Date.UTC(2025, 11, 1));
  });
});

describe("interpolateMonthly", () => {
  it("returns the exact endpoints at the anchor months", () => {
    expect(interpolateMonthly(0, "2026-01", 600, "2026-07", "2026-01")).toBe(0);
    expect(interpolateMonthly(0, "2026-01", 600, "2026-07", "2026-07")).toBe(600);
  });

  it("linearly interpolates by calendar days between anchors", () => {
    // 100 -> 400 from Jan 1 to Jul 1 (181 days); Apr 1 is 90 days in
    // => 100 + 300 * (90/181) = 249.17 -> 249 (day-weighted, not month-count).
    expect(interpolateMonthly(100, "2026-01", 400, "2026-07", "2026-04")).toBe(249);
  });

  it("clamps below the start and above the end anchors", () => {
    expect(interpolateMonthly(100, "2026-03", 400, "2026-06", "2026-01")).toBe(100);
    expect(interpolateMonthly(100, "2026-03", 400, "2026-06", "2026-12")).toBe(400);
  });

  it("handles equal anchors without dividing by zero", () => {
    expect(interpolateMonthly(50, "2026-03", 90, "2026-03", "2026-03")).toBe(90);
  });

  it("rounds to an integer", () => {
    // 0 -> 100 from Jan 1 to Apr 1 (90 days); Feb 1 is 31 days in
    // => 100 * (31/90) = 34.44 -> 34.
    expect(interpolateMonthly(0, "2026-01", 100, "2026-04", "2026-02")).toBe(34);
  });
});
