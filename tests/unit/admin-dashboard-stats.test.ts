import { describe, expect, it } from "vitest";

import { buildDashboardStats } from "../../components/payload/admin-dashboard-stats";

/**
 * Regression tests for the admin dashboard's counts (#140 follow-up).
 *
 * Why: `AdminDashboard` read `totalDocs` off `/api/news`, `/api/tools` and
 * `/api/rankings`. `totalDocs` is the Payload CMS collection shape and none of
 * those routes returns it, so all three counts fell through `|| 0` and rendered
 * a zero that looked exactly like a real one. Reading `docs[0].period` for the
 * ranking period failed the same way.
 * What: the fixtures below are the routes' actual success bodies, copied field
 * for field from `app/api/news/route.ts`, `app/api/tools/route.ts` and
 * `app/api/rankings/route.ts` — none of them carries a `totalDocs` key, which
 * `omits every totalDocs field` pins directly. Any implementation reading
 * `totalDocs` therefore reports `null` here and fails these assertions.
 * Test: `npx vitest run tests/unit/admin-dashboard-stats.test.ts`. Pure
 * mapping; no fetch, no database, no network.
 */

/** `GET /api/news?limit=1` — one row in `news`, the full count in `total`. */
const newsBody = {
  news: [{ id: "a1", slug: "some-article", title: "Some article" }],
  total: 128,
  hasMore: true,
  _source: "database",
  _timestamp: "2026-09-07T00:00:00.000Z",
};

/** `GET /api/tools` — the route takes no params and returns every active tool. */
const toolsBody = {
  tools: [
    { id: "t1", slug: "claude-code", name: "Claude Code" },
    { id: "t2", slug: "cursor", name: "Cursor" },
    { id: "t3", slug: "copilot", name: "GitHub Copilot" },
  ],
  _source: "database",
  _timestamp: "2026-09-07T00:00:00.000Z",
};

/** `GET /api/rankings` — the current-snapshot branch. */
const rankingsBody = {
  rankings: [{ rank: 1, tool: { id: "t1", slug: "claude-code" } }],
  published_at: "2026-08-31T12:00:00.000Z",
  period: "2026-08",
  algorithm: { version: "v7.9", name: "Database Rankings" },
  stats: { total_tools: 31, tools_with_news: 12, avg_news_boost: 0.4, max_news_impact: 2.1 },
  _source: "database",
  _timestamp: "2026-09-07T00:00:00.000Z",
};

/** `GET /api/rankings` — the no-rankings-yet branch: no `period`, no `published_at`. */
const emptyRankingsBody = {
  rankings: [],
  algorithm: { version: "v1.0", name: "No Rankings Available" },
  stats: { total_tools: 0, tools_with_news: 0, avg_news_boost: 0, max_news_impact: 0 },
  _source: "empty",
  _timestamp: "2026-09-07T00:00:00.000Z",
  _message: "No rankings data available. Please check back later.",
};

/** What `SubscribersManager` reads from `/api/admin/subscribers`. */
const subscribersBody = {
  stats: { total: 42, verified: 40, pending: 1, unsubscribed: 1 },
};

const allBodies = {
  tools: toolsBody,
  rankings: rankingsBody,
  news: newsBody,
  subscribers: subscribersBody,
};

describe("buildDashboardStats", () => {
  it("omits every totalDocs field the dashboard used to read", () => {
    for (const body of [newsBody, toolsBody, rankingsBody, emptyRankingsBody]) {
      expect(body).not.toHaveProperty("totalDocs");
      expect(body).not.toHaveProperty("docs");
    }
  });

  it("reads the news count from total, not totalDocs", () => {
    expect(buildDashboardStats(allBodies).totalNews).toBe(128);
  });

  it("counts tools from the returned array", () => {
    expect(buildDashboardStats(allBodies).totalTools).toBe(3);
  });

  it("reads the ranking count, period and publish date from the rankings body", () => {
    const stats = buildDashboardStats(allBodies);

    expect(stats.totalRankings).toBe(31);
    expect(stats.latestPeriod).toBe("2026-08");
    expect(stats.lastPublishedAt).toBe("2026-08-31T12:00:00.000Z");
  });

  it("reads the subscriber count from stats.total", () => {
    expect(buildDashboardStats(allBodies).totalSubscribers).toBe(42);
  });

  it("reports a real zero as 0, not as a failed fetch", () => {
    const stats = buildDashboardStats({
      tools: { tools: [] },
      rankings: emptyRankingsBody,
      news: { news: [], total: 0, hasMore: false },
      subscribers: { stats: { total: 0 } },
    });

    expect(stats.totalTools).toBe(0);
    expect(stats.totalRankings).toBe(0);
    expect(stats.totalNews).toBe(0);
    expect(stats.totalSubscribers).toBe(0);
  });

  it("leaves period and publish date unset on the no-rankings-yet branch", () => {
    const stats = buildDashboardStats({ ...allBodies, rankings: emptyRankingsBody });

    expect(stats.latestPeriod).toBeNull();
    expect(stats.lastPublishedAt).toBeNull();
  });

  it("reports null for a failed fetch without disturbing the other counts", () => {
    // /api/admin/subscribers has no route, so its fetch 404s and readJson() in
    // AdminDashboard.tsx hands this mapping a null.
    const stats = buildDashboardStats({ ...allBodies, subscribers: null });

    expect(stats.totalSubscribers).toBeNull();
    expect(stats.totalNews).toBe(128);
    expect(stats.totalTools).toBe(3);
    expect(stats.totalRankings).toBe(31);
  });

  it("reports null for every count when all four fetches fail", () => {
    const stats = buildDashboardStats({
      tools: null,
      rankings: null,
      news: null,
      subscribers: null,
    });

    expect(stats).toEqual({
      totalTools: null,
      totalRankings: null,
      totalNews: null,
      totalSubscribers: null,
      latestPeriod: null,
      lastPublishedAt: null,
    });
  });

  it("reports null rather than 0 for an error body that carries no counts", () => {
    // What a 500/503 from these routes returns: { error, message }.
    const errorBody = { error: "Internal server error", message: "An error occurred." };
    const stats = buildDashboardStats({
      tools: errorBody,
      rankings: errorBody,
      news: errorBody,
      subscribers: errorBody,
    });

    expect(stats.totalTools).toBeNull();
    expect(stats.totalRankings).toBeNull();
    expect(stats.totalNews).toBeNull();
    expect(stats.totalSubscribers).toBeNull();
  });
});
