/**
 * Paid provider call ledger writer (#325).
 *
 * Why: spend must be attributable per call, including calls made outside an
 *   ingestion run, and a ledger problem must never cost a provider result or a run.
 * What: `recordOpenRouterUsage` turns one OpenRouter completion body into one
 *   `provider_usage_events` row. Cost is the `usage.cost` OpenRouter reports when
 *   present; otherwise tokens x the env unit prices `OPENROUTER_INPUT_USD_PER_MTOKEN`
 *   and `OPENROUTER_OUTPUT_USD_PER_MTOKEN`, flagged as estimated (D02). With neither,
 *   the row is still written with no cost and flagged as estimated.
 *   `runWithUsageRun` scopes calls to an ingestion run through AsyncLocalStorage, so
 *   call sites do not thread a run id. Every write is awaited with a time bound and
 *   never throws: a failure or timeout logs "ledger row not written" and returns false.
 * Test: `tests/unit/provider-usage-325.test.ts`,
 *   `tests/unit/provider-usage-fail-open-325.test.ts`.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { getDb } from "@/lib/db/connection";
import { type NewProviderUsageEvent, providerUsageEvents } from "@/lib/db/schema";
import { loggers } from "@/lib/logger";

export const LEDGER_NOT_WRITTEN_MSG = "[ProviderUsage] ledger row not written";
export const LEDGER_WRITE_TIMEOUT_MS = 2_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** OpenRouter call sites, one value per place in the app that calls the API. */
export type OpenRouterOperation =
  | "article_quality"
  | "article_analysis"
  | "whats_new_summary"
  | "state_of_ai_summary"
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
    loggers.api.warn(LEDGER_NOT_WRITTEN_MSG, {
      provider: row.provider,
      operation: row.operation,
      runId: row.runId ?? null,
      error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return false;
  } finally {
    clearTimeout(timer);
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
    loggers.api.warn(LEDGER_NOT_WRITTEN_MSG, {
      provider: "openrouter",
      operation: input.operation,
      error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return false;
  }
}

/** Request-body field asking OpenRouter to include `usage.cost` in the response. */
export const OPENROUTER_USAGE_REQUEST = { usage: { include: true } } as const;
