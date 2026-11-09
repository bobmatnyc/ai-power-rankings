/**
 * Crawl spend by provider (#393): pure aggregation over per-provider, per-UTC-day
 * totals of the `provider_usage_events` ledger. No database access.
 *
 * Why: the crawl monitor's run tiles sum each run's stored estimate, which leaves
 *   out search and reader calls. The ledger has one row per paid call for
 *   OpenRouter, Tavily, Jina and Brave; this shapes it into a spend section.
 * What: `summarizeProviderSpend` folds day rows into today / this month / all
 *   time per provider and in total. A call with no cost (no env price set, no
 *   reported cost) is counted as not priced and never summed as $0: a bucket with
 *   no priced call has `costUsd: null`, and `unpricedCalls` says how many calls a
 *   sum leaves out. `priceFlags` reports only whether each env price is usable.
 * Test: `tests/unit/crawl-spend-393.test.ts`.
 */

/** One `GROUP BY provider, UTC day` row of the ledger; numeric columns may arrive as strings. */
export interface SpendDayRow {
  provider: string;
  /** UTC day as `YYYY-MM-DD`; null only for a malformed row, which counts toward all time only. */
  day: string | null;
  calls: string | number | null;
  /** Calls with a reported or estimated cost. */
  pricedCalls: string | number | null;
  /** Calls whose cost is the provider-reported figure, not an env-price estimate. */
  reportedCalls: string | number | null;
  /** Sum of each priced call's cost: reported when present, else estimated. Null when none is priced. */
  costUsd: string | number | null;
  /** Billed units (credits, tokens, requests); null when no call recorded any. */
  units: string | number | null;
}

export interface SpendBucket {
  calls: number;
  pricedCalls: number;
  /** Calls left out of `costUsd` because they have no cost. */
  unpricedCalls: number;
  reportedCalls: number;
  /** Sum over priced calls only; null when `pricedCalls` is 0, so "not priced" never reads as $0. */
  costUsd: number | null;
  /** Billed units for one provider; always null on the cross-provider totals. */
  units: number | null;
}

export interface ProviderSpendView {
  provider: string;
  label: string;
  unitLabel: string;
  /** Whether the env unit price this provider's estimate needs is set to a usable number. */
  priceConfigured: boolean | null;
  today: SpendBucket;
  month: SpendBucket;
  allTime: SpendBucket;
}

export interface CrawlSpendSummary {
  generatedAt: string;
  totals: { today: SpendBucket; month: SpendBucket; allTime: SpendBucket };
  providers: ProviderSpendView[];
}

type WindowKey = "today" | "month" | "allTime";

/**
 * The providers the ledger writer records, with the env prices each estimate
 * needs. Only a configured flag leaves this module; names and values never do.
 */
const KNOWN_PROVIDERS: ReadonlyArray<{ provider: string; label: string; unitLabel: string; priceEnv: string[] }> = [
  {
    provider: "openrouter",
    label: "OpenRouter (LLM)",
    unitLabel: "tokens",
    priceEnv: ["OPENROUTER_INPUT_USD_PER_MTOKEN", "OPENROUTER_OUTPUT_USD_PER_MTOKEN"],
  },
  { provider: "tavily", label: "Tavily (search, extract)", unitLabel: "credits", priceEnv: ["TAVILY_USD_PER_CREDIT"] },
  { provider: "jina", label: "Jina (reader)", unitLabel: "tokens", priceEnv: ["JINA_USD_PER_MTOKEN"] },
  { provider: "brave", label: "Brave (search)", unitLabel: "requests", priceEnv: ["BRAVE_USD_PER_1K_REQUESTS"] },
];

/** A ledger provider value safe to echo as a label; anything else is grouped as "other". */
const SAFE_PROVIDER = /^[a-z0-9_-]{1,40}$/;

