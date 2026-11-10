/**
 * Provider balance cross-check (#394): reads each provider's own usage or
 * balance figure, where it has an API for one, and sets it next to the spend
 * the `provider_usage_events` ledger recorded.
 *
 * Why: the ledger is written by this app, so a missed call or a wrong unit
 *   price goes unseen until the provider's bill. The provider's own figure is
 *   the check on it. A balance read that failed must never read as a match.
 * What: `readProviderBalances` makes at most one read-only GET per provider with
 *   a key set: OpenRouter `GET /api/v1/key` (USD used this UTC month, USD left
 *   under the key's limit) and Tavily `GET /usage` (credits used this billing
 *   cycle, credits left). Jina and Brave document no balance API. Each read has
 *   a timeout and no retry. Only validated numbers leave a read: labels, ids and
 *   error bodies from the provider are dropped. Any failure, a non-2xx, or a
 *   missing or non-numeric field gives `unavailable`, never 0. `buildBalanceCheck`
 *   compares the figures where the windows line up and otherwise says why not.
 * Test: `tests/unit/provider-balance-394.test.ts`.
 */

import type { CrawlSpendSummary, SpendBucket } from "./spend";

export type BalanceProvider = "openrouter" | "tavily" | "jina" | "brave";

export type UnavailableReason = "unauthenticated" | "timeout" | "http_error" | "network_error" | "bad_response";

/** The provider's own figures, after validation. */
export interface ReportedUsage {
  unit: "usd" | "credits";
  /** The window `used` covers: the current UTC month, or the provider's billing cycle (dates not given). */
  period: "utc_month" | "billing_cycle";
  used: number;
  /** Left under the key's or plan's limit; null when the provider reports no limit. */
  remaining: number | null;
}

export type BalanceRead =
  | { state: "ok"; reported: ReportedUsage }
  | { state: "not_configured" }
  | { state: "no_api" }
  | { state: "unavailable"; reason: UnavailableReason };

export type Agreement =
  | { status: "agrees"; difference: number }
  | { status: "differs"; difference: number }
  | { status: "not_compared"; reason: string };

export interface RecordedSpend {
  /** Ledger calls this UTC month. */
  calls: number;
  unpricedCalls: number;
  /** Null when no call this month has a cost. */
  costUsd: number | null;
  units: number | null;
  unitLabel: string;
}

export interface ProviderBalanceView {
  provider: BalanceProvider;
  label: string;
  balance: BalanceRead;
  /** Null when the ledger could not be read. */
  recorded: RecordedSpend | null;
  agreement: Agreement;
}

export interface BalanceCheckSummary {
  generatedAt: string;
  ledgerAvailable: boolean;
  providers: ProviderBalanceView[];
}

/** One attempt per provider per request; a read that outlasts this is `timeout`. */
export const BALANCE_TIMEOUT_MS = 5_000;
/** USD figures within max($0.01, 2%) of each other agree. */
export const AGREE_ABS_USD = 0.01;
export const AGREE_REL = 0.02;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

