/**
 * Tool-anchored, daily-rotated discovery queries (#476).
 *
 * Why: the generic OR query and the weekday topic queries (one a funding
 * query) pulled broad AI-industry news that named no tracked tool. Queries now
 * carry tracked tool names from the `tools` table and rotate daily.
 * What: Replaces `getDb()` with a fake returning a fixed tool list (or
 * throwing), mocks fetch, and inspects the queries Tavily and Brave send.
 * Test: `npx vitest run tests/unit/discovery-queries-476.test.ts`. No network,
 * no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  names: [] as string[],
  fail: false,
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => {
    if (dbState.fail) throw new Error("connection refused");
    return {
      select: () => ({
        from: () => ({
          where: async () => dbState.names.map((name) => ({ name })),
        }),
      }),
    };
  },
}));

import { TavilySearchService } from "../../lib/services/tavily-search.service";
import { BraveSearchService } from "../../lib/services/brave-search.service";

const TOOLS = Array.from({ length: 24 }, (_, i) => `Tool${String(i).padStart(2, "0")}`);
const START = new Date("2026-11-01T12:00:00.000Z");
const DAY_MS = 86_400_000;

function mockFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return {
      ok: true,
      json: async () => ({ query: "q", results: [], response_time: 0.1, web: { results: [] } }),
    } as unknown as Response;
  });
}

async function tavilyQueries(day: number): Promise<string[]> {
  vi.setSystemTime(new Date(START.getTime() + day * DAY_MS));
  const fetchSpy = mockFetch();
  await new TavilySearchService("k").searchAINews({ topic: "news", includeRecentPass: true, days: 3 });
  const queries = fetchSpy.mock.calls.map((c) => JSON.parse(c[1]?.body as string).query as string);
  fetchSpy.mockRestore();
  return queries;
}

async function braveQueries(day: number): Promise<string[]> {
  vi.setSystemTime(new Date(START.getTime() + day * DAY_MS));
  const fetchSpy = mockFetch();
  await new BraveSearchService("k").searchAINews("pd");
  const queries = fetchSpy.mock.calls.map((c) => new URL(String(c[0])).searchParams.get("q") ?? "");
  fetchSpy.mockRestore();
  return queries;
}

function toolsIn(queries: string[]): string[] {
  return TOOLS.filter((t) => queries.some((q) => q.includes(`"${t}"`)));
}

describe("tool-anchored discovery queries (#476)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    dbState.names = [...TOOLS];
    dbState.fail = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Tavily: every query names 3-4 tracked tools, 3 searches per run", async () => {
    const queries = await tavilyQueries(0);
    expect(queries).toHaveLength(3);
    for (const q of queries) {
      const named = TOOLS.filter((t) => q.includes(`"${t}"`));
      expect(named.length).toBeGreaterThanOrEqual(3);
      expect(named.length).toBeLessThanOrEqual(4);
    }
  });

  it("Tavily: rotates by day and covers every tool within a cycle", async () => {
    const day0 = await tavilyQueries(0);
    const day1 = await tavilyQueries(1);
    expect(toolsIn(day0)).not.toEqual(toolsIn(day1));

    const covered = new Set<string>();
    for (let d = 0; d < 3; d++) for (const t of toolsIn(await tavilyQueries(d))) covered.add(t);
    expect(covered.size).toBe(TOOLS.length);
  });

  it("Brave: queries name tracked tools and rotate by day", async () => {
    const day0 = await braveQueries(0);
    const day1 = await braveQueries(1);
    expect(day0).toHaveLength(2);
    expect(toolsIn(day0).length).toBeGreaterThanOrEqual(6);
    expect(toolsIn(day0)).not.toEqual(toolsIn(day1));
  });

  it("issues no funding query on any day of the week", async () => {
    for (let d = 0; d < 7; d++) {
      const all = [...(await tavilyQueries(d)), ...(await braveQueries(d))];
      for (const q of all) expect(q.toLowerCase()).not.toMatch(/funding|investment/);
    }
  });

  it("falls back to a static top-tool list when the tools read fails", async () => {
    dbState.fail = true;
    const queries = await tavilyQueries(0);
    expect(queries).toHaveLength(3);
    for (const q of queries) expect(q).toMatch(/"(GitHub Copilot|Cursor|Claude Code|Windsurf|Devin|Replit Agent|Amazon Q Developer|OpenAI Codex)"/);
  });
});
