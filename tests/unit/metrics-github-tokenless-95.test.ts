/**
 * #95: the GitHub collector without a token, on 403/429, and under a request budget.
 *
 * Why: no GitHub token will be provided (owner ruling A9e). The github shard threw
 *   "GITHUB_TOKEN is not set" at init and recorded 0 rows, and a 403 on the commits or
 *   contributors call was stored as a real 0.
 * What: runs the real github adapter through `runMetricsShard()` with a fetch stub and an
 *   in-memory store. Checks: no token runs and sends no Authorization header and only
 *   `GET /repos/{o}/{r}`; 403 and 429 fail the tool and write no row; a 403 on commits in
 *   authenticated mode stores no 0; a low header-reported budget skips the rest and leaves the
 *   shard `partial` with the stop reason in the ledger row; rate-limit state comes from headers.
 * Test: `npx vitest run tests/unit/metrics-github-tokenless-95.test.ts`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitHubMetricsCollector } from "../../lib/metrics-collectors/github";
import { createCollectorAdapter, type CollectorAdapter, type CollectorTool } from "../../lib/metrics-collectors/registry";
import {
  type HistoryRow,
  type MetricsHistoryStore,
  runMetricsShard,
  type ShardResult,
} from "../../lib/metrics-history/collect-shard";

const DAY = Date.UTC(2026, 10, 1, 1, 0, 0);
const HOUR_AHEAD = Math.floor(Date.now() / 1000) + 3600;

function tool(slug: string): CollectorTool {
  return { id: `id-${slug}`, slug, name: slug, data: { github_url: `https://github.com/org/${slug}` } };
}

class MemoryStore implements MetricsHistoryStore {
  rows = new Map<string, HistoryRow>();
  runs: ShardResult[] = [];
  constructor(private tools: CollectorTool[]) {}
  async listTools() {
    return this.tools;
  }
  async upsertMetrics(row: HistoryRow) {
    this.rows.set(row.toolId, row);
  }
  async recordRun(result: ShardResult) {
    this.runs.push(result);
  }
}

interface Call {
  url: string;
  authorization: string | undefined;
}

type Handler = (url: string, n: number) => Response;

/** Stubs fetch with `handler`; `n` is the 1-based call number. Returns the recorded calls. */
function stubFetch(handler: Handler): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(url).replace("https://api.github.com", ""), authorization: headers["Authorization"] });
      return handler(String(url), calls.length);
    })
  );
  return calls;
}

function ok(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

const REPO_BODY = { stargazers_count: 7, forks_count: 2, watchers_count: 7, open_issues_count: 1, created_at: "2020-01-01" };

/** The real github adapter, with the 1 s inter-tool pause removed. */
function githubAdapter(env: Record<string, string | undefined>) {
  return (signal: AbortSignal): CollectorAdapter => ({
    ...createCollectorAdapter("github", { env, signal }),
    pause: async () => {},
  });
}

async function runShard(tools: CollectorTool[], env: Record<string, string | undefined>, deadlineMs = 5_000) {
  const store = new MemoryStore(tools);
  const { result } = await runMetricsShard(
    { part: "github", shard: 0, of: 1 },
    { store, createAdapter: githubAdapter(env), now: () => DAY, deadlineMs }
  );
  return { store, result };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#95 no GITHUB_TOKEN", () => {
  it.each([[undefined], [""], ["   "]])("token %j: runs, sends no Authorization, fetches only /repos", async (token) => {
    const calls = stubFetch(() => ok(REPO_BODY, { "x-ratelimit-remaining": "59", "x-ratelimit-reset": String(HOUR_AHEAD), "x-ratelimit-limit": "60" }));
    const { store, result } = await runShard([tool("alpha")], { GITHUB_TOKEN: token });

    expect(result.error).toBeNull();
    expect(result.status).toBe("ok");
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 1, failed: 0 });
    expect(calls.map((c) => c.url)).toEqual(["/repos/org/alpha"]);
    expect(calls.every((c) => c.authorization === undefined)).toBe(true);
    const leaves = store.rows.get("id-alpha")?.metrics["github"] ?? {};
    expect(leaves["stars"]?.value).toBe(7);
    expect("commit_count_30d" in leaves).toBe(false);
    expect("contributors_count" in leaves).toBe(false);
  });

  it("with a token, sends Bearer auth and fetches repo, commits and contributors", async () => {
    const calls = stubFetch((url) =>
      url.endsWith("/rate_limit")
        ? ok({ resources: { core: { remaining: 5000, reset: HOUR_AHEAD, limit: 5000 } } })
        : url.includes("/commits")
          ? ok([{}, {}])
          : url.includes("/contributors")
            ? ok([{}])
            : ok(REPO_BODY)
    );
    const { store, result } = await runShard([tool("alpha")], { GITHUB_TOKEN: "tok" });

    expect(result.status).toBe("ok");
    expect(calls.every((c) => c.authorization === "Bearer tok")).toBe(true);
    expect(calls.map((c) => c.url.split("?")[0])).toEqual(["/rate_limit", "/repos/org/alpha", "/repos/org/alpha/commits", "/repos/org/alpha/contributors"]);
    const leaves = store.rows.get("id-alpha")?.metrics["github"] ?? {};
    expect(leaves["commit_count_30d"]?.value).toBe(2);
    expect(leaves["contributors_count"]?.value).toBe(1);
  });
});

