/**
 * #392: Tavily, Jina and Brave calls write one `provider_usage_events` row each.
 *
 * Why: crawl spend was invisible to the ledger; only OpenRouter calls wrote rows. A
 *   ledger problem must still never cost a crawl its provider result.
 * What: drives the real TavilySearchService, TavilyExtractService, JinaReaderService and
 *   BraveSearchService with a stubbed `fetch` and a fake database, inside
 *   `runWithUsageRun`. Checks each row's provider, operation, units, run link and
 *   env-price estimate, and that no key reaches a row. With an insert that throws, each
 *   service returns the same result, and every dropped row is logged at error level and
 *   counted by `ledgerWriteFailureCount`. A source scan checks that every lib/app file
 *   calling a crawl endpoint records usage.
 * Test: `npx vitest run tests/unit/crawl-usage-392.test.ts`. No network, no database,
 *   no real keys.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ledger = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  mode: { value: "ok" as "ok" | "throw" },
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        if (ledger.mode.value === "throw") {
          throw new Error('relation "provider_usage_events" does not exist');
        }
        ledger.rows.push(row);
      },
    }),
  }),
}));

import { loggers } from "../../lib/logger";
import { BraveSearchService } from "../../lib/services/brave-search.service";
import { JinaReaderService } from "../../lib/services/jina-reader.service";
import {
  LEDGER_NOT_WRITTEN_MSG,
  ledgerWriteFailureCount,
  resetLedgerAlertThrottle,
  resetLedgerWriteFailureCount,
  runWithUsageRun,
} from "../../lib/services/provider-usage";
import { TavilyExtractService } from "../../lib/services/tavily-extract.service";
import { TavilySearchService } from "../../lib/services/tavily-search.service";

const RUN_ID = "00000000-0000-4000-8000-000000000392";
const FAKE_KEY = "fixture-key-not-a-real-credential";

const tavilySearchReply = {
  query: "q",
  results: [{ title: "Cursor ships agents", url: "https://news.example.com/a", content: "body", score: 0.9 }],
  response_time: 0.4,
};
const tavilyExtractReply = {
  results: [{ url: "https://news.example.com/a", raw_content: "Extracted article body." }],
  response_time: 0.6,
  usage: { credits: 1 },
  request_id: "req-fixture",
};
const jinaReply = {
  code: 200,
  status: 20000,
  data: { title: "Zed latency", content: "Jina article body.", usage: { tokens: 2500 } },
};
const braveReply = {
  web: { results: [{ title: "Cody pricing", url: "https://news.example.com/c", description: "d" }] },
};

function stubProviders(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      const body = u.startsWith("https://api.tavily.com/search")
        ? tavilySearchReply
        : u.startsWith("https://api.tavily.com/extract")
          ? tavilyExtractReply
          : u.startsWith("https://r.jina.ai/")
            ? jinaReply
            : u.startsWith("https://api.search.brave.com/")
              ? braveReply
              : null;
      if (body === null) throw new Error(`unexpected fetch in test: ${u}`);
      return new Response(JSON.stringify(body), { status: 200 });
    })
  );
}

/** One call to each provider endpoint, inside an ingestion run. */
async function crawlOnce() {
  return runWithUsageRun(
    () => RUN_ID,
    async () => ({
      search: await new TavilySearchService(FAKE_KEY).testSearch("ai coding news"),
      extract: await new TavilyExtractService(FAKE_KEY).extractContent("https://news.example.com/a"),
      jina: await new JinaReaderService(FAKE_KEY).fetchArticle("https://news.example.com/b"),
      brave: await new BraveSearchService(FAKE_KEY).searchAINews("pd"),
    })
  );
}

let errorLog: ReturnType<typeof vi.spyOn>;

function droppedRowLogs() {
  return errorLog.mock.calls.filter(([message]) => message === LEDGER_NOT_WRITTEN_MSG);
}

