import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #152 — `/api/whats-new` fails closed on a news read.
 *
 * Why: The route read news through `NewsRepository.getPaginated()`, which
 * turned a failed read into an empty page. The route then answered a 200 whose
 * feed held tools and changelog entries but no news, cached for a minute, and
 * the What's New modal showed it as a quiet week.
 * What: `getDb()` is a real Drizzle instance over the pg-proxy driver, so the
 * real `NewsRepository` runs; `ToolsRepository` is a spy. A news failure must be
 * a 503 `no-store` with an error body, even when the tools read succeeded. A
 * successful read keeps its `public, max-age=60, s-maxage=60` header.
 * Test: `npx vitest run tests/unit/whats-new-route-fail-closed.test.ts`. No
 * database access, no network.
 */

const { fixture, findAll } = vi.hoisted(() => {
  const state = {
    /** Result rows handed back, one entry per statement, in order. */
    responses: [] as unknown[][][],
    /** When set, the fake driver rejects every statement with this error. */
    failWith: null as Error | null,
  };

  function reset(): void {
    state.responses = [];
    state.failWith = null;
  }

  return { fixture: { state, reset }, findAll: vi.fn() };
});

vi.mock("../../lib/db/connection", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");

  const builder = drizzle(async () => {
    if (fixture.state.failWith) throw fixture.state.failWith;
    return { rows: fixture.state.responses.shift() ?? [] };
  });

  return { getDb: () => builder };
});

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findAll = findAll;
  },
}));

import { getTableColumns } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { GET as getWhatsNew } from "../../app/api/whats-new/route";
import { articles } from "../../lib/db/article-schema";

function request(url: string): NextRequest {
  return { nextUrl: new URL(url), headers: new Headers() } as unknown as NextRequest;
}

/** `date` as the timestamp text Postgres returns, `daysAgo` days before now. */
function pgTimestamp(daysAgo: number): string {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/** One `articles` row as the driver returns it, plus the derived `event_type`. */
function articleRow(id: string): unknown[] {
  const values: Record<string, unknown> = {
    id,
    slug: `article-${id}`,
    title: `Article ${id}`,
    summary: "A summary.",
    content: "Body text.",
    ingestionType: "url",
    sourceUrl: `https://example.com/${id}`,
    sourceName: "AI News",
    tags: [],
    importanceScore: 5,
    toolMentions: [],
    companyMentions: [],
    publishedDate: pgTimestamp(1),
    status: "active",
    createdAt: pgTimestamp(1),
    updatedAt: pgTimestamp(1),
  };
  // The trailing values cover a statement that selects more columns than the
  // table's own (the derived `event_type`) or a count that follows the page.
  return [...Object.keys(getTableColumns(articles)).map((key) => values[key] ?? null), "update"];
}

function recentTool() {
  return {
    id: "tool-1",
    name: "Tool One",
    slug: "tool-one",
    category: "ide-assistant",
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    info: {},
  };
}

describe("GET /api/whats-new fails closed (#152)", () => {
  beforeEach(() => {
    fixture.reset();
    findAll.mockReset();
  });

  it("answers a failed news read with 503 no-store even though the tools read succeeded", async () => {
    fixture.state.failWith = new Error("connection reset");
    findAll.mockResolvedValue([recentTool()]);

    const response = await getWhatsNew(request("http://localhost/api/whats-new?days=7"));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(data.error).toBeTruthy();
    expect(data).not.toHaveProperty("feed");
  });

  it("answers a failed tools read with a 5xx no-store, not a cached 200", async () => {
    fixture.state.responses = [[articleRow("1")], [["1"]]];
    findAll.mockRejectedValue(new Error("tools table missing"));

    const response = await getWhatsNew(request("http://localhost/api/whats-new?days=7"));

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps a successful read's one-minute public cache and merges news with tools", async () => {
    fixture.state.responses = [[articleRow("1")], [["1"]]];
    findAll.mockResolvedValue([recentTool()]);

    const response = await getWhatsNew(request("http://localhost/api/whats-new?days=7"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=60");
    expect(data.feed.map((item: { type: string }) => item.type).sort()).toEqual(["news", "tool"]);
  });
});
