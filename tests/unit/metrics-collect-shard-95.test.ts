/**
 * #95: one metrics-history shard — idempotency, merge, counts, flags, deadline.
 *
 * Why: each collector shard runs in its own cron invocation and writes the
 *   private history table. A re-run must not duplicate rows, two collectors must
 *   not overwrite each other, the counts must account for every tool, and a
 *   shard that runs out of time or hits a database error must say so.
 * What: drives `runMetricsShard()` with fake adapters and an in-memory store
 *   whose upsert has the same contract as the real SQL: one row per
 *   (tool_id, collected_date), `metrics` merged by top-level key (`||`). The
 *   real SQL text is pinned in `metrics-collect-route-95.test.ts`.
 * Test: `npx vitest run tests/unit/metrics-collect-shard-95.test.ts`. No network, no database.
 */

import { describe, expect, it } from "vitest";
import type { CollectOutcome, CollectorAdapter, CollectorTool } from "../../lib/metrics-collectors/registry";
import {
  collectionDay,
  type HistoryRow,
  type MetricsHistoryStore,
  runMetricsShard,
  type ShardCounts,
  type ShardResult,
  shardOf,
} from "../../lib/metrics-history/collect-shard";

const DAY = Date.UTC(2026, 10, 1, 2, 0, 0); // 2026-11-01T02:00:00Z

function tool(slug: string): CollectorTool {
  return { id: `id-${slug}`, slug, name: slug.replace(/-/g, " "), data: {} };
}

const TOOLS = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"].map(tool);

/** In-memory store with the real upsert contract. */
class MemoryStore implements MetricsHistoryStore {
  rows = new Map<string, HistoryRow>();
  runs = new Map<string, ShardResult>();
  failUpsertAt: number | null = null;
  failLedger = false;
  private upserts = 0;

  constructor(private tools: CollectorTool[] = TOOLS) {}

  async listTools() {
    return this.tools;
  }

  async upsertMetrics(row: HistoryRow) {
    this.upserts++;
    if (this.failUpsertAt !== null && this.upserts >= this.failUpsertAt) throw new Error("connection reset");
    const key = `${row.toolId}|${row.collectedDate}`;
    const existing = this.rows.get(key);
    this.rows.set(key, { ...row, metrics: { ...(existing?.metrics ?? {}), ...row.metrics } });
  }

  async recordRun(result: ShardResult) {
    if (this.failLedger) throw new Error("ledger down");
    this.runs.set(`${result.collectedDate}|${result.part}|${result.shard}`, result);
  }
}

function adapter(collect: (t: CollectorTool) => Promise<CollectOutcome>): () => CollectorAdapter {
  return () => ({ init: async () => {}, collect, pause: async () => {} });
}

const found = (metrics: Record<string, unknown>) => async (): Promise<CollectOutcome> => ({ kind: "found", metrics });

function sum(c: ShardCounts): number {
  return c.recorded + c.not_found + c.failed + c.skipped_timeout;
}

