/**
 * #95: the github collector's token name, a repo 404, and the github shard count.
 *
 * Why: tokenless, the github shard stopped after at most 60 tools (60 requests an
 *   hour) and every stale repo URL failed the shard. Owner ruling D99 allows one
 *   read-only token for the metrics cron, read from `METRICS_GITHUB_TOKEN` only.
 * What: drives the real github adapter through `runMetricsShard()` with a fetch stub
 *   and an in-memory store. Checks: `METRICS_GITHUB_TOKEN` selects the authenticated
 *   path and `GITHUB_TOKEN` no longer does; only the registry reads the name; a 404 on
 *   `/repos` is `not_found` and leaves the shard `ok`, while a 404 after the repo
 *   resolved, a 500, a 403 and a 429 stay `failed`; a mass 404 still fails the
 *   metrics-history check through the github coverage floor; and SHARD_COUNTS.github
 *   fits 200 authenticated tools in 70% of the shard deadline. Fake token values only.
 * Test: `npx vitest run tests/unit/metrics-github-token-shards-95.test.ts`. No network, no database.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REQUESTS_PER_TOOL_AUTH } from "../../lib/metrics-collectors/github";
import * as registry from "../../lib/metrics-collectors/registry";
import {
  COLLECTOR_PARTS,
  type CollectorAdapter,
  type CollectorTool,
  createCollectorAdapter,
  SHARD_COUNTS,
} from "../../lib/metrics-collectors/registry";
import { type LedgerRow, renderMetricsHistoryReport } from "../../lib/metrics-history/check-report";
import {
  type HistoryRow,
  type MetricsHistoryStore,
  runMetricsShard,
  SHARD_DEADLINE_MS,
  type ShardResult,
} from "../../lib/metrics-history/collect-shard";

const ROOT = path.resolve(__dirname, "../..");
const DAY = Date.UTC(2026, 11, 1, 4, 0, 0);
const HOUR_AHEAD = Math.floor(Date.now() / 1000) + 3600;
const FAKE_TOKEN = "fake-test-token-not-a-secret";

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

function stubFetch(handler: (url: string) => Response): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: String(url).replace("https://api.github.com", ""), authorization: headers["Authorization"] });
      return handler(String(url));
    })
  );
  return calls;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const REPO_BODY = { stargazers_count: 7, forks_count: 2, watchers_count: 7, open_issues_count: 1 };
const RATE_LIMIT = { resources: { core: { remaining: 5000, reset: HOUR_AHEAD, limit: 5000 } } };

/** Answers /rate_limit, then `repo`, `commits` and `contributors` per endpoint. */
function github(answers: { repo?: () => Response; commits?: () => Response; contributors?: () => Response } = {}) {
  return (url: string): Response => {
    if (url.endsWith("/rate_limit")) return json(RATE_LIMIT);
    if (url.includes("/commits")) return (answers.commits ?? (() => json([{}, {}])))();
    if (url.includes("/contributors")) return (answers.contributors ?? (() => json([{}])))();
    return (answers.repo ?? (() => json(REPO_BODY)))();
  };
}