function count(value: string | number | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function amount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Ledger costs carry six decimals; summing in micro-dollars keeps 0.1 + 0.2 exact. */
const MICRO = 1_000_000;

interface Acc {
  calls: number;
  priced: number;
  reported: number;
  costMicros: number;
  units: number | null;
}

const emptyAcc = (): Acc => ({ calls: 0, priced: 0, reported: 0, costMicros: 0, units: null });

function add(acc: Acc, row: SpendDayRow): void {
  const calls = count(row.calls);
  // A day row cannot have more priced calls than calls; clamp a malformed one.
  const priced = Math.min(count(row.pricedCalls), calls);
  acc.calls += calls;
  acc.priced += priced;
  acc.reported += Math.min(count(row.reportedCalls), priced);
  const cost = amount(row.costUsd);
  if (priced > 0 && cost !== null) acc.costMicros += Math.round(cost * MICRO);
  const units = amount(row.units);
  if (units !== null) acc.units = (acc.units ?? 0) + units;
}

function toBucket(acc: Acc, withUnits: boolean): SpendBucket {
  return {
    calls: acc.calls,
    pricedCalls: acc.priced,
    unpricedCalls: acc.calls - acc.priced,
    reportedCalls: acc.reported,
    costUsd: acc.priced === 0 ? null : acc.costMicros / MICRO,
    units: withUnits && acc.units !== null ? Math.round(acc.units * 10_000) / 10_000 : null,
  };
}

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isUsablePrice(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "" && amount(value.trim()) !== null;
}

/** Whether each known provider's env price is usable; booleans only, keyed by provider. */
export function priceFlags(env: NodeJS.ProcessEnv = process.env): Record<string, boolean> {
  return Object.fromEntries(
    KNOWN_PROVIDERS.map((p) => [p.provider, p.priceEnv.every((name) => isUsablePrice(env[name]))])
  );
}

/**
 * Why: the spend section must show estimated cost per provider without
 *   counting an unpriced call as free (#393).
 * What: Buckets each day row into today (UTC day of `now`), this month (UTC
 *   month of `now`) and all time, per provider and in total. The four known
 *   providers always appear, in a fixed order, even with no calls; other
 *   provider values follow. Postconditions per bucket: unpricedCalls =
 *   calls - pricedCalls; costUsd is null exactly when pricedCalls is 0;
 *   today.calls <= month.calls <= allTime.calls.
 * Test: `summarizeProviderSpend` cases in tests/unit/crawl-spend-393.test.ts.
 */
export function summarizeProviderSpend(
  rows: ReadonlyArray<SpendDayRow>,
  now: Date,
  flags: Record<string, boolean> = priceFlags()
): CrawlSpendSummary {
  const today = utcDay(now.getTime());
  const monthStart = `${today.slice(0, 7)}-01`;
  const totals: Record<WindowKey, Acc> = { today: emptyAcc(), month: emptyAcc(), allTime: emptyAcc() };
  const byProvider = new Map<string, Record<WindowKey, Acc>>();
  for (const p of KNOWN_PROVIDERS) {
    byProvider.set(p.provider, { today: emptyAcc(), month: emptyAcc(), allTime: emptyAcc() });
  }

  for (const row of rows) {
    const key = SAFE_PROVIDER.test(row.provider) ? row.provider : "other";
    let accs = byProvider.get(key);
    if (!accs) {
      accs = { today: emptyAcc(), month: emptyAcc(), allTime: emptyAcc() };
      byProvider.set(key, accs);
    }
    const day = typeof row.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.day) ? row.day : null;
    const windows: WindowKey[] = ["allTime"];
    if (day !== null && day >= monthStart) windows.push("month");
    if (day !== null && day >= today) windows.push("today");
    for (const w of windows) {
      add(accs[w], row);
      add(totals[w], row);
    }
  }

  const known = new Map(KNOWN_PROVIDERS.map((p) => [p.provider, p]));
  const providers = [...byProvider.entries()].map(([provider, accs]) => {
    const meta = known.get(provider);
    return {
      provider,
      label: meta?.label ?? provider,
      unitLabel: meta?.unitLabel ?? "units",
      priceConfigured: meta ? (flags[provider] ?? false) : null,
      today: toBucket(accs.today, true),
      month: toBucket(accs.month, true),
      allTime: toBucket(accs.allTime, true),
    };
  });

  return {
    generatedAt: now.toISOString(),
    totals: {
      today: toBucket(totals.today, false),
      month: toBucket(totals.month, false),
      allTime: toBucket(totals.allTime, false),
    },
    providers,
  };
}

/**
 * The cost line the spend section shows for a bucket. Calls with no price read
 * "not priced", never "$0"; a bucket with no calls reads "no calls".
 */
export function spendCostText(b: SpendBucket): string {
  if (b.calls === 0) return "no calls";
  if (b.costUsd === null) return "not priced";
  if (b.costUsd > 0 && b.costUsd < 0.0001) return "<$0.0001";
  return `$${b.costUsd.toFixed(4)}`;
}

/** The detail line under a cost: calls, units, and how many calls a partial sum leaves out. */
export function spendDetailText(b: SpendBucket, unitLabel?: string): string {
  const parts = [`${b.calls} call${b.calls === 1 ? "" : "s"}`];
  if (unitLabel && b.units !== null) parts.push(`${b.units.toLocaleString("en-US")} ${unitLabel}`);
  if (b.unpricedCalls > 0 && b.pricedCalls > 0) parts.push(`${b.unpricedCalls} not priced, not in the sum`);
  return parts.join(" · ");
}