describe("#95 403 and 429 are failures, never a 0", () => {
  it("403 on /repos fails the tool and writes no row", async () => {
    stubFetch(() => new Response("{}", { status: 403, statusText: "Forbidden" }));
    const { store, result } = await runShard([tool("alpha")], {});
    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 0, failed: 1 });
    expect(result.status).toBe("partial");
  });

  it("429 with Retry-After fails the tool and writes no row", async () => {
    stubFetch(() => new Response("{}", { status: 429, headers: { "retry-after": "60" } }));
    const { store, result } = await runShard([tool("alpha")], {});
    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 0, failed: 1 });
    expect(result.status).toBe("partial");
  });

  it("429 with Retry-After closes the budget: the second tool is skipped and no second /repos call is made", async () => {
    const calls = stubFetch(() => new Response("{}", { status: 429, headers: { "retry-after": "60" } }));
    const { store, result } = await runShard([tool("alpha"), tool("beta")], {});
    expect(calls.filter((c) => c.url.startsWith("/repos/"))).toHaveLength(1);
    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ attempted: 2, recorded: 0, failed: 1, skipped_timeout: 1 });
    expect(result.status).toBe("partial");
    expect(result.error).toMatch(/budget exhausted: 0 remaining/);
  });

  it("403 on commits in authenticated mode fails the tool; no stored commit_count_30d of 0", async () => {
    stubFetch((url) =>
      url.endsWith("/rate_limit")
        ? ok({ resources: { core: { remaining: 5000, reset: HOUR_AHEAD, limit: 5000 } } })
        : url.includes("/commits")
          ? new Response("{}", { status: 403, statusText: "Forbidden" })
          : url.includes("/contributors")
            ? ok([{}])
            : ok(REPO_BODY, { "x-ratelimit-remaining": "4990", "x-ratelimit-reset": String(HOUR_AHEAD) })
    );
    const { store, result } = await runShard([tool("alpha")], { GITHUB_TOKEN: "tok" });
    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ recorded: 0, failed: 1 });
    expect(result.status).toBe("partial");
  });
});

describe("#95 request budget guard", () => {
  it("stops fetching when the header-reported remaining is below need; the rest are skipped and the ledger says why", async () => {
    // Authenticated tool needs 3 requests. /rate_limit reports 5, so tool 1 runs and leaves 2 (< 3).
    let remaining = 5;
    const calls = stubFetch((url) => {
      if (url.endsWith("/rate_limit")) return ok({ resources: { core: { remaining, reset: HOUR_AHEAD, limit: 5000 } } });
      remaining -= 1;
      const headers = { "x-ratelimit-remaining": String(remaining), "x-ratelimit-reset": String(HOUR_AHEAD), "x-ratelimit-limit": "5000" };
      return url.includes("/commits") || url.includes("/contributors") ? ok([{}], headers) : ok(REPO_BODY, headers);
    });
    const tools = ["alpha", "beta", "gamma", "delta"].map(tool);
    const { store, result } = await runShard(tools, { GITHUB_TOKEN: "tok" }, 500);

    expect(store.rows.size).toBe(1);
    expect(result.counts).toMatchObject({ attempted: 4, recorded: 1, failed: 0, not_found: 0, skipped_timeout: 3 });
    expect(result.status).toBe("partial");
    expect(result.error).toMatch(/budget exhausted: 2 remaining, 3 needed/);
    expect(calls.filter((c) => c.url.startsWith("/repos/") && !c.url.includes("/commits") && !c.url.includes("/contributors"))).toHaveLength(1);
    // The ledger row carries N and the counts.
    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.counts).toEqual(result.counts);
    expect(store.runs[0]?.status).toBe("partial");
  });

  it("unauthenticated, stops once remaining reaches 0 and does not sleep for the reset", async () => {
    let remaining = 2;
    stubFetch(() => {
      remaining -= 1;
      return ok(REPO_BODY, { "x-ratelimit-remaining": String(remaining), "x-ratelimit-reset": String(HOUR_AHEAD), "x-ratelimit-limit": "60" });
    });
    const started = Date.now();
    const { result } = await runShard(["a", "b", "c", "d"].map(tool), {}, 2_000);
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(result.counts).toMatchObject({ attempted: 4, recorded: 2, skipped_timeout: 2 });
    expect(result.status).toBe("partial");
  });

  it("budget is open again once the reported reset time has passed", async () => {
    stubFetch(() => ok(REPO_BODY, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(HOUR_AHEAD) }));
    const collector = new GitHubMetricsCollector(undefined);
    await collector.fetchMetrics("org", "alpha");
    expect(collector.budgetStopReason()).toMatch(/budget exhausted: 0 remaining/);
    expect(collector.budgetStopReason((HOUR_AHEAD + 1) * 1000)).toBeNull();
  });
});

describe("#95 rate-limit state comes from response headers", () => {
  it("is unknown before any response and equals the headers after one (not an assumed 5000)", async () => {
    stubFetch(() => ok(REPO_BODY, { "x-ratelimit-remaining": "57", "x-ratelimit-reset": "1893456000", "x-ratelimit-limit": "60" }));
    const collector = new GitHubMetricsCollector(undefined);
    expect(collector.getRateLimit()).toEqual({ remaining: null, reset: null, limit: null });
    await collector.fetchMetrics("org", "alpha");
    expect(collector.getRateLimit()).toEqual({ remaining: 57, reset: 1893456000, limit: 60 });
  });
});