async function runShard(tools: CollectorTool[], env: Record<string, string | undefined>) {
  const store = new MemoryStore(tools);
  const createAdapter = (signal: AbortSignal): CollectorAdapter => ({
    ...createCollectorAdapter("github", { env, signal }),
    pause: async () => {},
  });
  const { result } = await runMetricsShard(
    { part: "github", shard: 0, of: 1 },
    { store, createAdapter, now: () => DAY, deadlineMs: 5_000 }
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

describe("#95 the github token comes from METRICS_GITHUB_TOKEN only", () => {
  it("METRICS_GITHUB_TOKEN selects the authenticated path: Bearer auth, rate_limit, repo, commits, contributors", async () => {
    const calls = stubFetch(github());
    const { store, result } = await runShard([tool("alpha")], { METRICS_GITHUB_TOKEN: FAKE_TOKEN });

    expect(result.status).toBe("ok");
    expect(calls.map((c) => c.url.split("?")[0])).toEqual([
      "/rate_limit",
      "/repos/org/alpha",
      "/repos/org/alpha/commits",
      "/repos/org/alpha/contributors",
    ]);
    expect(calls.every((c) => c.authorization === `Bearer ${FAKE_TOKEN}`)).toBe(true);
    const leaves = store.rows.get("id-alpha")?.metrics["github"] ?? {};
    expect(leaves["commit_count_30d"]?.value).toBe(2);
    expect(leaves["contributors_count"]?.value).toBe(1);
  });

  it("GITHUB_TOKEN alone is ignored: no Authorization, repo metadata only", async () => {
    const calls = stubFetch(github());
    const { store, result } = await runShard([tool("alpha")], { GITHUB_TOKEN: FAKE_TOKEN });

    // #95: tokenless is degraded, so the shard is partial even though the tool was recorded.
    expect(result.status).toBe("partial");
    expect(result.counts).toMatchObject({ recorded: 1, failed: 0 });
    expect(calls.map((c) => c.url)).toEqual(["/repos/org/alpha"]);
    expect(calls.every((c) => c.authorization === undefined)).toBe(true);
    expect("commit_count_30d" in (store.rows.get("id-alpha")?.metrics["github"] ?? {})).toBe(false);
  });

  it("lib/metrics-collectors/registry.ts is the only non-test file that names METRICS_GITHUB_TOKEN", () => {
    const files = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter((f) => /\.(ts|tsx|js|mjs|cjs|json|ya?ml|sh|env.*)$/.test(f) || /(^|\/)\.env/.test(f))
      .filter((f) => !f.startsWith("tests/") && f !== "data/changelog-entries.generated.json");
    const readers = files.filter((f) => {
      try {
        return readFileSync(path.join(ROOT, f), "utf8").includes("METRICS_GITHUB_TOKEN");
      } catch {
        return false; // listed but deleted in the working tree
      }
    });
    expect(readers).toEqual(["lib/metrics-collectors/registry.ts"]);
  });

  it.each(["lib/metrics-collectors/registry.ts", "lib/metrics-collectors/github.ts"])(
    "%s no longer reads GITHUB_TOKEN",
    (file) => {
      expect(readFileSync(path.join(ROOT, file), "utf8")).not.toMatch(/(?<!METRICS_)GITHUB_TOKEN/);
    }
  );
});

describe("#95 a repo 404 is not_found; every other error stays failed", () => {
  // #95: without a token the shard is partial for the tokenless reason alone, not for the 404.
  it.each([
    ["without a token", {}, "partial"],
    ["with a token", { METRICS_GITHUB_TOKEN: FAKE_TOKEN }, "ok"],
  ])("404 on /repos %s: not_found, no row, shard %s", async (_name, env, status) => {
    stubFetch(github({ repo: () => new Response("{}", { status: 404, statusText: "Not Found" }) }));
    const { store, result } = await runShard([tool("alpha")], env);

    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 0, not_found: 1, failed: 0, skipped_timeout: 0 });
    expect(result.status).toBe(status);
  });

  it.each([
    ["a 404 on commits after the repo resolved", { commits: () => new Response("{}", { status: 404 }) }],
    ["a 404 on contributors after the repo resolved", { contributors: () => new Response("{}", { status: 404 }) }],
    ["a 500 on /repos", { repo: () => new Response("{}", { status: 500 }) }],
    ["a 403 on /repos", { repo: () => new Response("{}", { status: 403 }) }],
    ["a 429 on /repos", { repo: () => new Response("{}", { status: 429 }) }],
  ])("%s fails the tool and writes no 0", async (_name, answers) => {
    stubFetch(github(answers));
    const { store, result } = await runShard([tool("alpha")], { METRICS_GITHUB_TOKEN: FAKE_TOKEN });

    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ recorded: 0, not_found: 0, failed: 1 });
    expect(result.status).toBe("partial");
  });

  it("a mass 404 leaves every github shard ok but fails the check through the coverage floor", async () => {
    stubFetch(github({ repo: () => new Response("{}", { status: 404 }) }));
    const tools = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(tool);
    const { store, result } = await runShard(tools, { METRICS_GITHUB_TOKEN: FAKE_TOKEN });
    expect(result.status).toBe("ok");
    expect(result.counts).toMatchObject({ attempted: 10, not_found: 10, failed: 0 });

    const ledgerRow = (part: string, shard: number): LedgerRow => ({
      collector: part,
      shard,
      shard_count: SHARD_COUNTS[part as keyof typeof SHARD_COUNTS],
      status: "ok",
      attempted: part === "github" ? result.counts.attempted : 10,
      recorded: part === "github" ? result.counts.recorded : 10,
      flagged: 0,
      not_found: part === "github" ? result.counts.not_found : 0,
      failed: 0,
      skipped_timeout: 0,
    });
    const ledger = COLLECTOR_PARTS.flatMap((part) => [...Array(SHARD_COUNTS[part]).keys()].map((s) => ledgerRow(part, s)));
    // Every tool has a GitHub URL, so all 10 are eligible; a 404 writes no github key.
    const { exitCode, report } = renderMetricsHistoryReport({
      date: "2026-12-01",
      rowsPerDate: [],
      ledger,
      coverage: { tools: 10, rows: store.rows.size },
      previousDate: null,
      flat: [],
      partCoverage: [{ part: "github", eligible: tools.length, recorded: store.rows.size }],
    });
    expect(report).not.toMatch(/github \d+\/\d+: (partial|failed|MISSING)/);
    expect(report).toContain("github: 0 of 10 eligible (0%) FAIL under the floor of 80%");
    expect(exitCode).toBe(3);
  });
});

