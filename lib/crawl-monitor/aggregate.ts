/**
 * Crawl monitor aggregation (#325): pure functions over rows the crawl jobs
 * already store. No database access, no env reads beyond `providerFlags`.
 *
 * Why: the admin crawl monitor must summarise run activity and estimated spend
 *   without exposing secrets or per-tool scores. Keeping the shaping here, away
 *   from Drizzle and the route, lets the tests feed synthetic rows directly.
 * What: window counts, estimated-spend sums, last-success-per-job, a sanitised
 *   per-run view (outcome counts and score buckets only) and provider
 *   configured/not-configured flags.
 * Test: `tests/unit/crawl-monitor-325.test.ts`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** The daily-news cron runs once a day; a gap above this is flagged on the page. */
export const DAILY_STALE_AFTER_HOURS = 26;

/** Errors shown per run; the full error_log stays on the ingestion page. */
export const MAX_ERRORS_PER_RUN = 3;
const ERROR_EXCERPT_CHARS = 200;

export type Timestamp = Date | string | null | undefined;

/** Narrow run row used for tiles and spend; one per `automated_ingestion_runs` row. */
export interface RunCostRow {
  runType: string;
  status: string | null;
  createdAt: Timestamp;
  estimatedCostUsd: string | number | null;
}

export interface WindowStats {
  runs: number;
  failures: number;
}

export interface SpendSummary {
  /** Sum of stored `estimated_cost_usd`; an estimate, never a measured bill. */
  todayUsd: number;
  monthUsd: number;
  allTimeUsd: number;
  /** Rows whose stored cost is null, so the sums are a floor. */
  runsWithoutCost: number;
}

function toMs(value: Timestamp): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function toIso(value: Timestamp): string | null {
  const ms = toMs(value);
  return ms === null ? null : new Date(ms).toISOString();
}

