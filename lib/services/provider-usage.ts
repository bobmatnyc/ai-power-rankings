/**
 * Paid provider call ledger writer (#325).
 *
 * Why: spend must be attributable per call, including calls made outside an
 *   ingestion run, and a ledger problem must never cost a provider result or a run.
 * What: `recordOpenRouterUsage` turns one OpenRouter completion body into one
 *   `provider_usage_events` row. Cost is the `usage.cost` OpenRouter reports when
 *   present; otherwise tokens x the env unit prices `OPENROUTER_INPUT_USD_PER_MTOKEN`
 *   and `OPENROUTER_OUTPUT_USD_PER_MTOKEN`, flagged as estimated. With neither,
 *   the row is still written with no cost and flagged as estimated.
 *   `recordCrawlUsage` (#392) writes one row per Tavily, Jina or Brave call: billed
 *   units (credits, tokens, requests) x an env unit price, always flagged as estimated.
 *   `runWithUsageRun` scopes calls to an ingestion run through AsyncLocalStorage, so
 *   call sites do not thread a run id. Every write is awaited with a time bound and
 *   never throws: a failure or timeout logs "ledger row not written" at error level,
 *   alerts ALERT_WEBHOOK_URL at most hourly (#364), and returns false.
 * Test: `tests/unit/provider-usage-325.test.ts`,
 *   `tests/unit/provider-usage-fail-open-325.test.ts`, `tests/unit/provider-usage-alert-364.test.ts`,
 *   `tests/unit/crawl-usage-392.test.ts`.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { getDb } from "@/lib/db/connection";
import { type NewProviderUsageEvent, providerUsageEvents } from "@/lib/db/schema";
import { loggers } from "@/lib/logger";

export const LEDGER_NOT_WRITTEN_MSG = "[ProviderUsage] ledger row not written";
export const LEDGER_WRITE_TIMEOUT_MS = 2_000;
// #364: a failed write alerts through ALERT_WEBHOOK_URL, throttled per process.
export const LEDGER_ALERT_TEXT = "[LEDGER FAILURE] provider usage ledger row not written";
export const LEDGER_ALERT_INTERVAL_MS = 60 * 60_000;
export const LEDGER_ALERT_TIMEOUT_MS = 2_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** OpenRouter call sites, one value per place in the app that calls the API. */
export type OpenRouterOperation =
  | "article_quality"
  | "article_analysis"
  | "whats_new_summary"
  | "state_of_ai_summary"
  | "weekly_digest"
  | "admin_news_analyze"
  | "generate";

interface UsageRunContext {
  /** Read at write time: the run row is created after the context starts. */
  runId: () => string | null | undefined;
}

const usageRunContext = new AsyncLocalStorage<UsageRunContext>();

/** Runs `fn` so every ledger row written inside it links to the current run id. */
export function runWithUsageRun<T>(runId: UsageRunContext["runId"], fn: () => T): T {
  return usageRunContext.run({ runId }, fn);
}

