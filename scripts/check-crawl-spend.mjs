#!/usr/bin/env node
/**
 * Month-to-date crawl spend soft alert.
 *
 * Why: #395 — provider spend (OpenRouter, Tavily, Jina, Brave) had no alert. D33 sets one
 *   month-to-date (UTC) total across all providers against a threshold ($10), reported as a
 *   GitHub issue labelled `spend-alert`. It notifies only: nothing here stops, throttles or
 *   gates a crawl.
 * What: Reads CRAWL_SPEND_ALERT_USD_MONTH and DATABASE_URL, runs one read-only SELECT over
 *   `provider_usage_events` for the current UTC month grouped by provider, and passes the
 *   rows to evaluateCrawlSpend(). Each call costs coalesce(reported_cost_usd,
 *   estimated_cost_usd); a call with neither counts $0 and is reported as unpriced. At or over
 *   the threshold it writes spend-alert.json (month, title, body) and `alert=true` to
 *   $GITHUB_OUTPUT for the workflow's issue step, which calls spendIssueExistsForMonth() so a
 *   month gets one issue at most. A disabled threshold logs one line and exits 0; a missing
 *   DATABASE_URL or a failed read exits 1.
 * Test: `npx vitest run tests/unit/crawl-spend-alert-395.test.ts` covers the pure helpers and
 *   the workflow job. Only main() touches a database, and only when run directly.
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

export const ALERT_FILE = "spend-alert.json";
export const TITLE_PREFIX = "Crawl spend alert:";

const THRESHOLD_PATTERN = /^\d+(?:\.\d+)?$/;
// Same rule as lib/crawl-monitor/spend.ts: anything else is grouped as "other".
const SAFE_PROVIDER = /^[a-z0-9_-]{1,40}$/;
// A libpq-style URL, which a driver error could echo into the public Actions log.
const CONNECTION_STRING_PATTERN = /postgres(?:ql)?:\/\/\S+/gi;

/** Strip anything shaped like a connection string out of text bound for the log. */
export function redactConnectionString(text) {
  return String(text ?? "").replace(CONNECTION_STRING_PATTERN, "[redacted]");
}

/**
 * The monthly threshold in USD, or null when the check is disabled (unset, empty,
 * non-numeric or not above zero).
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseSpendThreshold(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!THRESHOLD_PATTERN.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** `YYYY-MM` of the UTC month containing `nowMs`. */
export function monthKeyUtc(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 7);
}

/** ISO timestamp of 00:00 UTC on the first day of `month` (`YYYY-MM`). */
export function monthStartUtcIso(month) {
  return `${month}-01T00:00:00.000Z`;
}

/** Title prefix that identifies the one issue for `month`. */
function monthTitlePrefix(month) {
  return `${TITLE_PREFIX} ${month} `;
}

function toNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// The ledger stores 6 decimal places; rounding there keeps a float sum from missing `>=`.
function roundMicro(value) {
  return Math.round(value * 1e6) / 1e6;
}

function usd(value) {
  return `$${value.toFixed(2)}`;
}

function usdThreshold(value) {
  return Number.isInteger(value) ? `$${value}` : usd(value);
}

/**
 * Pure evaluation of month-to-date spend — no I/O.
 *
 * @param {Array<{provider?: unknown, calls?: unknown, unpriced_calls?: unknown, cost_usd?: unknown}>} rows
 *   One row per provider for the month; numeric columns may arrive as strings, and a null
 *   cost_usd (no priced call) counts $0.
 * @param {number | null} threshold - from parseSpendThreshold(); null disables the alert.
 * @param {string} month - `YYYY-MM` (UTC).
 * @returns {null | {month: string, totalUsd: number, threshold: number, unpricedCalls: number, title: string, body: string}}
 *   null below the threshold; otherwise the issue to open, with totalUsd >= threshold.
 */