describe("#95 shardOf", () => {
  it("puts every slug in exactly one shard in 0..of-1, the same shard every call", () => {
    for (const of of [1, 2, 4]) {
      for (const t of TOOLS) {
        const s = shardOf(t.slug, of);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(of);
        expect(shardOf(t.slug, of)).toBe(s);
      }
    }
  });

  it("runs every tool exactly once across all shards", async () => {
    const seen: string[] = [];
    for (let shard = 0; shard < 4; shard++) {
      await runMetricsShard(
        { part: "npm", shard, of: 4 },
        { store: new MemoryStore(), createAdapter: adapter(async (t) => (seen.push(t.slug), { kind: "not_found" })), now: () => DAY }
      );
    }
    expect([...seen].sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });
});

describe("#95 collected_date", () => {
  it("is the UTC invocation day", () => {
    // 2026-10-31 23:30 in New York is 2026-11-01 03:30 UTC.
    expect(collectionDay(Date.parse("2026-10-31T23:30:00-04:00"))).toEqual({ collectedDate: "2026-11-01", period: "2026-11" });
  });
});

describe("#95 runMetricsShard", () => {
  it("running twice on the same date leaves one row per tool", async () => {
    const store = new MemoryStore();
    const deps = { store, createAdapter: adapter(found({ downloads_last_month: 5 })), now: () => DAY };
    await runMetricsShard({ part: "github", shard: 0, of: 1 }, deps);
    await runMetricsShard({ part: "github", shard: 0, of: 1 }, deps);

    expect(store.rows.size).toBe(TOOLS.length);
    expect(store.runs.size).toBe(1);
  });

  it("two collectors on the same date leave both keys in one row", async () => {
    const store = new MemoryStore();
    await runMetricsShard({ part: "github", shard: 0, of: 1 }, { store, createAdapter: adapter(found({ stars: 10 })), now: () => DAY });
    // pypi has two shards; run both so every tool gets a pypi key.
    for (const shard of [0, 1]) {
      await runMetricsShard(
        { part: "pypi", shard, of: 2 },
        { store, createAdapter: adapter(found({ downloads_last_month: 7 })), now: () => DAY + 600_000 }
      );
    }

    expect(store.rows.size).toBe(TOOLS.length);
    for (const row of store.rows.values()) {
      expect(Object.keys(row.metrics).sort()).toEqual(["github", "pypi"]);
      expect(row.metrics["github"]?.["stars"]).toMatchObject({ value: 10, source: "github-api" });
      expect(row.metrics["pypi"]?.["downloads_last_month"]).toMatchObject({ value: 7, source: "pypi" });
      expect(row.collectedDate).toBe("2026-11-01");
      expect(row.period).toBe("2026-11");
    }
  });

  it("counts add up to attempted, in the result and in the ledger", async () => {
    const store = new MemoryStore();
    const outcomes: Record<string, () => Promise<CollectOutcome>> = {
      alpha: found({ downloads_last_month: 1 }),
      beta: async () => ({ kind: "not_found" }),
      gamma: async () => {
        throw new Error("registry exploded");
      },
      delta: found({ downloads_last_month: "1.2k" }),
      epsilon: async () => ({ kind: "failed", error: "No metrics returned" }),
    };
    const { result, ledgerError } = await runMetricsShard(
      { part: "npm", shard: 0, of: 1 },
      { store, createAdapter: adapter(async (t) => (outcomes[t.slug] ?? (async () => ({ kind: "not_found" })))()), now: () => DAY }
    );

    expect(ledgerError).toBeNull();
    expect(result.counts).toEqual({ attempted: 8, recorded: 2, flagged: 1, not_found: 4, failed: 2, skipped_timeout: 0 });
    expect(sum(result.counts)).toBe(result.counts.attempted);
    expect(result.status).toBe("partial");
    expect(store.runs.get("2026-11-01|npm|0")?.counts).toEqual(result.counts);
  });

  it("stores a string in a numeric key with flags non_numeric and counts it as flagged", async () => {
    const store = new MemoryStore([tool("alpha")]);
    const { result } = await runMetricsShard(
      { part: "npm", shard: 0, of: 1 },
      {
        store,
        createAdapter: adapter(found({ downloads_last_month: "12,345", downloads_last_week: 9, license: "MIT" })),
        now: () => DAY,
      }
    );

    const npm = store.rows.get("id-alpha|2026-11-01")?.metrics["npm"];
    expect(npm?.["downloads_last_month"]).toEqual({
      value: "12,345",
      source: "npm-registry",
      as_of: "2026-11-01T02:00:00.000Z",
      flags: ["non_numeric"],
    });
    expect(npm?.["downloads_last_week"]?.flags).toBeUndefined();
    expect(npm?.["license"]?.flags).toBeUndefined();
    expect(result.counts.flagged).toBe(1);
    expect(result.counts.recorded).toBe(1);
    expect(result.status).toBe("ok");
  });

  it("past the deadline it reports partial with skipped_timeout > 0", async () => {
    let clock = DAY;
    const store = new MemoryStore();
    const { result } = await runMetricsShard(
      { part: "vscode", shard: 0, of: 1 },
      {
        store,
        createAdapter: adapter(async () => {
          clock += 100_000; // each tool takes 100 s of fake time
          return { kind: "found", metrics: { installs: 1 } };
        }),
        now: () => clock,
        deadlineMs: 270_000,
      }
    );

    expect(result.status).toBe("partial");
    expect(result.counts.recorded).toBe(2);
    expect(result.counts.skipped_timeout).toBe(6);
    expect(sum(result.counts)).toBe(result.counts.attempted);
    expect(store.runs.get("2026-11-01|vscode|0")?.status).toBe("partial");
  });

  it("a miss returned after the deadline aborted its fetches counts as skipped_timeout, not not_found", async () => {
    let clock = DAY;
    const { result } = await runMetricsShard(
      { part: "npm", shard: 0, of: 1 },
      {
        store: new MemoryStore([tool("alpha")]),
        createAdapter: adapter(async () => {
          clock += 300_000;
          return { kind: "not_found" };
        }),
        now: () => clock,
      }
    );
    expect(result.counts).toMatchObject({ attempted: 1, not_found: 0, skipped_timeout: 1 });
  });

  it("a deadline crossed mid-shard keeps every count, summing to attempted", async () => {
    // #95 fix round: the loop-top break overwrote skipped_timeout, dropping the in-loop count.
    let clock = DAY;
    const { result } = await runMetricsShard(
      { part: "npm", shard: 0, of: 1 },
      {
        store: new MemoryStore(),
        createAdapter: adapter(async () => {
          clock += 100_000;
          return { kind: "not_found" };
        }),
        now: () => clock,
        deadlineMs: 270_000,
      }
    );
    expect(result.counts).toEqual({ attempted: 8, recorded: 0, flagged: 0, not_found: 2, failed: 0, skipped_timeout: 6 });
    expect(sum(result.counts)).toBe(result.counts.attempted);
  });

  it("a found result returned after the deadline writes no row and counts as skipped_timeout", async () => {
    // #95 fix round: collectors turn aborted sub-fetches into 0, so a late `found` may hold false zeros.
    let clock = DAY;
    const store = new MemoryStore([tool("alpha")]);
    const { result } = await runMetricsShard(
      { part: "github", shard: 0, of: 1 },
      {
        store,
        createAdapter: adapter(async () => {
          clock += 300_000;
          return { kind: "found", metrics: { stars: 0, commit_count_30d: 0 } };
        }),
        now: () => clock,
      }
    );
    expect(store.rows.size).toBe(0);
    expect(result.counts).toMatchObject({ attempted: 1, recorded: 0, skipped_timeout: 1 });
    expect(result.status).toBe("partial");
  });

  it("aborts the adapter's signal at the deadline", async () => {
    let seen: AbortSignal | undefined;
    await runMetricsShard(
      { part: "npm", shard: 0, of: 1 },
      {
        store: new MemoryStore([tool("alpha")]),
        createAdapter: (signal) => {
          seen = signal;
          return { init: async () => {}, collect: () => new Promise((r) => setTimeout(() => r({ kind: "not_found" }), 50)), pause: async () => {} };
        },
        deadlineMs: 10,
      }
    );
    expect(seen?.aborted).toBe(true);
  });

  it("a database throw fails the shard, keeps the counts whole, and still writes the ledger", async () => {
    const store = new MemoryStore();
    store.failUpsertAt = 3;
    const { result, ledgerError } = await runMetricsShard(
      { part: "github", shard: 0, of: 1 },
      { store, createAdapter: adapter(found({ stars: 1 })), now: () => DAY }
    );

    expect(result.status).toBe("failed");
    expect(result.error).toBe("connection reset");
    expect(result.counts).toMatchObject({ attempted: 8, recorded: 2, failed: 6 });
    expect(sum(result.counts)).toBe(result.counts.attempted);
    expect(ledgerError).toBeNull();
    expect(store.runs.get("2026-11-01|github|0")?.status).toBe("failed");
  });

  it("an adapter that cannot start (no token) fails the shard with every tool counted failed", async () => {
    const { result } = await runMetricsShard(
      { part: "github", shard: 0, of: 1 },
      {
        store: new MemoryStore(),
        createAdapter: () => ({
          init: async () => {
            throw new Error("GITHUB_TOKEN is not set");
          },
          collect: async () => ({ kind: "not_found" }),
          pause: async () => {},
        }),
        now: () => DAY,
      }
    );
    expect(result.status).toBe("failed");
    expect(result.counts).toMatchObject({ attempted: 8, failed: 8 });
  });

  it("reports a ledger write failure instead of hiding it", async () => {
    const store = new MemoryStore();
    store.failLedger = true;
    const { result, ledgerError } = await runMetricsShard(
      { part: "github", shard: 0, of: 1 },
      { store, createAdapter: adapter(found({ stars: 1 })), now: () => DAY }
    );
    expect(result.status).toBe("ok");
    expect(ledgerError).toBe("ledger down");
  });

  it("when one shard fails, the other shards are still recorded", async () => {
    const store = new MemoryStore();
    const results: ShardResult[] = [];
    for (let shard = 0; shard < 4; shard++) {
      store.failUpsertAt = shard === 1 ? 1 : null;
      const { result } = await runMetricsShard(
        { part: "npm", shard, of: 4 },
        { store, createAdapter: adapter(found({ downloads_last_month: 3 })), now: () => DAY }
      );
      results.push(result);
    }

    const failedShard = results[1] as ShardResult;
    expect(failedShard.counts.attempted).toBeGreaterThan(0);
    expect(failedShard.status).toBe("failed");
    for (const shard of [0, 2, 3]) {
      expect(store.runs.get(`2026-11-01|npm|${shard}`)?.status).toBe("ok");
    }
    expect(store.runs.get("2026-11-01|npm|1")?.status).toBe("failed");
    const okTools = results.filter((r) => r.status === "ok").reduce((n, r) => n + r.counts.recorded, 0);
    expect(store.rows.size).toBe(okTools);
    expect(okTools).toBe(TOOLS.length - failedShard.counts.attempted);
  });
});