function startOfUtcDay(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function startOfUtcMonth(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

/**
 * Parses a stored decimal cost. Returns null for null, empty, non-numeric or
 * negative values, so a bad row is counted as "no cost" rather than summed.
 */
export function parseCostUsd(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Why: `estimated_cost_usd` is decimal(10,4); summing floats drifts
 *   (0.1 + 0.2), and the page shows the sum to four places.
 * What: Sums in integer ten-thousandths of a dollar and returns dollars.
 *   Null and unparseable costs contribute zero.
 * Test: `sumEstimatedCostUsd` cases in tests/unit/crawl-monitor-325.test.ts.
 */
export function sumEstimatedCostUsd(costs: ReadonlyArray<string | number | null | undefined>): number {
  let units = 0;
  for (const cost of costs) {
    const n = parseCostUsd(cost);
    if (n !== null) units += Math.round(n * 10_000);
  }
  return units / 10_000;
}

/**
 * Why: the brief asks for spend today, this month and all-time from the stored
 *   per-run estimate (#325), labelled as estimated by the caller.
 * What: Buckets each row by `createdAt` against UTC day and month starts of
 *   `now`; all-time includes rows with no timestamp. Postcondition:
 *   todayUsd <= monthUsd <= allTimeUsd.
 * Test: `summarizeSpend` cases in tests/unit/crawl-monitor-325.test.ts.
 */
export function summarizeSpend(rows: ReadonlyArray<RunCostRow>, now: Date): SpendSummary {
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const today: RunCostRow["estimatedCostUsd"][] = [];
  const month: RunCostRow["estimatedCostUsd"][] = [];
  let runsWithoutCost = 0;
  for (const row of rows) {
    if (parseCostUsd(row.estimatedCostUsd) === null) runsWithoutCost += 1;
    const ms = toMs(row.createdAt);
    if (ms === null) continue;
    if (ms >= monthStart) month.push(row.estimatedCostUsd);
    if (ms >= dayStart) today.push(row.estimatedCostUsd);
  }
  return {
    todayUsd: sumEstimatedCostUsd(today),
    monthUsd: sumEstimatedCostUsd(month),
    allTimeUsd: sumEstimatedCostUsd(rows.map((r) => r.estimatedCostUsd)),
    runsWithoutCost,
  };
}

/** Runs and failures since UTC midnight, over the last 7 days and the last 30 days. */
export function summarizeRunWindows(
  rows: ReadonlyArray<RunCostRow>,
  now: Date
): { today: WindowStats; last7Days: WindowStats; last30Days: WindowStats } {
  const bounds = {
    today: startOfUtcDay(now),
    last7Days: now.getTime() - 7 * DAY_MS,
    last30Days: now.getTime() - 30 * DAY_MS,
  };
  const out = {
    today: { runs: 0, failures: 0 },
    last7Days: { runs: 0, failures: 0 },
    last30Days: { runs: 0, failures: 0 },
  };
  for (const row of rows) {
    const ms = toMs(row.createdAt);
    if (ms === null) continue;
    for (const key of Object.keys(bounds) as Array<keyof typeof bounds>) {
      if (ms >= bounds[key]) {
        out[key].runs += 1;
        if (row.status === "failed") out[key].failures += 1;
      }
    }
  }
  return out;
}

export interface JobStatus {
  job: string;
  source: string;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastSuccessAt: string | null;
  /** Soft alert only (#325, D02): the page shows it; nothing is sent. */
  stale: boolean;
}

/**
 * Last run and last successful run per `run_type`. A run succeeds when its
 * status is `completed`. `daily_news` is stale when it has no success within
 * DAILY_STALE_AFTER_HOURS of `now`.
 */
export function jobStatusByRunType(rows: ReadonlyArray<RunCostRow>, now: Date): JobStatus[] {
  const byType = new Map<string, { lastRun: number | null; lastStatus: string | null; lastOk: number | null }>();
  for (const row of rows) {
    const ms = toMs(row.createdAt);
    const entry = byType.get(row.runType) ?? { lastRun: null, lastStatus: null, lastOk: null };
    if (ms !== null && (entry.lastRun === null || ms > entry.lastRun)) {
      entry.lastRun = ms;
      entry.lastStatus = row.status;
    }
    if (ms !== null && row.status === "completed" && (entry.lastOk === null || ms > entry.lastOk)) {
      entry.lastOk = ms;
    }
    byType.set(row.runType, entry);
  }
  if (!byType.has("daily_news")) byType.set("daily_news", { lastRun: null, lastStatus: null, lastOk: null });
  return [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([runType, e]) => ({
      job: `Ingestion: ${runType}`,
      source: "automated_ingestion_runs",
      lastRunAt: e.lastRun === null ? null : new Date(e.lastRun).toISOString(),
      lastStatus: e.lastStatus,
      lastSuccessAt: e.lastOk === null ? null : new Date(e.lastOk).toISOString(),
      stale:
        runType === "daily_news" &&
        (e.lastOk === null || now.getTime() - e.lastOk > DAILY_STALE_AFTER_HOURS * 60 * 60 * 1000),
    }));
}

/** A generated-summary job (what's-new, State of AI): its last row is its last success. */
export function summaryJobStatus(job: string, source: string, generatedAt: Timestamp): JobStatus {
  const iso = toIso(generatedAt);
  return { job, source, lastRunAt: iso, lastStatus: iso ? "generated" : null, lastSuccessAt: iso, stale: false };
}

/**
 * Why: error_log holds provider and site text, which can
 *   name hosts, URLs, endpoint ids or key-like tokens; this page must show none.
 * What: Replaces URLs, dotted host names, Neon-style endpoint ids and long
 *   token-like runs with placeholders, collapses whitespace, caps the length.
 * Test: `sanitizeErrorText` cases in tests/unit/crawl-monitor-325.test.ts.
 */
export function sanitizeErrorText(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  const cleaned = text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[url]")
    .replace(/\bep-[a-z0-9-]+/gi, "[id]")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){2,}\b/gi, "[host]")
    .replace(/\b[a-z0-9-]+\.(?:com|net|org|io|dev|ai|tech|app|co)\b/gi, "[host]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > ERROR_EXCERPT_CHARS ? `${cleaned.slice(0, ERROR_EXCERPT_CHARS - 1)}…` : cleaned;
}

/** Full ingestion run row as read for the runs list. */
export interface IngestionRunRow extends RunCostRow {
  id: string;
  startedAt: Timestamp;
  completedAt: Timestamp;
  articlesDiscovered: number | null;
  articlesPassedQuality: number | null;
  articlesIngested: number | null;
  articlesSkipped: number | null;
  articlesSkippedSemantic: number | null;
  articlesSkippedStale: number | null;
  rankingChanges: number | null;
  errorLog: unknown;
  candidateOutcomes: unknown;
}

/** Bucket labels for a rejected candidate's average quality score (0-10). */
export const SCORE_BUCKETS = ["0-2", "2-4", "4-6", "6-8", "8-10"] as const;
export type ScoreBucket = (typeof SCORE_BUCKETS)[number];

export interface CrawlRunView {
  id: string;
  runType: string;
  status: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  counts: {
    discovered: number;
    passedQuality: number;
    ingested: number;
    skipped: number;
    skippedSemantic: number;
    skippedStale: number;
    rankingChanges: number;
  };
  /** Candidate outcomes by kind (assessed, rejected, ingested, ...); counts only. */
  outcomeCounts: Record<string, number>;
  /** Rejected candidates by average-score bucket; never a per-candidate score. */
  rejectedScoreBuckets: Record<ScoreBucket, number>;
  errorCount: number;
  errors: string[];
  estimatedCostUsd: number | null;
}

function bucketFor(score: number): ScoreBucket {
  const index = Math.min(SCORE_BUCKETS.length - 1, Math.max(0, Math.floor(score / 2)));
  return SCORE_BUCKETS[index] as ScoreBucket;
}

/**
 * Why: `candidate_outcomes` carries titles, URLs and per-candidate scores;
 *   the monitor may show quality only as counts or buckets (#325).
 * What: Counts outcomes by `outcome` kind and buckets `averageScore` of
 *   `quality_rejected` entries. Ignores malformed entries. Reads no other field.
 * Test: `toCrawlRunView` cases in tests/unit/crawl-monitor-325.test.ts.
 */
export function bucketCandidateOutcomes(outcomes: unknown): {
  outcomeCounts: Record<string, number>;
  rejectedScoreBuckets: Record<ScoreBucket, number>;
} {
  const outcomeCounts: Record<string, number> = {};
  const rejectedScoreBuckets = Object.fromEntries(SCORE_BUCKETS.map((b) => [b, 0])) as Record<ScoreBucket, number>;
  if (!Array.isArray(outcomes)) return { outcomeCounts, rejectedScoreBuckets };
  for (const entry of outcomes) {
    if (!entry || typeof entry !== "object") continue;
    const kind = (entry as { outcome?: unknown }).outcome;
    if (typeof kind !== "string" || !/^[a-z_]{1,40}$/.test(kind)) continue;
    outcomeCounts[kind] = (outcomeCounts[kind] ?? 0) + 1;
    const score = (entry as { averageScore?: unknown }).averageScore;
    if (kind === "quality_rejected" && typeof score === "number" && Number.isFinite(score)) {
      rejectedScoreBuckets[bucketFor(score)] += 1;
    }
  }
  return { outcomeCounts, rejectedScoreBuckets };
}

/** Shapes one run row for the API; drops titles, URLs, ids of articles and search text. */
export function toCrawlRunView(row: IngestionRunRow): CrawlRunView {
  const started = toMs(row.startedAt ?? row.createdAt);
  const completed = toMs(row.completedAt);
  const errorLog = Array.isArray(row.errorLog) ? row.errorLog : [];
  return {
    id: row.id,
    runType: row.runType,
    status: row.status,
    startedAt: started === null ? null : new Date(started).toISOString(),
    completedAt: completed === null ? null : new Date(completed).toISOString(),
    durationMs: started !== null && completed !== null && completed >= started ? completed - started : null,
    counts: {
      discovered: row.articlesDiscovered ?? 0,
      passedQuality: row.articlesPassedQuality ?? 0,
      ingested: row.articlesIngested ?? 0,
      skipped: row.articlesSkipped ?? 0,
      skippedSemantic: row.articlesSkippedSemantic ?? 0,
      skippedStale: row.articlesSkippedStale ?? 0,
      rankingChanges: row.rankingChanges ?? 0,
    },
    ...bucketCandidateOutcomes(row.candidateOutcomes),
    errorCount: errorLog.length,
    errors: errorLog.slice(0, MAX_ERRORS_PER_RUN).map(sanitizeErrorText),
    estimatedCostUsd: parseCostUsd(row.estimatedCostUsd),
  };
}

/** Provider env vars the crawl reads; only their presence is ever reported. */
const PROVIDER_ENV: ReadonlyArray<[label: string, envName: string]> = [
  ["OpenRouter (LLM)", "OPENROUTER_API_KEY"],
  ["Tavily (search, extract)", "TAVILY_API_KEY"],
  ["Brave (search fallback)", "BRAVE_SEARCH_API_KEY"],
  ["Jina (reader)", "JINA_API_KEY"],
  ["Alert webhook", "ALERT_WEBHOOK_URL"],
];

/**
 * Why: the page must say whether a provider is set up without exposing any
 *   value, prefix or length (#325).
 * What: Returns `{ name, configured }` per provider; `configured` is true when
 *   the variable is set to a non-blank string. The env name is not returned.
 * Test: `providerFlags` and the no-secrets route case in tests/unit/crawl-monitor-325.test.ts.
 */
export function providerFlags(env: NodeJS.ProcessEnv = process.env): Array<{ name: string; configured: boolean }> {
  return PROVIDER_ENV.map(([name, envName]) => ({
    name,
    configured: typeof env[envName] === "string" && (env[envName] as string).trim() !== "",
  }));
}
