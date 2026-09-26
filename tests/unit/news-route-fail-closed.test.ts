import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #152 — `/api/news` fails closed and caches only success.
 *
 * Why: `NewsRepository.getPaginatedFiltered()` and `countFiltered()` turned a
 * failed database read into an empty page, so `/api/news` answered a 200 with
 * `news: []`. Its header, `public, max-age=0, s-maxage=300, ...,
 * must-revalidate, no-cache`, meant the CDN never stored even a good response.
 * What: `getDb()` is a real Drizzle instance over the pg-proxy driver, so the
 * real repository and the real route run end to end. The fake driver either
 * rejects every statement or answers with the rows a test queues. The tests
 * pin the three outcomes: failure is a 503 marked `no-store` with an error body,
 * success is a 200 the edge may store, and an empty read is still a 200.
 * Test: `npx vitest run tests/unit/news-route-fail-closed.test.ts`. No database
 * access, no network.
 */

const { fixture } = vi.hoisted(() => {
  const state = {
    /** Result rows handed back, one entry per statement, in order. */
    responses: [] as unknown[][][],
    /** When set, the fake driver rejects statements with this error. */
    failWith: null as Error | null,
    /** How many statements answer before `failWith` applies; 0 fails them all. */
    failAfter: 0,
    /** Statements the fake driver has been asked to run. */
    calls: 0,
  };

  function reset(): void {
    state.responses = [];
    state.failWith = null;
    state.failAfter = 0;
    state.calls = 0;
  }

  return { fixture: { state, reset } };
});

vi.mock("../../lib/db/connection", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");

  const builder = drizzle(async () => {
    const call = fixture.state.calls++;
    if (fixture.state.failWith && call >= fixture.state.failAfter) throw fixture.state.failWith;
    return { rows: fixture.state.responses.shift() ?? [] };
  });

  return { getDb: () => builder };
});

import { getTableColumns } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { GET as getNews } from "../../app/api/news/route";
import { GET as getRecentNews } from "../../app/api/news/recent/route";
import { articles } from "../../lib/db/article-schema";

/** The header a successful news read must carry for the edge to store it. */
const EDGE_CACHEABLE = "public, s-maxage=300, stale-while-revalidate=1800";

const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0";
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148";

function request(url: string, userAgent = DESKTOP_UA): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: new Headers({ "User-Agent": userAgent }),
  } as unknown as NextRequest;
}

/**
 * One `articles` row as the driver returns it: values in selection order.
 * `extra` is appended after the table's own columns (the page query's derived
 * `event_type`).
 */
function articleRow(id: string, extra: unknown[] = []): unknown[] {
  const values: Record<string, unknown> = {
    id,
    slug: `article-${id}`,
    title: `Article ${id} launches`,
    summary: "A summary.",
    content: "Body text.",
    ingestionType: "url",
    sourceUrl: `https://example.com/${id}`,
    sourceName: "AI News",
    tags: [],
    importanceScore: 5,
    toolMentions: [],
    companyMentions: [],
    publishedDate: "2026-09-01 00:00:00",
    status: "active",
    createdAt: "2026-09-01 00:00:00",
    updatedAt: "2026-09-01 00:00:00",
  };
  return [...Object.keys(getTableColumns(articles)).map((key) => values[key] ?? null), ...extra];
}

function assertFailedClosed(response: Response, data: Record<string, unknown>): void {
  expect(response.status).toBe(503);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(data.error).toBeTruthy();
  expect(data).not.toHaveProperty("news");
}

describe("GET /api/news fails closed (#152)", () => {
  beforeEach(() => {
    fixture.reset();
  });

  it("answers a failed database read with 503 no-store, not an empty 200", async () => {
    fixture.state.failWith = new Error("connection reset");

    const response = await getNews(request("http://localhost/api/news?limit=100"));
    const data = await response.json();

    assertFailedClosed(response, data);
  });

  it("answers a failed count with 503 no-store even when the page read succeeded", async () => {
    // The page query answers; the COUNT(*) after it does not.
    fixture.state.responses = [[articleRow("1", ["update"])]];
    fixture.state.failWith = new Error("count timed out");
    fixture.state.failAfter = 1;

    const response = await getNews(request("http://localhost/api/news?limit=20"));
    const data = await response.json();

    expect(fixture.state.calls).toBe(2);
    assertFailedClosed(response, data);
  });

  it.each([
    ["desktop", DESKTOP_UA],
    ["mobile", MOBILE_UA],
  ])("serves a successful %s read as a 200 the edge can cache", async (_label, userAgent) => {
    fixture.state.responses = [[articleRow("1", ["update"])], [["1"]]];

    const response = await getNews(request("http://localhost/api/news?limit=20", userAgent));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(EDGE_CACHEABLE);
    expect(response.headers.get("Vary") ?? "").not.toMatch(/user-agent/i);
    expect(data.news).toHaveLength(1);
    expect(data.news[0].slug).toBe("article-1");
    expect(data.total).toBe(1);
  });

  it("still answers a read that matched nothing with a 200 and an empty list", async () => {
    fixture.state.responses = [[], [["0"]]];

    const response = await getNews(request("http://localhost/api/news?limit=20&filter=milestone"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(EDGE_CACHEABLE);
    expect(data.news).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.hasMore).toBe(false);
  });

  it("never lets the edge store a debug response, which echoes the caller's User-Agent", async () => {
    fixture.state.responses = [[], [["0"]]];

    const response = await getNews(request("http://localhost/api/news?debug=true"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data._debug.user_agent).toBe(DESKTOP_UA);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/news/recent fails closed (#152)", () => {
  beforeEach(() => {
    fixture.reset();
  });

  it("answers a failed database read with 503 no-store, not an empty 200", async () => {
    fixture.state.failWith = new Error("connection reset");

    const response = await getRecentNews(request("http://localhost/api/news/recent?days=14"));
    const data = await response.json();

    assertFailedClosed(response, data);
  });

  it("serves a successful read as a 200 the edge can cache", async () => {
    fixture.state.responses = [[articleRow("1")]];

    const response = await getRecentNews(request("http://localhost/api/news/recent?days=14"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(EDGE_CACHEABLE);
    expect(data.news).toHaveLength(1);
  });
});
