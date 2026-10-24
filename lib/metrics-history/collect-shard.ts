/**
 * One collector shard of the monthly metrics-history collection (#95).
 *
 * Why: a whole collector does not fit in one 300 s cron invocation, so each
 *   collector is split into shards, one invocation each. A shard must record
 *   what it reached, stop before Vercel kills it, and leave other shards alone.
 * What: picks the tools whose `shardOf(slug, of)` is this shard, collects each
 *   with the part's adapter, and upserts one history row per found tool. It
 *   stops starting tools at the deadline (270 s) and counts the rest as
 *   `skipped_timeout`; the deadline also aborts in-flight fetches. A store
 *   throw is fatal: the shard is `failed` and the unreached tools count as
 *   failed, so recorded + not_found + failed + skipped_timeout = attempted
 *   always holds. The result is then written to the ledger; a ledger throw
 *   is reported, not hidden. It writes no other table.
 * Test: `tests/unit/metrics-collect-shard-95.test.ts`
 */

import {
  type CollectorAdapter,
  type CollectorPart,
  type CollectorTool,
  NUMERIC_KEYS,
  PART_SOURCES,
} from "../metrics-collectors/registry";

export const SHARD_DEADLINE_MS = 270_000;

export interface MetricLeaf {
  value: unknown;
  source: string;
  as_of: string;
  flags?: string[];
}

export interface HistoryRow {
  toolId: string;
  toolSlug: string;
  collectedDate: string;
  period: string;
  /** `{ [part]: { [key]: MetricLeaf } }` — one top-level key per collector. */
  metrics: Record<string, Record<string, MetricLeaf>>;
}

export interface ShardCounts {
  attempted: number;
  recorded: number;
  /** Subset of `recorded`: rows with at least one `non_numeric` leaf. */
  flagged: number;
  not_found: number;
  failed: number;
  skipped_timeout: number;
}

export type ShardStatus = "ok" | "partial" | "failed";

export interface ShardResult {
  part: CollectorPart;
  shard: number;
  of: number;
  collectedDate: string;
  period: string;
  status: ShardStatus;
  counts: ShardCounts;
  error: string | null;
  startedAt: Date;
  finishedAt: Date;
}

/** The only persistence a shard uses. `listTools` reads; the other two write history tables only. */
export interface MetricsHistoryStore {
  listTools(): Promise<CollectorTool[]>;
  upsertMetrics(row: HistoryRow): Promise<void>;
  recordRun(result: ShardResult): Promise<void>;
}

export interface ShardRequest {
  part: CollectorPart;
  shard: number;
  of: number;
}

export interface ShardDeps {
  store: MetricsHistoryStore;
  createAdapter: (signal: AbortSignal) => CollectorAdapter;
  /** Epoch ms clock; the deadline and `collected_date` are taken from it. */
  now?: () => number;
  deadlineMs?: number;
}

export interface ShardOutcome {
  result: ShardResult;
  /** null when the ledger row was written. */
  ledgerError: string | null;
}

/** Stable shard index: FNV-1a of the slug, mod `of`. Adding a tool moves no other tool. */
export function shardOf(slug: string, of: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % of;
}

/** `collected_date` (UTC invocation day) and `period` (YYYY-MM) for an epoch-ms instant. */
export function collectionDay(epochMs: number): { collectedDate: string; period: string } {
  const collectedDate = new Date(epochMs).toISOString().slice(0, 10);
  return { collectedDate, period: collectedDate.slice(0, 7) };
}

/** Wraps each raw metric in a leaf; a numeric key holding a non-number keeps its value and gets `non_numeric`. */
export function buildLeaves(
  part: CollectorPart,
  raw: Record<string, unknown>,
  asOf: string
): { leaves: Record<string, MetricLeaf>; flagged: boolean } {
  const numeric = new Set(NUMERIC_KEYS[part]);
  const leaves: Record<string, MetricLeaf> = {};
  let flagged = false;
  for (const [key, value] of Object.entries(raw)) {
    const leaf: MetricLeaf = { value, source: PART_SOURCES[part], as_of: asOf };
    if (numeric.has(key) && !(typeof value === "number" && Number.isFinite(value))) {
      leaf.flags = ["non_numeric"];
      flagged = true;
    }
    leaves[key] = leaf;
  }
  return { leaves, flagged };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Runs one shard and writes its ledger row. Never throws. */
export async function runMetricsShard(request: ShardRequest, deps: ShardDeps): Promise<ShardOutcome> {
  const now = deps.now ?? Date.now;
  const deadlineMs = deps.deadlineMs ?? SHARD_DEADLINE_MS;
  const startMs = now();
  const deadline = startMs + deadlineMs;
  const { collectedDate, period } = collectionDay(startMs);
  const counts: ShardCounts = { attempted: 0, recorded: 0, flagged: 0, not_found: 0, failed: 0, skipped_timeout: 0 };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("shard deadline reached")), deadlineMs);
  const pastDeadline = () => controller.signal.aborted || now() >= deadline;

  let status: ShardStatus = "ok";
  let error: string | null = null;
  let done = 0;

  try {
    const adapter = deps.createAdapter(controller.signal);
    const members = (await deps.store.listTools())
      .filter((tool) => shardOf(tool.slug, request.of) === request.shard)
      .sort((a, b) => a.slug.localeCompare(b.slug));
    counts.attempted = members.length;
    await adapter.init();

    for (const tool of members) {
      if (pastDeadline()) {
        counts.skipped_timeout = members.length - done;
        break;
      }
      let outcome;
      try {
        outcome = await adapter.collect(tool);
      } catch (collectError) {
        outcome = { kind: "failed" as const, error: message(collectError) };
      }

      if (outcome.kind === "found") {
        const { leaves, flagged } = buildLeaves(request.part, outcome.metrics, new Date(now()).toISOString());
        // A store throw propagates: the shard fails rather than reporting a row it did not write.
        await deps.store.upsertMetrics({
          toolId: tool.id,
          toolSlug: tool.slug,
          collectedDate,
          period,
          metrics: { [request.part]: leaves },
        });
        counts.recorded++;
        if (flagged) counts.flagged++;
      } else if (pastDeadline()) {
        // The deadline aborted this tool's fetches, so its miss is not a real result.
        counts.skipped_timeout++;
      } else if (outcome.kind === "not_found") {
        counts.not_found++;
      } else {
        counts.failed++;
      }
      done++;

      const noRequest = outcome.kind === "not_found" && outcome.noRequest === true;
      if (done < members.length && !noRequest) await adapter.pause(controller.signal);
    }

    if (counts.failed > 0 || counts.skipped_timeout > 0) status = "partial";
  } catch (fatal) {
    status = "failed";
    error = message(fatal);
    counts.failed += counts.attempted - (counts.recorded + counts.not_found + counts.failed + counts.skipped_timeout);
  } finally {
    clearTimeout(timer);
  }

  const result: ShardResult = {
    ...request,
    collectedDate,
    period,
    status,
    counts,
    error,
    startedAt: new Date(startMs),
    finishedAt: new Date(now()),
  };

  let ledgerError: string | null = null;
  try {
    await deps.store.recordRun(result);
  } catch (ledgerFailure) {
    ledgerError = message(ledgerFailure);
  }
  return { result, ledgerError };
}