/** The run id for a ledger row, or null outside a run or for a dry-run placeholder id. */
export function currentUsageRunId(): string | null {
  const id = usageRunContext.getStore()?.runId();
  return typeof id === "string" && UUID_PATTERN.test(id) ? id : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

function envPrice(name: string): number | null {
  return nonNegativeNumber(process.env[name]);
}

/** Tokens and reported cost from a completion body; missing fields are null. */
export function readOpenRouterUsage(body: unknown): {
  inputTokens: number | null;
  outputTokens: number | null;
  reportedCostUsd: number | null;
} {
  const usage =
    body && typeof body === "object" ? (body as { usage?: Record<string, unknown> }).usage : undefined;
  if (!usage || typeof usage !== "object") {
    return { inputTokens: null, outputTokens: null, reportedCostUsd: null };
  }
  const tokens = (v: unknown) => {
    const n = nonNegativeNumber(v);
    return n === null ? null : Math.round(n);
  };
  return {
    inputTokens: tokens(usage["prompt_tokens"]),
    outputTokens: tokens(usage["completion_tokens"]),
    reportedCostUsd: nonNegativeNumber(usage["cost"]),
  };
}

/** Tokens x env unit prices (USD per million tokens), or null when a price or count is missing. */
export function estimateOpenRouterCostUsd(
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  const inputPrice = envPrice("OPENROUTER_INPUT_USD_PER_MTOKEN");
  const outputPrice = envPrice("OPENROUTER_OUTPUT_USD_PER_MTOKEN");
  if (inputPrice === null || outputPrice === null || inputTokens === null || outputTokens === null) {
    return null;
  }
  return (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000;
}

/** The ledger row for one OpenRouter completion body. */
export function openRouterUsageRow(input: {
  operation: OpenRouterOperation;
  model: string;
  body: unknown;
  runId?: string | null;
}): NewProviderUsageEvent {
  const { inputTokens, outputTokens, reportedCostUsd } = readOpenRouterUsage(input.body);
  const estimated = estimateOpenRouterCostUsd(inputTokens, outputTokens);
  return {
    provider: "openrouter",
    operation: input.operation,
    model: input.model,
    runId: input.runId ?? currentUsageRunId(),
    inputTokens,
    outputTokens,
    reportedCostUsd: reportedCostUsd === null ? null : reportedCostUsd.toFixed(6),
    estimatedCostUsd: estimated === null ? null : estimated.toFixed(6),
    costIsEstimated: reportedCostUsd === null,
  };
}

/**
 * Writes one ledger row. Never throws and never waits longer than
 * LEDGER_WRITE_TIMEOUT_MS; returns whether the row was written.
 */
export async function recordProviderUsage(row: NewProviderUsageEvent): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Resolved before the timer starts, so a missing database arms no timer.
    const db = getDb();
    if (!db) throw new Error("database not configured");
    await Promise.race([
      db.insert(providerUsageEvents).values(row),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${LEDGER_WRITE_TIMEOUT_MS}ms`)),
          LEDGER_WRITE_TIMEOUT_MS
        );
      }),
    ]);
    return true;
  } catch (error) {
    // #325: fail open — the provider call and the run continue without the row.
    // #364: but loudly — an error-level log per dropped row, plus a webhook alert.
    await reportLedgerWriteFailure({
      provider: row.provider,
      operation: row.operation,
      runId: row.runId ?? null,
      error: errorText(error),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
}

let lastLedgerAlertAt: number | null = null;
// #392: dropped rows per process, so a caller or test can see the ledger is short.
let ledgerWriteFailures = 0;

/** Test hook: forget the last alert time so the next failure alerts again. */
export function resetLedgerAlertThrottle(): void {
  lastLedgerAlertAt = null;
}

/** Ledger rows this process failed to write since start (or the last reset). */
export function ledgerWriteFailureCount(): number {
  return ledgerWriteFailures;
}

/** Test hook: zero the dropped-row count. */
export function resetLedgerWriteFailureCount(): void {
  ledgerWriteFailures = 0;
}

/**
 * Why: a missing ledger table dropped every usage row in production with only a
 *   warn-level log and no alert (#364).
 * What: logs LEDGER_NOT_WRITTEN_MSG at error level, then POSTs one alert to
 *   ALERT_WEBHOOK_URL (the cron routes' webhook and payload shape) at most once per
 *   LEDGER_ALERT_INTERVAL_MS per process, bounded by LEDGER_ALERT_TIMEOUT_MS. Never
 *   throws; with no webhook configured only the log is written.
 * Test: `tests/unit/provider-usage-alert-364.test.ts`,
 *   `tests/unit/provider-usage-fail-open-325.test.ts`.
 */
async function reportLedgerWriteFailure(details: {
  provider: string;
  operation: string;
  runId: string | null;
  error: string;
}): Promise<void> {
  ledgerWriteFailures += 1;
  loggers.api.error(LEDGER_NOT_WRITTEN_MSG, details);
  const webhookUrl = process.env["ALERT_WEBHOOK_URL"]?.trim();
  if (!webhookUrl) return;
  const now = Date.now();
  if (lastLedgerAlertAt !== null && now - lastLedgerAlertAt < LEDGER_ALERT_INTERVAL_MS) return;
  lastLedgerAlertAt = now;
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: LEDGER_ALERT_TEXT,
        error: details.error,
        provider: details.provider,
        operation: details.operation,
        runId: details.runId,
        impact:
          "Provider usage and cost rows are being dropped; the spend ledger is incomplete " +
          `until the write succeeds. Further failures are not alerted for ${LEDGER_ALERT_INTERVAL_MS / 60_000} minutes.`,
        timestamp: new Date(now).toISOString(),
      }),
      signal: AbortSignal.timeout(LEDGER_ALERT_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`webhook answered ${response.status}`);
  } catch (alertError) {
    loggers.api.error("[ProviderUsage] ledger failure alert not sent", { error: errorText(alertError) });
  }
}

/** Records one OpenRouter completion. Never throws. */
export async function recordOpenRouterUsage(input: {
  operation: OpenRouterOperation;
  model: string;
  body: unknown;
}): Promise<boolean> {
  try {
    return await recordProviderUsage(openRouterUsageRow(input));
  } catch (error) {
    // #325: building the row must not throw into a provider call either.
    // #364: reported like a failed insert.
    await reportLedgerWriteFailure({
      provider: "openrouter",
      operation: input.operation,
      runId: null,
      error: errorText(error),
    });
    return false;
  }
}

/** Request-body field asking OpenRouter to include `usage.cost` in the response. */
export const OPENROUTER_USAGE_REQUEST = { usage: { include: true } } as const;

/** Crawl provider calls (#392), one value per billed endpoint. */
export type CrawlUsage =
  | { provider: "tavily"; operation: "search" | "extract"; units: number | null }
  | { provider: "jina"; operation: "read"; units: number | null }
  | { provider: "brave"; operation: "search"; units: number | null };

/**
 * The env unit price for each crawl provider, and how many billed units it covers:
 * Tavily bills credits, Jina bills tokens (priced per million), Brave bills
 * requests (priced per thousand).
 */
const CRAWL_PRICES: Record<CrawlUsage["provider"], { env: string; perUnits: number }> = {
  tavily: { env: "TAVILY_USD_PER_CREDIT", perUnits: 1 },
  jina: { env: "JINA_USD_PER_MTOKEN", perUnits: 1_000_000 },
  brave: { env: "BRAVE_USD_PER_1K_REQUESTS", perUnits: 1_000 },
};

/** Tavily credits for one call: `usage.credits` when the reply has it, else the published rate. */
export function tavilyCredits(input: {
  operation: "search" | "extract";
  depth: "basic" | "advanced";
  body?: unknown;
  extractedUrls?: number;
}): number | null {
  const usage =
    input.body && typeof input.body === "object"
      ? (input.body as { usage?: { credits?: unknown } }).usage
      : undefined;
  const reported = nonNegativeNumber(usage?.credits);
  if (reported !== null) return reported;
  const perCall = input.depth === "advanced" ? 2 : 1;
  // Search: 1 credit (basic) or 2 (advanced) per request. Extract: the same per 5 extracted URLs.
  if (input.operation === "search") return perCall;
  const urls = nonNegativeNumber(input.extractedUrls);
  return urls === null ? null : (urls / 5) * perCall;
}

/** Tokens the Jina Reader reports for one read (`data.usage.tokens`), or null. */
export function jinaTokens(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const root = body as { data?: { usage?: { tokens?: unknown } }; usage?: { tokens?: unknown } };
  return nonNegativeNumber(root.data?.usage?.tokens ?? root.usage?.tokens);
}

/** The ledger row for one crawl provider call; cost is always an env-price estimate. */
export function crawlUsageRow(input: CrawlUsage & { runId?: string | null }): NewProviderUsageEvent {
  const units = nonNegativeNumber(input.units);
  const price = CRAWL_PRICES[input.provider];
  const unitPrice = envPrice(price.env);
  const estimated = units === null || unitPrice === null ? null : (units * unitPrice) / price.perUnits;
  return {
    provider: input.provider,
    operation: input.operation,
    model: null,
    runId: input.runId ?? currentUsageRunId(),
    inputTokens: null,
    outputTokens: null,
    units: units === null ? null : units.toFixed(4),
    reportedCostUsd: null,
    estimatedCostUsd: estimated === null ? null : estimated.toFixed(6),
    costIsEstimated: true,
  };
}

/**
 * Why: Tavily, Jina and Brave spend was invisible to the ledger; only OpenRouter
 *   calls wrote rows (#392).
 * What: writes one row per billed crawl call, linked to the current ingestion run
 *   through `runWithUsageRun`. Never throws, like `recordOpenRouterUsage`: a failed
 *   write is logged at error level, alerted, counted in `ledgerWriteFailureCount`,
 *   and returns false; the crawl continues with its provider result unchanged.
 * Test: `tests/unit/crawl-usage-392.test.ts`.
 */
export async function recordCrawlUsage(input: CrawlUsage): Promise<boolean> {
  try {
    return await recordProviderUsage(crawlUsageRow(input));
  } catch (error) {
    await reportLedgerWriteFailure({
      provider: input.provider,
      operation: input.operation,
      runId: null,
      error: errorText(error),
    });
    return false;
  }
}