interface ProviderSpec {
  provider: BalanceProvider;
  label: string;
  /** Env name of the key; read here only, never returned. */
  keyEnv: string;
  /** Null when the provider documents no balance API. */
  url: string | null;
  parse: ((body: unknown) => ReportedUsage | null) | null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * OpenRouter `GET /api/v1/key` body `{ data: { usage_monthly, limit_remaining, ... } }`.
 * `usage_monthly` is USD for the current UTC month and is required; `limit_remaining`
 * is null when the key has no limit. Returns null for any other shape.
 */
export function parseOpenRouterKey(body: unknown): ReportedUsage | null {
  const data = obj(obj(body)?.["data"]);
  if (!data) return null;
  const used = num(data["usage_monthly"]);
  if (used === null) return null;
  const rawRemaining = data["limit_remaining"];
  const remaining = rawRemaining === null || rawRemaining === undefined ? null : num(rawRemaining);
  if (remaining === null && rawRemaining !== null && rawRemaining !== undefined) return null;
  return { unit: "usd", period: "utc_month", used, remaining };
}

/**
 * Tavily `GET /usage` body `{ key: { usage, limit }, account: { plan_usage, plan_limit } }`.
 * `key.usage` (credits this billing cycle) is required. Remaining is the key's limit
 * less its usage, else the plan's; null when neither limit is a number.
 */
export function parseTavilyUsage(body: unknown): ReportedUsage | null {
  const root = obj(body);
  const key = obj(root?.["key"]);
  if (!key) return null;
  const used = num(key["usage"]);
  if (used === null) return null;
  const keyLimit = num(key["limit"]);
  const account = obj(root?.["account"]);
  const planLimit = num(account?.["plan_limit"]);
  const planUsage = num(account?.["plan_usage"]);
  let remaining: number | null = null;
  if (keyLimit !== null) remaining = Math.max(0, keyLimit - used);
  else if (planLimit !== null && planUsage !== null) remaining = Math.max(0, planLimit - planUsage);
  return { unit: "credits", period: "billing_cycle", used, remaining };
}

const PROVIDERS: ReadonlyArray<ProviderSpec> = [
  {
    provider: "openrouter",
    label: "OpenRouter (LLM)",
    keyEnv: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/key",
    parse: parseOpenRouterKey,
  },
  {
    provider: "tavily",
    label: "Tavily (search, extract)",
    keyEnv: "TAVILY_API_KEY",
    url: "https://api.tavily.com/usage",
    parse: parseTavilyUsage,
  },
  { provider: "jina", label: "Jina (reader)", keyEnv: "JINA_API_KEY", url: null, parse: null },
  { provider: "brave", label: "Brave (search)", keyEnv: "BRAVE_SEARCH_API_KEY", url: null, parse: null },
];

function isTimeout(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return name === "TimeoutError" || name === "AbortError";
}

/** One bounded, read-only GET; every failure maps to an `unavailable` reason. */
async function readOne(spec: ProviderSpec, key: string, fetchImpl: FetchLike, timeoutMs: number): Promise<BalanceRead> {
  if (!spec.url || !spec.parse) return { state: "no_api" };
  let res: Response;
  try {
    res = await fetchImpl(spec.url, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return { state: "unavailable", reason: isTimeout(error) ? "timeout" : "network_error" };
  }
  if (res.status === 401 || res.status === 403) return { state: "unavailable", reason: "unauthenticated" };
  if (!res.ok) return { state: "unavailable", reason: "http_error" };
  let body: unknown;
  try {
    body = await res.json();
  } catch (error) {
    return { state: "unavailable", reason: isTimeout(error) ? "timeout" : "bad_response" };
  }
  const reported = spec.parse(body);
  return reported ? { state: "ok", reported } : { state: "unavailable", reason: "bad_response" };
}

/**
 * Why: the cross-check needs each provider's own figure without exposing a key
 *   or letting one slow provider hold the page (#394).
 * What: reads all four providers in parallel. A provider with no key is
 *   `not_configured` and no request is made; one with no balance API is `no_api`.
 *   Never throws. Postcondition: at most one fetch per provider, each bounded by
 *   `timeoutMs`.
 * Test: the read cases in tests/unit/provider-balance-394.test.ts.
 */
export async function readProviderBalances(
  env: NodeJS.ProcessEnv,
  fetchImpl: FetchLike,
  timeoutMs: number = BALANCE_TIMEOUT_MS
): Promise<Record<BalanceProvider, BalanceRead>> {
  const reads = await Promise.all(
    PROVIDERS.map(async (spec): Promise<[BalanceProvider, BalanceRead]> => {
      if (!spec.url) return [spec.provider, { state: "no_api" }];
      const key = env[spec.keyEnv]?.trim();
      if (!key) return [spec.provider, { state: "not_configured" }];
      try {
        return [spec.provider, await readOne(spec, key, fetchImpl, timeoutMs)];
      } catch {
        return [spec.provider, { state: "unavailable", reason: "network_error" }];
      }
    })
  );
  return Object.fromEntries(reads) as Record<BalanceProvider, BalanceRead>;
}

function recordedFrom(month: SpendBucket, unitLabel: string): RecordedSpend {
  return {
    calls: month.calls,
    unpricedCalls: month.unpricedCalls,
    costUsd: month.costUsd,
    units: month.units,
    unitLabel,
  };
}

/**
 * Compares one provider's figure with the ledger. Only a successful read is ever
 * compared, so a failed, missing or unconfigured balance is always `not_compared`.
 * USD over the UTC month is compared; credits over a billing cycle with unknown
 * dates are shown side by side only.
 */
export function compareBalance(balance: BalanceRead, recorded: RecordedSpend | null): Agreement {
  if (balance.state === "not_configured") return { status: "not_compared", reason: "key not configured" };
  if (balance.state === "no_api") return { status: "not_compared", reason: "no balance API" };
  if (balance.state === "unavailable") return { status: "not_compared", reason: "balance unavailable" };
  if (!recorded) return { status: "not_compared", reason: "ledger unavailable" };
  const { reported } = balance;
  if (reported.unit !== "usd" || reported.period !== "utc_month") {
    return { status: "not_compared", reason: "billing cycle dates not reported" };
  }
  if (recorded.unpricedCalls > 0) {
    return { status: "not_compared", reason: `${recorded.unpricedCalls} ledger calls not priced` };
  }
  const recordedUsd = recorded.calls === 0 ? 0 : recorded.costUsd;
  if (recordedUsd === null) return { status: "not_compared", reason: "ledger cost missing" };
  const difference = Math.round((reported.used - recordedUsd) * 1_000_000) / 1_000_000;
  const tolerance = Math.max(AGREE_ABS_USD, AGREE_REL * Math.max(reported.used, recordedUsd));
  return { status: Math.abs(difference) <= tolerance ? "agrees" : "differs", difference };
}

/**
 * Why: the admin page shows the ledger's month next to each provider's figure (#394).
 * What: one view per provider in a fixed order. `spend` null means the ledger read
 *   failed; every comparison then says so.
 * Test: the cross-check cases in tests/unit/provider-balance-394.test.ts.
 */
export function buildBalanceCheck(
  spend: CrawlSpendSummary | null,
  balances: Record<BalanceProvider, BalanceRead>,
  now: Date
): BalanceCheckSummary {
  const providers = PROVIDERS.map((spec): ProviderBalanceView => {
    const view = spend?.providers.find((p) => p.provider === spec.provider);
    const recorded = spend ? recordedFrom(view?.month ?? emptyMonth(), view?.unitLabel ?? "units") : null;
    const balance = balances[spec.provider] ?? { state: "unavailable", reason: "network_error" };
    return { provider: spec.provider, label: spec.label, balance, recorded, agreement: compareBalance(balance, recorded) };
  });
  return { generatedAt: now.toISOString(), ledgerAvailable: spend !== null, providers };
}

function emptyMonth(): SpendBucket {
  return { calls: 0, pricedCalls: 0, unpricedCalls: 0, reportedCalls: 0, costUsd: null, units: null };
}

const REASON_TEXT: Record<UnavailableReason, string> = {
  unauthenticated: "unavailable (key rejected)",
  timeout: "unavailable (timed out)",
  http_error: "unavailable (provider error)",
  network_error: "unavailable (no response)",
  bad_response: "unavailable (unexpected response)",
};

function figure(value: number, unit: ReportedUsage["unit"]): string {
  return unit === "usd" ? `$${value.toFixed(4)}` : `${value.toLocaleString("en-US")} credits`;
}

/** The provider column: the reported figure, or why there is none. Never "$0" for a failed read. */
export function balanceText(b: BalanceRead): string {
  switch (b.state) {
    case "not_configured":
      return "not configured";
    case "no_api":
      return "unavailable (no balance API)";
    case "unavailable":
      return REASON_TEXT[b.reason];
    case "ok":
      return `${figure(b.reported.used, b.reported.unit)} used ${
        b.reported.period === "utc_month" ? "this month" : "this billing cycle"
      }`;
  }
}

/** The remaining-balance line; empty unless the read succeeded. */
export function remainingText(b: BalanceRead): string {
  if (b.state !== "ok") return "";
  return b.reported.remaining === null ? "no limit reported" : `${figure(b.reported.remaining, b.reported.unit)} left`;
}

/** The cross-check column. */
export function agreementText(a: Agreement): string {
  if (a.status === "not_compared") return `not compared: ${a.reason}`;
  const sign = a.difference >= 0 ? "+" : "-";
  const diff = `${sign}$${Math.abs(a.difference).toFixed(4)}`;
  return a.status === "agrees" ? `in agreement (${diff})` : `differs by ${diff} (provider minus ledger)`;
}