beforeEach(() => {
  ledger.rows = [];
  ledger.mode.value = "ok";
  vi.stubEnv("ALERT_WEBHOOK_URL", "");
  vi.stubEnv("TAVILY_USD_PER_CREDIT", "0.008");
  vi.stubEnv("JINA_USD_PER_MTOKEN", "0.02");
  vi.stubEnv("BRAVE_USD_PER_1K_REQUESTS", "5");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  errorLog = vi.spyOn(loggers.api, "error");
  resetLedgerAlertThrottle();
  resetLedgerWriteFailureCount();
  stubProviders();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#392 crawl provider usage capture", () => {
  it("records one row per provider call, linked to the run, with an env-price estimate", async () => {
    await crawlOnce();

    // Brave issues the primary query plus one supplementary query per day.
    const brave = ledger.rows.filter((r) => r["provider"] === "brave");
    expect(brave.length).toBeGreaterThanOrEqual(2);
    expect(ledger.rows.filter((r) => r["provider"] !== "brave")).toEqual([
      expect.objectContaining({ provider: "tavily", operation: "search", units: "1.0000", estimatedCostUsd: "0.008000" }),
      expect.objectContaining({ provider: "tavily", operation: "extract", units: "1.0000", estimatedCostUsd: "0.008000" }),
      expect.objectContaining({ provider: "jina", operation: "read", units: "2500.0000", estimatedCostUsd: "0.000050" }),
    ]);
    expect(brave[0]).toMatchObject({ operation: "search", units: "1.0000", estimatedCostUsd: "0.005000" });
    for (const row of ledger.rows) {
      expect(row).toMatchObject({ runId: RUN_ID, reportedCostUsd: null, costIsEstimated: true });
      // No key or env value is written to the ledger.
      expect(JSON.stringify(row)).not.toContain(FAKE_KEY);
    }
    expect(droppedRowLogs()).toHaveLength(0);
    expect(ledgerWriteFailureCount()).toBe(0);
  });

  it("with no env price, units are still recorded and cost is left empty", async () => {
    vi.stubEnv("TAVILY_USD_PER_CREDIT", "");
    await runWithUsageRun(
      () => RUN_ID,
      () => new TavilySearchService(FAKE_KEY).testSearch("q")
    );

    expect(ledger.rows).toEqual([
      expect.objectContaining({ provider: "tavily", units: "1.0000", estimatedCostUsd: null, costIsEstimated: true }),
    ]);
  });

  it("a failed ledger write leaves every crawl result unchanged and is logged and counted per row", async () => {
    const baseline = await crawlOnce();
    const rowsPerCrawl = ledger.rows.length;

    ledger.rows = [];
    ledger.mode.value = "throw";
    const failing = await crawlOnce();

    expect(failing).toEqual(baseline);
    expect(ledger.rows).toHaveLength(0);
    expect(ledgerWriteFailureCount()).toBe(rowsPerCrawl);
    const logs = droppedRowLogs();
    expect(logs).toHaveLength(rowsPerCrawl);
    expect(logs.map(([, ctx]) => (ctx as { provider: string }).provider)).toEqual(
      expect.arrayContaining(["tavily", "jina", "brave"])
    );
    for (const [, ctx] of logs) {
      expect(ctx).toMatchObject({ runId: RUN_ID, error: expect.stringContaining("provider_usage_events") });
    }
  });
});

describe("every crawl provider call site records usage", () => {
  const ROOT = path.resolve(__dirname, "../..");
  const ENDPOINTS = ["api.tavily.com/", "r.jina.ai", "api.search.brave.com/res/"];

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sourceFiles(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
  }

  it("each file that calls a crawl endpoint also calls the ledger writer", () => {
    const callers = ["lib", "app"]
      .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return ENDPOINTS.some((endpoint) => text.includes(endpoint));
      })
      .map((file) => path.relative(ROOT, file))
      .sort();

    // The known call sites; a new one must be added here and instrumented.
    expect(callers).toEqual([
      "lib/services/brave-search.service.ts",
      "lib/services/jina-reader.service.ts",
      "lib/services/tavily-extract.service.ts",
      "lib/services/tavily-search.service.ts",
    ]);
    for (const file of callers) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).toMatch(/recordCrawlUsage\(\{/);
    }
  });
});
