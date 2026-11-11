/**
 * Month-to-date crawl spend soft alert (#395).
 *
 * Why: crawl and provider spend had no alert; D33 sets one month-to-date (UTC) total
 * across all providers against a $10 threshold, raised as a `spend-alert` issue.
 * What: parseSpendThreshold() disables the check on an unset, empty, non-numeric or
 * non-positive value; evaluateCrawlSpend() sums per-provider ledger totals (a null cost
 * counts $0 and its unpriced calls are reported) and returns the issue title and body at
 * or over the threshold, else null; spendIssueExistsForMonth() is the one-issue-per-month
 * dedupe. The workflow job is checked for isolation from the ingestion job.
 * Test: `npx vitest run tests/unit/crawl-spend-alert-395.test.ts`. No database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  evaluateCrawlSpend,
  monthKeyUtc,
  monthStartUtcIso,
  parseSpendThreshold,
  spendIssueExistsForMonth,
} from "../../scripts/check-crawl-spend.mjs";

const MONTH = "2026-11";

describe("parseSpendThreshold (#395)", () => {
  it("disables the check on unset, empty, non-numeric or non-positive values", () => {
    for (const raw of [undefined, null, "", "   ", "abc", "0", "-5", "0.00", "10abc"]) {
      expect(parseSpendThreshold(raw)).toBeNull();
    }
  });

  it("reads a positive number", () => {
    expect(parseSpendThreshold("10")).toBe(10);
    expect(parseSpendThreshold(" 12.5 ")).toBe(12.5);
  });
});

describe("monthKeyUtc / monthStartUtcIso (#395)", () => {
  it("uses the UTC month, not the local one", () => {
    // 23:30 on Oct 31 in New York is already November in UTC.
    expect(monthKeyUtc(Date.parse("2026-11-01T03:30:00.000Z"))).toBe("2026-11");
    expect(monthKeyUtc(Date.parse("2026-10-31T23:59:59.999Z"))).toBe("2026-10");
    expect(monthStartUtcIso("2026-11")).toBe("2026-11-01T00:00:00.000Z");
  });
});

describe("evaluateCrawlSpend (#395)", () => {
  it("fires at 10.50 against 10 with the month in the title and a per-provider body", () => {
    const alert = evaluateCrawlSpend(
      [
        { provider: "openrouter", calls: "40", unpriced_calls: "0", cost_usd: "8.250000" },
        { provider: "tavily", calls: 12, unpriced_calls: 0, cost_usd: 2.25 },
      ],
      10,
      MONTH
    );
    expect(alert).not.toBeNull();
    expect(alert!.totalUsd).toBe(10.5);
    expect(alert!.title).toBe("Crawl spend alert: 2026-11 month-to-date $10.50 ≥ $10");
    expect(alert!.title).toContain(MONTH);
    expect(alert!.body).toContain("| openrouter | 40 | 0 | $8.25 |");
    expect(alert!.body).toContain("| tavily | 12 | 0 | $2.25 |");
  });

  it("does not fire at 9.99", () => {
    expect(evaluateCrawlSpend([{ provider: "openrouter", calls: 5, unpriced_calls: 0, cost_usd: "9.99" }], 10, MONTH)).toBeNull();
  });

  it("fires at exactly the threshold (>=), including a float sum that lands on it", () => {
    expect(evaluateCrawlSpend([{ provider: "openrouter", calls: 1, unpriced_calls: 0, cost_usd: "10" }], 10, MONTH)).not.toBeNull();
    const parts = Array.from({ length: 100 }, (_, i) => ({ provider: `p${i}`, calls: 1, unpriced_calls: 0, cost_usd: 0.1 }));
    expect(evaluateCrawlSpend(parts, 10, MONTH)?.totalUsd).toBe(10);
  });

  it("counts a null-cost provider as $0 and reports its unpriced calls", () => {
    const rows = [
      { provider: "openrouter", calls: 20, unpriced_calls: 0, cost_usd: "11.00" },
      { provider: "jina", calls: 7, unpriced_calls: 7, cost_usd: null },
      { provider: "brave", calls: 3, unpriced_calls: 1, cost_usd: "0.004" },
    ];
    const alert = evaluateCrawlSpend(rows, 10, MONTH);
    expect(alert!.totalUsd).toBe(11.004);
    expect(alert!.unpricedCalls).toBe(8);
    expect(alert!.body).toContain("| jina | 7 | 7 | $0.00 |");
    expect(alert!.body).toContain("8 calls this month have no stored cost");
    // Unpriced calls alone never fire the alert.
    expect(evaluateCrawlSpend([{ provider: "jina", calls: 900, unpriced_calls: 900, cost_usd: null }], 10, MONTH)).toBeNull();
  });

  it("returns null with no ledger rows or a disabled threshold", () => {
    expect(evaluateCrawlSpend([], 10, MONTH)).toBeNull();
    expect(evaluateCrawlSpend([{ provider: "openrouter", calls: 1, unpriced_calls: 0, cost_usd: 50 }], null, MONTH)).toBeNull();
  });

  it("never echoes an unsafe provider value into the issue", () => {
    const alert = evaluateCrawlSpend([{ provider: "x|y\n@someone", calls: 1, unpriced_calls: 0, cost_usd: 20 }], 10, MONTH);
    expect(alert!.body).toContain("| other | 1 | 0 | $20.00 |");
    expect(alert!.body).not.toContain("@someone");
  });
});

describe("spendIssueExistsForMonth (#395)", () => {
  const title = "Crawl spend alert: 2026-11 month-to-date $10.50 ≥ $10";

  it("takes no action when an issue for the month exists, open or closed", () => {
    expect(spendIssueExistsForMonth([{ title, state: "open" }], MONTH)).toBe(true);
    expect(spendIssueExistsForMonth([{ title, state: "closed" }], MONTH)).toBe(true);
  });

  it("opens one when only other months, or pull requests, carry the title", () => {
    expect(spendIssueExistsForMonth([], MONTH)).toBe(false);
    expect(spendIssueExistsForMonth([{ title: title.replace("2026-11", "2026-10") }], MONTH)).toBe(false);
    expect(spendIssueExistsForMonth([{ title, pull_request: {} }], MONTH)).toBe(false);
  });
});

describe("cron-gap-detector.yml crawl-spend job (#395)", () => {
  const workflow = readFileSync(join(process.cwd(), ".github/workflows/cron-gap-detector.yml"), "utf8");

  function jobBlock(name: string): string {
    const lines = workflow.split("\n");
    const start = lines.indexOf(`  ${name}:`);
    if (start === -1) return "";
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line));
    return [lines[start], ...(end === -1 ? rest : rest.slice(0, end))].join("\n");
  }

  it("runs in its own job with the database secret and the threshold variable", () => {
    const job = jobBlock("check-crawl-spend");
    expect(job).toContain("run: node scripts/check-crawl-spend.mjs");
    expect(job).toContain("DATABASE_URL: ${{ secrets.DATABASE_URL }}");
    expect(job).toContain("CRAWL_SPEND_ALERT_USD_MONTH: ${{ vars.CRAWL_SPEND_ALERT_USD_MONTH }}");
    expect(job).toContain("spend-alert");
    expect(job).not.toMatch(/ingestion-alert|needs:|state: 'closed'|issues\.update/);
  });

  it("keeps the ingestion job free of the spend check", () => {
    const gap = jobBlock("check-ingestion-gap");
    expect(gap).not.toBe("");
    expect(gap).not.toMatch(/check-crawl-spend|spend-alert/);
  });
});