export function evaluateCrawlSpend(rows, threshold, month) {
  if (threshold === null || threshold === undefined || !(threshold > 0)) return null;

  const byProvider = new Map();
  for (const row of rows ?? []) {
    const provider = SAFE_PROVIDER.test(String(row?.provider ?? "")) ? String(row.provider) : "other";
    const entry = byProvider.get(provider) ?? { calls: 0, unpriced: 0, cost: 0 };
    entry.calls += toNumber(row?.calls);
    entry.unpriced += toNumber(row?.unpriced_calls);
    entry.cost += toNumber(row?.cost_usd);
    byProvider.set(provider, entry);
  }

  let total = 0;
  let unpricedCalls = 0;
  for (const entry of byProvider.values()) {
    total += entry.cost;
    unpricedCalls += entry.unpriced;
  }
  const totalUsd = roundMicro(total);
  if (!(totalUsd >= threshold)) return null;

  const title = `${monthTitlePrefix(month)}month-to-date ${usd(totalUsd)} ≥ ${usdThreshold(threshold)}`;
  const providers = [...byProvider.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const body = [
    `Month-to-date crawl and provider spend for **${month}** (UTC) is **${usd(totalUsd)}**, at or over the ${usdThreshold(threshold)} threshold (\`CRAWL_SPEND_ALERT_USD_MONTH\`).`,
    "",
    "| Provider | Calls | Unpriced calls | Cost |",
    "| --- | --- | --- | --- |",
    ...providers.map(([name, e]) => `| ${name} | ${e.calls} | ${e.unpriced} | ${usd(roundMicro(e.cost))} |`),
    "",
    unpricedCalls > 0
      ? `${unpricedCalls} calls this month have no stored cost (neither reported nor estimated) and count as $0, so the real total may be higher.`
      : "Every call this month has a stored cost.",
    "",
    "Cost per call is `coalesce(reported_cost_usd, estimated_cost_usd)` from `provider_usage_events`.",
    "This is a soft alert: no crawl was stopped or throttled. One issue is opened per month; later runs this month add nothing.",
  ].join("\n");

  return { month, totalUsd, threshold, unpricedCalls, title, body };
}

/**
 * Whether an issue for `month` already exists, open or closed — if so, the workflow does nothing.
 * @param {Array<{title?: string, pull_request?: unknown}>} issues - `spend-alert` labelled issues.
 * @param {string} month - `YYYY-MM`.
 */
export function spendIssueExistsForMonth(issues, month) {
  const prefix = monthTitlePrefix(month);
  return (issues ?? []).some((issue) => !issue?.pull_request && String(issue?.title ?? "").startsWith(prefix));
}

async function main() {
  const threshold = parseSpendThreshold(process.env.CRAWL_SPEND_ALERT_USD_MONTH);
  if (threshold === null) {
    console.log("Crawl spend alert disabled: CRAWL_SPEND_ALERT_USD_MONTH is unset, empty, non-numeric or <= 0.");
    process.exit(0);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set; cannot read crawl spend.");
    process.exit(1);
    return;
  }

  const month = monthKeyUtc();
  const sql = neon(databaseUrl);
  try {
    // #395: read-only; a call's cost is the reported figure, else the stored estimate (Architect ruling c).
    const rows = await sql`
      SELECT provider,
             count(*) AS calls,
             count(*) FILTER (WHERE reported_cost_usd IS NULL AND estimated_cost_usd IS NULL) AS unpriced_calls,
             sum(coalesce(reported_cost_usd, estimated_cost_usd)) AS cost_usd
      FROM provider_usage_events
      WHERE created_at >= ${monthStartUtcIso(month)}::timestamptz
      GROUP BY provider
    `;
    const alert = evaluateCrawlSpend(rows, threshold, month);
    if (!alert) {
      console.log(`OK: crawl spend for ${month} is below the $${threshold} threshold.`);
      process.exit(0);
      return;
    }
    console.log(`SPEND_ALERT: ${alert.title}`);
    writeFileSync(ALERT_FILE, JSON.stringify(alert));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, "alert=true\n");
    process.exit(0);
  } catch (error) {
    console.error(
      `ERROR: crawl spend check failed: ${redactConnectionString(error instanceof Error ? error.message : error)}`
    );
    process.exit(1);
  }
}

// Only run the CLI when executed directly, never when imported by tests or the workflow.
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main();
}
