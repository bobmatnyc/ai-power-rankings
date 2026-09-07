import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression tests for #140 — what `/api/news` and `/api/news/recent` ask the
 * repository for, and what they return.
 *
 * Why: `/api/news` called `getPaginated(limit * 3, 0)` and then filtered by
 * `event_type` and sliced by `offset` in memory. `?limit=100&offset=300` fell
 * off the end of that 300-row pool and returned `news: []` with `total` equal to
 * the pool length rather than the real count. `/api/news/recent` fetched the top
 * 100 by published date and applied `days` in memory, so a window holding more
 * than 100 articles was silently truncated.
 *
 * What: The repository is replaced by spies, so these tests pin the boundary —
 * which arguments cross it, and that nothing is filtered or sliced after it
 * returns. The repository's own statements are covered separately in
 * `lib/db/repositories/news.test.ts`.
 *
 * Test: `npx vitest run tests/unit/news-route-pagination.test.ts`. No database
 * access, no network.
 */

const { getPaginatedFiltered, countFiltered, getRecentWithin, getPaginated } = vi.hoisted(() => ({
  getPaginatedFiltered: vi.fn(),
  countFiltered: vi.fn(),
  getRecentWithin: vi.fn(),
  /** Kept as a spy purely so a reverted implementation is visible, not silent. */
  getPaginated: vi.fn(),
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({}),
}));

vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    getPaginatedFiltered = getPaginatedFiltered;
    countFiltered = countFiltered;
    getRecentWithin = getRecentWithin;
    getPaginated = getPaginated;
  },
}));

import { GET as getNews } from "../../app/api/news/route";
import { GET as getRecentNews } from "../../app/api/news/recent/route";

const REPO_ROOT = join(__dirname, "..", "..");

/** One article row shaped as `getPaginatedFiltered` returns it. */
function article(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `article-${id}`,
    title: `Article ${id}`,
    summary: "A summary.",
    content: "Body text.",
    source: "AI News",
    sourceUrl: `https://example.com/${id}`,
    publishedAt: new Date("2026-09-01T00:00:00.000Z"),
    toolMentions: [],
    importanceScore: 5,
    tags: [],
    category: null,
    eventType: "update",
    ...overrides,
  };
}

function request(url: string): any {
  return { nextUrl: new URL(url), headers: new Headers() };
}

async function body(response: Response): Promise<any> {
  return response.json();
}

describe("GET /api/news pagination (#140)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPaginatedFiltered.mockResolvedValue({ articles: [], total: 0, hasMore: false });
  });

  it("serves an offset past the old 300-row pool and reports the counted total", async () => {
    const page = [article("301"), article("302")];
    getPaginatedFiltered.mockResolvedValue({ articles: page, total: 742, hasMore: true });

    const response = await getNews(request("http://localhost/api/news?limit=100&offset=300"));
    const data = await body(response);

    expect(getPaginatedFiltered).toHaveBeenCalledWith({
      limit: 100,
      offset: 300,
      eventType: null,
    });
    // The rows the repository returned for that window reach the client intact —
    // nothing is re-sliced here.
    expect(data.news).toHaveLength(2);
    expect(data.news.map((item: any) => item.id)).toEqual(["301", "302"]);
    expect(data.total).toBe(742);
    expect(data.hasMore).toBe(true);
  });

  it("never asks for a tripled pool at offset 0", async () => {
    await getNews(request("http://localhost/api/news?limit=50&offset=150"));

    expect(getPaginated).not.toHaveBeenCalled();
    const [args] = getPaginatedFiltered.mock.calls[0];
    expect(args.limit).toBe(50);
    expect(args.offset).toBe(150);
  });

  it("forwards the event_type filter to the repository instead of filtering after the fetch", async () => {
    // Both rows classify as "update"; a post-fetch filter on "milestone" would
    // drop them, so an implementation that still filters here returns nothing.
    getPaginatedFiltered.mockResolvedValue({
      articles: [article("1"), article("2")],
      total: 2,
      hasMore: false,
    });

    const response = await getNews(
      request("http://localhost/api/news?limit=20&offset=0&filter=milestone")
    );
    const data = await body(response);

    expect(getPaginatedFiltered).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      eventType: "milestone",
    });
    expect(data.news).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it("keeps the response shape and cache behaviour the existing callers read", async () => {
    getPaginatedFiltered.mockResolvedValue({
      articles: [article("1", { eventType: "milestone", tags: ["funding"] })],
      total: 1,
      hasMore: false,
    });

    const response = await getNews(request("http://localhost/api/news?limit=20"));
    const data = await body(response);

    expect(Object.keys(data)).toEqual(
      expect.arrayContaining(["news", "total", "hasMore", "_source", "_timestamp"])
    );
    expect(data._source).toBe("database");
    expect(response.headers.get("Cache-Control")).toBeTruthy();
    // event_type still ships per item; the news page filters on it client-side.
    expect(data.news[0].event_type).toBe("milestone");
    expect(data.news[0].tool_name).toBeDefined();
  });

  it("clamps limit to 100, floors offset at 0, and falls back on non-numeric input", async () => {
    const cases: Array<[string, { limit: number; offset: number }]> = [
      ["limit=5000&offset=10", { limit: 100, offset: 10 }],
      ["limit=20&offset=-40", { limit: 20, offset: 0 }],
      ["limit=abc&offset=xyz", { limit: 20, offset: 0 }],
      ["limit=0", { limit: 1, offset: 0 }],
    ];

    for (const [query, expected] of cases) {
      vi.clearAllMocks();
      getPaginatedFiltered.mockResolvedValue({ articles: [], total: 0, hasMore: false });

      const response = await getNews(request(`http://localhost/api/news?${query}`));

      expect(response.status, query).toBe(200);
      expect(getPaginatedFiltered.mock.calls[0][0], query).toMatchObject(expected);
    }
  });
});