// #95: a github run without METRICS_GITHUB_TOKEN (unset, blank or misspelt in Vercel) must not
// pass as a clean `ok`: it keeps its stars rows but ends `partial`, so the check fails it.
describe("#95 a tokenless github run is degraded, not ok", () => {
  it.each([
    ["unset", {}],
    ["blank", { METRICS_GITHUB_TOKEN: "  " }],
    ["misspelt", { METRIC_GITHUB_TOKEN: FAKE_TOKEN }],
  ])("token %s: stars are written, the shard is partial and names the missing variable", async (_name, env) => {
    stubFetch(github());
    const { store, result } = await runShard([tool("alpha"), tool("beta")], env);

    expect(store.rows.size).toBe(2);
    expect(store.rows.get("id-alpha")?.metrics["github"]?.["stars"]?.value).toBe(7);
    expect(result.counts).toMatchObject({ attempted: 2, recorded: 2, failed: 0, skipped_timeout: 0 });
    expect(result.status).toBe("partial");
    expect(result.error).toMatch(/METRICS_GITHUB_TOKEN is not set/);
    expect(result.error).not.toContain(FAKE_TOKEN);
    expect(store.runs[0]?.status).toBe("partial");
  });

  it("the metrics-history check fails a month whose github shards ran tokenless", async () => {
    stubFetch(github());
    const { result } = await runShard([tool("alpha")], {});
    const ledger: LedgerRow[] = COLLECTOR_PARTS.flatMap((part) =>
      [...Array(SHARD_COUNTS[part]).keys()].map((shard) => ({
        collector: part,
        shard,
        shard_count: SHARD_COUNTS[part],
        status: part === "github" ? result.status : "ok",
        attempted: 1,
        recorded: 1,
        flagged: 0,
        not_found: 0,
        failed: 0,
        skipped_timeout: 0,
      }))
    );
    const { exitCode, report } = renderMetricsHistoryReport({
      date: "2026-12-01",
      rowsPerDate: [],
      ledger,
      coverage: { tools: 1, rows: 1 },
      previousDate: null,
      flat: [],
      partCoverage: [{ part: "github", eligible: 1, recorded: 1 }],
    });
    expect(report).toContain(`github 0/${SHARD_COUNTS.github}: partial`);
    expect(exitCode).toBe(3);
  });
});

describe("#95 a 401 is a failure", () => {
  it("a 401 on /rate_limit fails the shard with no rows", async () => {
    stubFetch((url) => (url.endsWith("/rate_limit") ? new Response("{}", { status: 401 }) : json(REPO_BODY)));
    const { store, result } = await runShard([tool("alpha"), tool("beta")], { METRICS_GITHUB_TOKEN: FAKE_TOKEN });

    expect(store.rows.size).toBe(0);
    expect(result.status).toBe("failed");
    expect(result.counts).toMatchObject({ attempted: 2, recorded: 0, failed: 2 });
  });

  it("a 401 on /repos mid-run fails that tool, not not_found", async () => {
    stubFetch(
      github({
        repo: (() => {
          let n = 0;
          return () => (++n === 1 ? json(REPO_BODY) : new Response("{}", { status: 401 }));
        })(),
      })
    );
    const { store, result } = await runShard([tool("alpha"), tool("beta")], { METRICS_GITHUB_TOKEN: FAKE_TOKEN });

    expect(store.rows.size).toBe(1);
    expect(result.counts).toMatchObject({ attempted: 2, recorded: 1, not_found: 0, failed: 1 });
    expect(result.status).toBe("partial");
  });
});

describe("#95 github shard count", () => {
  // Design: 200 eligible tools (about 190 today), each costing REQUESTS_PER_TOOL_AUTH sequential
  // requests at a 1 s design latency plus the adapter's pause, inside 70% of the deadline.
  const DESIGN_TOOLS = 200;
  const DESIGN_REQUEST_MS = 1_000;

  it("the largest expected github shard finishes inside 70% of the shard deadline with a token", () => {
    const pauseMs = (registry as Record<string, unknown>)["GITHUB_PAUSE_MS"];
    expect(pauseMs).toBe(1_000);
    const perToolMs = REQUESTS_PER_TOOL_AUTH * DESIGN_REQUEST_MS + (pauseMs as number);
    const of = SHARD_COUNTS.github;
    // FNV-1a mod `of` spreads slugs about binomially: allow the mean plus two standard deviations.
    const p = 1 / of;
    const largestShard = Math.ceil(DESIGN_TOOLS * p + 2 * Math.sqrt(DESIGN_TOOLS * p * (1 - p)));
    expect(largestShard * perToolMs).toBeLessThanOrEqual(0.7 * SHARD_DEADLINE_MS);
  });
});
