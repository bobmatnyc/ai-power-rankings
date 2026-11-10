/**
 * #95 PR C: collection health — pypi shards finish, github finds the stored repo,
 * and a registry failure is never recorded as "no package" or 0 downloads.
 *
 * Why: the 2026-11-01 collection ended with both pypi shards `partial`
 *   (skipped_timeout 4 and 11) and github recording 4 of 193 tools while its shard
 *   said `ok`.
 * What: runs `runMetricsShard()` with the real pypi and github adapters against a
 *   stubbed `fetch` and an in-memory store. The pypi timing test uses fake timers:
 *   the shard deadline, the collector's 300 ms lookup pause, the 1 s pause between
 *   tools and a 50 ms registry latency all run on the fake clock.
 * Test: `npx vitest run tests/unit/metrics-collection-health-95.test.ts`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_URL_PATHS } from "../../lib/metrics-collectors/github";
import { type CollectorPart, type CollectorTool, createCollectorAdapter } from "../../lib/metrics-collectors/registry";
import {
  type HistoryRow,
  type MetricsHistoryStore,
  runMetricsShard,
  type ShardResult,
} from "../../lib/metrics-history/collect-shard";

const DAY = Date.UTC(2026, 10, 1, 1, 30, 0); // 2026-11-01T01:30:00Z, the pypi cron slot
const LATENCY_MS = 50;

class MemoryStore implements MetricsHistoryStore {
  rows: HistoryRow[] = [];
  constructor(private tools: CollectorTool[]) {}
  async listTools() {
    return this.tools;
  }
  async upsertMetrics(row: HistoryRow) {
    this.rows.push(row);
  }
  async recordRun() {}
}

function run(part: CollectorPart, tools: CollectorTool[], shard = 0, of = 1) {
  const store = new MemoryStore(tools);
  const outcome = runMetricsShard(
    { part, shard, of },
    { store, createAdapter: (signal) => createCollectorAdapter(part, { signal, env: {} }) }
  );
  return { store, outcome };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#95 pypi shards finish inside the 270 s deadline", () => {
  // 193 tools with no PyPI package, the shape of most of the roster (pypi recorded 24 of 193).
  const ROSTER: CollectorTool[] = Array.from({ length: 193 }, (_, i) => ({
    id: `id-${i}`,
    slug: `agent-${i}-studio`,
    name: `Agent ${i} Studio`,
    data: {},
  }));

  it("both pypi shards are ok with no skipped_timeout, and each tool sends 3 lookups, not 10", async () => {
    vi.useFakeTimers({ now: DAY });
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            urls.push(url);
            setTimeout(() => resolve(new Response("{}", { status: 404 })), LATENCY_MS);
          })
      )
    );

    const results: ShardResult[] = [];
    for (const shard of [0, 1]) {
      const { outcome } = run("pypi", ROSTER, shard, 2);
      let settled = false;
      void outcome.finally(() => {
        settled = true;
      });
      // Drive the fake clock; 20 000 steps of 50 ms is far past the 270 s deadline.
      for (let step = 0; step < 20_000 && !settled; step++) await vi.advanceTimersByTimeAsync(LATENCY_MS);
      expect(settled).toBe(true);
      results.push((await outcome).result);
    }

    for (const result of results) {
      expect(result.counts.skipped_timeout).toBe(0);
      expect(result.status).toBe("ok");
      expect(result.finishedAt.getTime() - result.startedAt.getTime()).toBeLessThan(270_000);
    }
    expect(results[0]!.counts.attempted + results[1]!.counts.attempted).toBe(193);
    expect(results.reduce((sum, r) => sum + r.counts.not_found, 0)).toBe(193);
    // "agent-7-studio", "agent7studio", "agent 7 studio": the other spellings normalise to these.
    expect(urls.filter((u) => u.startsWith("https://pypi.org/"))).toHaveLength(193 * 3);
    expect(urls.filter((u) => u.includes("pypistats"))).toHaveLength(0);
  });
});

describe("#95 a pypi request failure is a failed tool, never not_found or 0 (fail-open)", () => {
  const AIDER: CollectorTool = { id: "id-aider", slug: "aider", name: "Aider", data: {} };

  it("a PyPI 503 makes the tool failed and the shard partial", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503, statusText: "Service Unavailable" }))
    );
    const { result } = await run("pypi", [AIDER]).outcome;
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 0, not_found: 0, failed: 1 });
    expect(result.status).toBe("partial");
  });

  it("a pypistats 429 for a matched package fails the tool instead of storing 0 downloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("pypistats")
          ? new Response("slow down", { status: 429, statusText: "Too Many Requests" })
          : json({ info: { name: "aider-chat", version: "1.0.0", summary: "AI pair programming in your terminal" } })
      )
    );
    const { store, outcome } = run("pypi", [AIDER]);
    const { result } = await outcome;
    expect(result.counts).toMatchObject({ recorded: 0, failed: 1 });
    expect(store.rows).toHaveLength(0);
  });

  it("a matched package with stats is recorded with its downloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("pypistats")
          ? json({ data: { last_month: 4321 } })
          : json({ info: { name: "aider-chat", version: "1.0.0", summary: "AI pair programming in your terminal" } })
      )
    );
    const { store, outcome } = run("pypi", [AIDER]);
    expect((await outcome).result.status).toBe("ok");
    expect(store.rows[0]?.metrics["pypi"]?.["downloads_last_month"]?.value).toBe(4321);
  });
});

describe("#95 github reads the repo from the fields the app stores it in", () => {
  const repoFetches = (): string[] => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return json({ stargazers_count: 7, forks_count: 1 }, 200, { "x-ratelimit-remaining": "59" });
      })
    );
    return urls;
  };

  it.each([
    ["github_repo", { github_repo: "https://github.com/acme/top" }, "acme/top"],
    ["info.links.github", { info: { links: { github: "https://github.com/acme/links" } } }, "acme/links"],
    ["info.github_repo", { info: { github_repo: "https://github.com/acme/info" } }, "acme/info"],
    ["info.technical.github_repo", { info: { technical: { github_repo: "https://github.com/acme/tech" } } }, "acme/tech"],
  ])("a URL in %s is collected, not not_found", async (_field, data, repo) => {
    const urls = repoFetches();
    const { store, outcome } = run("github", [{ id: "id-t", slug: "t", name: "T", data }]);
    const { result } = await outcome;
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 1, not_found: 0 });
    expect(urls).toEqual([`https://api.github.com/repos/${repo}`]);
    expect(store.rows[0]?.metrics["github"]?.["stars"]?.value).toBe(7);
  });

  it("an original field still wins over the new ones, so a resolved tool keeps its repo", async () => {
    const urls = repoFetches();
    const data = { github_repo: "https://github.com/acme/new", repository: "https://github.com/acme/old" };
    await run("github", [{ id: "id-t", slug: "t", name: "T", data }]).outcome;
    expect(urls).toEqual(["https://api.github.com/repos/acme/old"]);
  });

  it("a tool with no GitHub URL anywhere stays not_found with no request", async () => {
    const urls = repoFetches();
    const data = { github_repo: null, website_url: "https://example.com", info: { links: { website: "https://x.dev" } } };
    const { result } = await run("github", [{ id: "id-t", slug: "t", name: "T", data }]).outcome;
    expect(result.counts).toMatchObject({ recorded: 0, not_found: 1 });
    expect(urls).toHaveLength(0);
  });

  it("GITHUB_URL_PATHS keeps the original fields first and adds the four app fields last", () => {
    expect(GITHUB_URL_PATHS.slice(0, 2)).toEqual(["github_url", "repository"]);
    expect(GITHUB_URL_PATHS.slice(-4)).toEqual([
      "github_repo",
      "info.github_repo",
      "info.links.github",
      "info.technical.github_repo",
    ]);
  });
});
