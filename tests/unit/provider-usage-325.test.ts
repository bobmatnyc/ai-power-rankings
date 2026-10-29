/**
 * #325: OpenRouter calls write one `provider_usage_events` row each.
 *
 * Why: the ledger is the only per-call spend record; a call site that does not write
 *   a row makes its spend invisible, and an estimate shown as a reported figure
 *   misleads (a cost from env prices is labelled "estimated").
 * What: checks the row builder (reported `usage.cost` wins; else tokens x env price,
 *   flagged estimated; else no cost), run linkage through `runWithUsageRun` (a dry-run
 *   placeholder id is never written), and drives `OpenRouterService.generate` and
 *   `AIAnalyzer.analyzeContent` with a stubbed `fetch` and a fake database. A source
 *   scan checks that every file calling the OpenRouter completions URL records usage.
 * Test: `npx vitest run tests/unit/provider-usage-325.test.ts`. No network, no database.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ledger = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        ledger.rows.push(row);
      },
    }),
  }),
}));

import { AIAnalyzer } from "../../lib/services/article-ingestion.service";
import { OpenRouterService } from "../../lib/services/openrouter.service";
import {
  currentUsageRunId,
  openRouterUsageRow,
  runWithUsageRun,
} from "../../lib/services/provider-usage";

const MODEL = "anthropic/claude-sonnet-5.5";
const RUN_ID = "00000000-0000-4000-8000-000000000325";

function completion(content: string, usage: Record<string, unknown>) {
  return {
    id: "gen-fixture",
    object: "chat.completion",
    created: 1792562400,
    model: MODEL,
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
    usage,
  };
}

let requests: Record<string, unknown>[];

function stubOpenRouter(reply: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(reply), { status: 200 });
    })
  );
}

beforeEach(() => {
  ledger.rows = [];
  requests = [];
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.stubEnv("OPENROUTER_INPUT_USD_PER_MTOKEN", "");
  vi.stubEnv("OPENROUTER_OUTPUT_USD_PER_MTOKEN", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openRouterUsageRow", () => {
  const usage = { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 };

  it("uses the cost OpenRouter reports and marks it not estimated", () => {
    vi.stubEnv("OPENROUTER_INPUT_USD_PER_MTOKEN", "2");
    vi.stubEnv("OPENROUTER_OUTPUT_USD_PER_MTOKEN", "10");
    const row = openRouterUsageRow({
      operation: "article_quality",
      model: MODEL,
      body: { usage: { ...usage, cost: 0.0123456 } },
    });
    expect(row).toMatchObject({
      provider: "openrouter",
      operation: "article_quality",
      model: MODEL,
      runId: null,
      inputTokens: 1000,
      outputTokens: 500,
      reportedCostUsd: "0.012346",
      estimatedCostUsd: "0.007000",
      costIsEstimated: false,
    });
  });

  it("falls back to tokens x env unit prices, flagged estimated", () => {
    vi.stubEnv("OPENROUTER_INPUT_USD_PER_MTOKEN", "2");
    vi.stubEnv("OPENROUTER_OUTPUT_USD_PER_MTOKEN", "10");
    const row = openRouterUsageRow({ operation: "generate", model: MODEL, body: { usage } });
    expect(row.reportedCostUsd).toBeNull();
    expect(row.estimatedCostUsd).toBe("0.007000");
    expect(row.costIsEstimated).toBe(true);
  });

  it("writes no cost, still flagged estimated, when neither a reported cost nor a price exists", () => {
    const row = openRouterUsageRow({ operation: "generate", model: MODEL, body: { usage } });
    expect(row).toMatchObject({ reportedCostUsd: null, estimatedCostUsd: null, costIsEstimated: true });
    expect(openRouterUsageRow({ operation: "generate", model: MODEL, body: {} })).toMatchObject({
      inputTokens: null,
      outputTokens: null,
      costIsEstimated: true,
    });
  });
});

describe("runWithUsageRun", () => {
  it("links rows to the run id read at write time, never a dry-run placeholder", () => {
    expect(currentUsageRunId()).toBeNull();
    const ref = { current: "" };
    runWithUsageRun(
      () => ref.current,
      () => {
        expect(currentUsageRunId()).toBeNull();
        ref.current = "dry-run-1792562400";
        expect(currentUsageRunId()).toBeNull();
        ref.current = RUN_ID;
        expect(currentUsageRunId()).toBe(RUN_ID);
      }
    );
  });
});

describe("OpenRouter call sites write one ledger row per completion", () => {
  it("OpenRouterService.generate records the operation, tokens and run, and asks for usage", async () => {
    stubOpenRouter(completion("ok", { prompt_tokens: 40, completion_tokens: 2, total_tokens: 42, cost: 0.0001 }));

    const result = await runWithUsageRun(
      () => RUN_ID,
      () =>
        new OpenRouterService().generate(
          { model: MODEL, messages: [{ role: "user", content: "q" }] },
          { operation: "article_quality" }
        )
    );

    expect(result.content).toBe("ok");
    expect(requests[0]?.["usage"]).toEqual({ include: true });
    expect(ledger.rows).toEqual([
      expect.objectContaining({
        provider: "openrouter",
        operation: "article_quality",
        model: MODEL,
        runId: RUN_ID,
        inputTokens: 40,
        outputTokens: 2,
        reportedCostUsd: "0.000100",
        costIsEstimated: false,
      }),
    ]);
  });

  it("AIAnalyzer.analyzeContent records an article_analysis row", async () => {
    const analysis = {
      title: "Fixture title",
      summary: `Fixture summary. ${Array.from({ length: 80 }, (_, i) => `detail${i}`).join(" ")}.`,
      rewritten_content: "Fixture body.",
      source: "example.com",
      published_date: "2026-10-20",
      category: "Code Assistant",
      tags: ["fixture"],
      tool_mentions: [],
      company_mentions: [],
      overall_sentiment: 0.1,
      importance_score: 5,
      key_insights: ["fixture"],
    };
    stubOpenRouter(completion(JSON.stringify(analysis), { prompt_tokens: 100, completion_tokens: 300 }));

    await new AIAnalyzer().analyzeContent("article body");

    expect(requests[0]?.["usage"]).toEqual({ include: true });
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0]).toMatchObject({
      operation: "article_analysis",
      inputTokens: 100,
      outputTokens: 300,
      costIsEstimated: true,
    });
  });
});

describe("every OpenRouter call site records usage", () => {
  const ROOT = path.resolve(__dirname, "../..");
  const COMPLETIONS_URL = "openrouter.ai/api/v1/chat/completions";

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "node_modules" ? [] : sourceFiles(full);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
  }

  it("each file that calls the completions endpoint also calls the ledger writer", () => {
    const callers = ["lib", "app"]
      .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
      .filter((file) => readFileSync(file, "utf8").includes(COMPLETIONS_URL))
      .map((file) => path.relative(ROOT, file))
      .sort();

    // The known call sites; a new one must be added here and instrumented.
    expect(callers).toEqual([
      "app/api/admin/news/analyze/route.ts",
      "lib/services/article-ingestion.service.ts",
      "lib/services/openrouter.service.ts",
      "lib/services/weekly-digest.service.ts",
      "lib/services/whats-new-summary.service.ts",
    ]);
    for (const file of callers) {
      expect(readFileSync(path.join(ROOT, file), "utf8"), file).toMatch(/recordOpenRouterUsage\(\{/);
    }
  });
});
