import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #231 — the What's New feed holds 3 of its 20 slots for platform items.
 *
 * Why: `/api/whats-new` used a hardcoded 2025-10 changelog list, and the
 * 20-item cap let daily news crowd out every platform change.
 * What: `composeFeed` keeps the newest 3 platform items and fills the rest by
 * date. The route reads platform items from the generated changelog module,
 * reports `_sources` / `_degraded`, and serves a degraded feed `no-store`.
 * Test: `npx vitest run tests/unit/whats-new-feed-231.test.ts`. The database
 * and repositories are stubs; no network.
 */

const { news, tools } = vi.hoisted(() => ({ news: vi.fn(), tools: vi.fn() }));

vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    getPageFiltered = news;
  },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findAll = tools;
  },
}));

import type { NextRequest } from "next/server";
import type { ChangelogEntry } from "../../lib/data/changelog-generator";
import { composeFeed, FEED_LIMIT, PLATFORM_SLOTS } from "../../lib/services/whats-new-feed";

const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

function request(): NextRequest {
  return { nextUrl: new URL("http://localhost/api/whats-new?days=7"), headers: new Headers() } as unknown as NextRequest;
}

function article(i: number) {
  return {
    id: `n${i}`,
    slug: `n${i}`,
    title: `News ${i}`,
    summary: "s",
    content: "c",
    publishedAt: new Date(Date.now() - i * 60 * 1000),
    source: "AI News",
    sourceUrl: null,
  };
}

function entry(i: number, hoursAgo: number): ChangelogEntry {
  return {
    id: `unreleased-${i}`,
    version: "Unreleased",
    date: ago(hoursAgo),
    dateSource: "commit",
    section: "Fixed",
    scope: "feed",
    title: `Change ${i}`,
    description: `Change ${i} description`,
    changeType: "fix",
  };
}

describe("composeFeed (#231)", () => {
  const item = (type: string, hoursAgo: number) => ({ type, date: ago(hoursAgo) });

  it("holds 3 of 20 slots for platform items older than every news item", () => {
    const items = [
      ...Array.from({ length: 30 }, (_, i) => item("news", i)),
      ...Array.from({ length: 5 }, (_, i) => item("platform", 100 + i)),
    ];
    const feed = composeFeed(items);
    expect(feed).toHaveLength(FEED_LIMIT);
    expect(feed.filter((i) => i.type === "platform")).toHaveLength(PLATFORM_SLOTS);
    expect(feed.map((i) => Date.parse(i.date))).toEqual(
      [...feed.map((i) => Date.parse(i.date))].sort((a, b) => b - a)
    );
  });

  it("gives unused platform slots to other items", () => {
    const feed = composeFeed([...Array.from({ length: 30 }, (_, i) => item("news", i + 1)), item("platform", 50)]);
    expect(feed).toHaveLength(FEED_LIMIT);
    expect(feed.filter((i) => i.type === "news")).toHaveLength(FEED_LIMIT - 1);
  });

  it("caps platform items at 3 even when they are newer than every news item", () => {
    const feed = composeFeed([
      ...Array.from({ length: 25 }, (_, i) => item("platform", i)),
      ...Array.from({ length: 30 }, (_, i) => item("news", 30 + i)),
    ]);
    expect(feed.filter((i) => i.type === "platform")).toHaveLength(PLATFORM_SLOTS);
    expect(feed.filter((i) => i.type === "news")).toHaveLength(FEED_LIMIT - PLATFORM_SLOTS);
  });
});

describe("GET /api/whats-new platform items (#231)", () => {
  beforeEach(() => {
    news.mockReset().mockResolvedValue(Array.from({ length: 30 }, (_, i) => article(i)));
    tools.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.doUnmock("../../lib/data/changelog-entries");
    vi.resetModules();
  });

  it("serves 3 platform items among 20 when 30 newer news items exist, with _sources", async () => {
    vi.doMock("../../lib/data/changelog-entries", () => ({
      CHANGELOG_ENTRIES: [entry(1, 24), entry(2, 48), entry(3, 72), entry(4, 96), entry(5, 24 * 30)],
    }));
    const { GET } = await import("../../app/api/whats-new/route");
    const response = await GET(request());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.feed).toHaveLength(20);
    expect(data.feed.filter((i: { type: string }) => i.type === "platform").map((i: { id: string }) => i.id))
      .toEqual(["unreleased-1", "unreleased-2", "unreleased-3"]);
    expect(data._degraded).toBe(false);
    expect(data._sources).toEqual({
      news: { status: "ok", count: 30 },
      tools: { status: "ok", count: 0 },
      platform: { status: "ok", count: 4 },
    });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
  });

  it("marks the feed _degraded and no-store when the generated module is empty", async () => {
    vi.doMock("../../lib/data/changelog-entries", () => ({ CHANGELOG_ENTRIES: [] }));
    const { GET } = await import("../../app/api/whats-new/route");
    const response = await GET(request());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data._degraded).toBe(true);
    expect(data._sources.platform.status).toBe("unavailable");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
