/**
 * Daily live-site check verdicts.
 *
 * Why: the check gates a scheduled workflow; a verdict that never fails is no alarm.
 * What: feeds fixture responses and a fixed clock to scripts/lib/live-site-checks.mjs.
 * Test: runs under `npm run test:unit`; no network.
 */
import { describe, expect, it } from "vitest";
import {
  checkDigestPage,
  checkDigestRss,
  checkHomeTitle,
  checkMonthlyInsights,
  checkNewsApi,
  checkRankingsApi,
  checkRankingsPage,
  checkRootRedirect,
  checkStatus200,
  checkTtfb,
  digestWeekKey,
  formatResult,
  isoWeekKey,
  previousMonthKey,
  summarize,
} from "../../scripts/lib/live-site-checks.mjs";
import { isoWeekKey as appIsoWeekKey, previousIsoWeek } from "../../lib/weekly-digest-window";

const NOW = new Date("2026-11-18T12:00:00Z");
const res = (status: number, body = "", headers: Record<string, string> = {}) => ({ status, body, headers, ttfbMs: 100 });
const rankingsBody = (n: number, period = "2026-11", success = true) =>
  JSON.stringify({ success, data: { period, rankings: Array.from({ length: n }, (_, i) => ({ tool_id: String(i) })) } });
const toolLinks = (n: number) => Array.from({ length: n }, (_, i) => `<a href="/en/tools/tool-${i}">x</a>`).join("");

describe("page checks", () => {
  it("root redirect needs 307/308 to /en", () => {
    expect(checkRootRedirect(res(307, "", { location: "/en" })).level).toBe("PASS");
    expect(checkRootRedirect(res(308, "", { location: "https://aipowerranking.com/en" })).level).toBe("PASS");
    expect(checkRootRedirect(res(200)).level).toBe("FAIL");
    expect(checkRootRedirect(res(307, "", { location: "/de" })).level).toBe("FAIL");
    expect(checkRootRedirect({ error: "timeout" } as never).level).toBe("FAIL");
  });

  it("home needs 200 and a non-empty title", () => {
    expect(checkHomeTitle(res(200, "<title>AI Power Rankings</title>")).level).toBe("PASS");
    expect(checkHomeTitle(res(200, "<title>  </title>")).level).toBe("FAIL");
    expect(checkHomeTitle(res(500, "<title>x</title>")).level).toBe("FAIL");
  });

  it("rankings page needs >= 20 distinct tool links", () => {
    expect(checkRankingsPage(res(200, toolLinks(20))).level).toBe("PASS");
    expect(checkRankingsPage(res(200, toolLinks(19) + toolLinks(19))).level).toBe("FAIL");
  });

  it("status checks and digest pages need 200", () => {
    expect(checkStatus200("robots", res(200)).level).toBe("PASS");
    expect(checkStatus200("robots", res(404)).level).toBe("FAIL");
    expect(checkDigestPage(res(200), "2026-W46").level).toBe("PASS");
    expect(checkDigestPage(res(404), "2026-W46").level).toBe("FAIL");
  });

  it("rss must contain the week key", () => {
    expect(checkDigestRss(res(200, "<link>/weekly/2026-W46</link>"), "2026-W46").level).toBe("PASS");
    expect(checkDigestRss(res(200, "<link>/weekly/2026-W45</link>"), "2026-W46").level).toBe("FAIL");
  });

  it("monthly insights needs public cache-control (#470)", () => {
    expect(checkMonthlyInsights(res(200, "", { "cache-control": "public, max-age=0" }), "2026-10").level).toBe("PASS");
    expect(checkMonthlyInsights(res(200, "", { "cache-control": "private, no-store" }), "2026-10").level).toBe("FAIL");
    expect(checkMonthlyInsights(res(404), "2026-10").level).toBe("FAIL");
  });
});

describe("api checks", () => {
  it("rankings api needs success, >= 50 entries, current or previous month", () => {
    expect(checkRankingsApi(res(200, rankingsBody(50)), NOW).level).toBe("PASS");
    expect(checkRankingsApi(res(200, rankingsBody(60, "2026-10")), NOW).level).toBe("PASS");
    expect(checkRankingsApi(res(200, rankingsBody(49)), NOW).level).toBe("FAIL");
    expect(checkRankingsApi(res(200, rankingsBody(60, "2026-09")), NOW).level).toBe("FAIL");
    expect(checkRankingsApi(res(200, rankingsBody(60, "2026-11", false)), NOW).level).toBe("FAIL");
    expect(checkRankingsApi(res(200, "<html>"), NOW).level).toBe("FAIL");
  });

  it("news api needs newest event_date within 7 days", () => {
    const body = (...dates: string[]) => JSON.stringify({ news: dates.map((event_date) => ({ event_date })) });
    expect(checkNewsApi(res(200, body("2026-11-01T00:00:00Z", "2026-11-12T00:00:00Z")), NOW).level).toBe("PASS");
    expect(checkNewsApi(res(200, body("2026-11-10T00:00:00Z")), NOW).level).toBe("FAIL");
    expect(checkNewsApi(res(200, body()), NOW).level).toBe("FAIL");
  });
});

describe("week and month selection", () => {
  it("digest week flips at Monday 09:00Z", () => {
    // Monday 2026-11-16 is the first day of 2026-W47.
    expect(digestWeekKey(new Date("2026-11-16T08:59:59Z"))).toBe("2026-W45");
    expect(digestWeekKey(new Date("2026-11-16T09:00:00Z"))).toBe("2026-W46");
    expect(digestWeekKey(new Date("2026-11-22T23:59:59Z"))).toBe("2026-W46");
    expect(digestWeekKey(new Date("2026-11-15T23:00:00Z"))).toBe("2026-W45");
  });

  it("matches the app's previousIsoWeek after the cutoff, including the year turn", () => {
    for (const iso of ["2026-11-18T12:00:00Z", "2027-01-04T10:00:00Z", "2027-01-01T12:00:00Z"]) {
      const now = new Date(iso);
      if (now.getUTCDay() === 1 && now.getUTCHours() < 9) continue;
      expect(digestWeekKey(now)).toBe(previousIsoWeek(now).week);
      expect(isoWeekKey(now)).toBe(appIsoWeekKey(now));
    }
  });

  it("previous month wraps the year", () => {
    expect(previousMonthKey(NOW)).toBe("2026-10");
    expect(previousMonthKey(new Date("2027-01-05T00:00:00Z"))).toBe("2026-12");
  });
});

describe("ttfb and aggregation", () => {
  it("warns at 3 s and fails at 10 s", () => {
    expect(checkTtfb([{ path: "/", ttfbMs: 2999 }]).level).toBe("PASS");
    expect(checkTtfb([{ path: "/", ttfbMs: 100 }, { path: "/en", ttfbMs: 3000 }]).level).toBe("WARN");
    expect(checkTtfb([{ path: "/", ttfbMs: 10000 }]).level).toBe("FAIL");
  });

  it("exit code is 1 only when a FAIL is present", () => {
    const p = { level: "PASS", name: "a", detail: "ok" };
    const w = { level: "WARN", name: "b", detail: "slow" };
    const f = { level: "FAIL", name: "c", detail: "bad" };
    expect(summarize([p, w]).exitCode).toBe(0);
    expect(summarize([p, w, f])).toEqual({ line: "SUMMARY 1 pass, 1 warn, 1 fail", exitCode: 1 });
    expect(formatResult(f)).toBe("FAIL c bad");
  });
});