describe("GET /api/news/recent window (#140)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecentWithin.mockResolvedValue([]);
  });

  it("pushes days and limit into the repository call", async () => {
    getRecentWithin.mockResolvedValue([article("1")]);

    const response = await getRecentNews(
      request("http://localhost/api/news/recent?days=14&limit=50")
    );
    const data = await body(response);

    expect(getRecentWithin).toHaveBeenCalledWith({ days: 14, limit: 50 });
    expect(getPaginated).not.toHaveBeenCalled();
    expect(data.news).toHaveLength(1);
    expect(data.days).toBe(14);
    expect(data.total).toBe(1);
    expect(data._source).toBe("database");
  });

  it("returns every row the window query gave back, past the old 100-row ceiling", async () => {
    const rows = Array.from({ length: 100 }, (_, index) => article(String(index)));
    getRecentWithin.mockResolvedValue(rows);

    const data = await body(
      await getRecentNews(request("http://localhost/api/news/recent?days=30&limit=100"))
    );

    expect(data.news).toHaveLength(100);
    expect(data.total).toBe(100);
  });

  it("clamps days and limit and falls back on non-numeric input", async () => {
    const cases: Array<[string, { days: number; limit: number }]> = [
      ["days=9999&limit=9999", { days: 365, limit: 100 }],
      ["days=0&limit=-3", { days: 1, limit: 1 }],
      ["days=abc&limit=xyz", { days: 7, limit: 10 }],
    ];

    for (const [query, expected] of cases) {
      vi.clearAllMocks();
      getRecentWithin.mockResolvedValue([]);

      const response = await getRecentNews(
        request(`http://localhost/api/news/recent?${query}`)
      );

      expect(response.status, query).toBe(200);
      expect(getRecentWithin).toHaveBeenCalledWith(expected);
    }
  });

  it("leaves no in-memory date filter or sort behind in the route", () => {
    const source = readFileSync(join(REPO_ROOT, "app/api/news/recent/route.ts"), "utf8");

    expect(source).not.toContain("dateThreshold");
    expect(source).not.toContain(".sort(");
    expect(source).not.toContain("getPaginated(");
  });
});

describe("in-memory pagination is gone from /api/news (#140)", () => {
  it("leaves no post-fetch filter or slice behind in the route", () => {
    const source = readFileSync(join(REPO_ROOT, "app/api/news/route.ts"), "utf8");

    expect(source).not.toContain("limit * 3");
    expect(source).not.toContain(".slice(offset");
    expect(source).not.toContain("filteredNews");
    // total must not be derived from an array length.
    expect(source).not.toMatch(/total:\s*\w+\.length/);
  });
});
