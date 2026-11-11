import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #187: ingestion maps article tool mentions through the tools catalogue.
 *
 * Why: `ToolMapper` (an alias list plus a fuzzy matcher) sent "Claude" to
 * "Claude Code" and "Google Gemini" to "Google Jules", and ignored the catalogue.
 * What: pins the replacement. A mention maps only by exact name or slug to an
 * active catalogue row (retired slugs reach the family row); anything else stays
 * unmapped and is counted. A failed or empty catalogue read leaves every mention
 * unmapped, logs a warning and is counted; it never maps to a default tool.
 * `ToolMapper` is gone from both files that defined it.
 * Test: `npx vitest run tests/unit/tool-mention-catalogue-187.test.ts`. No
 * database, no network.
 */

const catalogue = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../lib/news-tool-catalogue", () => ({ readNewsToolCatalogue: catalogue.read }));

import { buildToolCatalogue } from "../../lib/news-tool-resolver";
import { loggers } from "../../lib/logger";
import { mapToolMentionsToCatalogue } from "../../lib/services/tool-mention-catalogue";
import { AIAnalyzer } from "../../lib/services/article-ingestion.service";
import { emptyRunCounts, noteToolMapping, buildRunSummary } from "../../lib/services/ingestion-run-summary";

const row = (slug: string, name: string, kind: string, status = "active", redirect_to?: string) => ({
  id: `t-${slug}`,
  slug,
  name,
  kind,
  status,
  ...(redirect_to ? { redirect_to } : {}),
});

const ROWS = [
  row("opus-4-6", "Claude Opus 4.6", "model", "redirect", "claude-opus"),
  row("old-tool", "Old Tool", "other", "inactive"),
  row("claude-code", "Claude Code", "harness"),
  row("claude-opus", "Claude Opus", "model"),
  row("cursor", "Cursor", "harness"),
  row("google-jules", "Google Jules", "harness"),
];

const mention = (tool: string) => ({ tool, context: "c", sentiment: 0, relevance: 1 });

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  catalogue.read.mockReset();
  catalogue.read.mockResolvedValue(buildToolCatalogue(ROWS));
  warn = vi.spyOn(loggers.api, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("mapToolMentionsToCatalogue (#187)", () => {
  it("maps by exact name or slug, case-insensitively, and resolves a retired slug to its family row", async () => {
    const { mentions, report } = await mapToolMentionsToCatalogue([
      mention("CURSOR"),
      mention("claude-code"),
      mention("Claude Opus 4.6"),
    ]);
    expect(mentions.map((m) => m.tool)).toEqual(["Cursor", "Claude Code", "Claude Opus"]);
    expect(report).toMatchObject({ mapped: 3, unmapped: 0, catalogueError: null, articleUnmapped: false });
    expect(warn).not.toHaveBeenCalled();
  });

  it("leaves a name the catalogue lacks unmapped, never fuzzy-matched to another tool", async () => {
    const { mentions, report } = await mapToolMentionsToCatalogue([
      mention("Claude"), // ToolMapper sent this to "Claude Code"
      mention("Google Gemini"), // ToolMapper sent this to "Google Jules"
      mention("Old Tool"), // an inactive row is not a target
      mention("Cursor"),
    ]);
    expect(mentions.map((m) => m.tool)).toEqual(["Claude", "Google Gemini", "Old Tool", "Cursor"]);
    expect(report).toMatchObject({
      mapped: 1,
      unmapped: 3,
      unmappedNames: ["Claude", "Google Gemini", "Old Tool"],
      articleUnmapped: false,
    });
  });

  it("records an article with no mapped mention as unmapped", async () => {
    const { report } = await mapToolMentionsToCatalogue([mention("Unheard Of")]);
    expect(report).toMatchObject({ mapped: 0, unmapped: 1, articleUnmapped: true });
  });

  it("fails closed when the catalogue read throws: warns, maps nothing, counts the article", async () => {
    catalogue.read.mockRejectedValue(new Error("connection refused"));
    const { mentions, report } = await mapToolMentionsToCatalogue([mention("Cursor"), mention("Claude Code")]);
    expect(mentions.map((m) => m.tool)).toEqual(["Cursor", "Claude Code"]);
    expect(report).toMatchObject({ mapped: 0, unmapped: 2, catalogueError: "connection refused", articleUnmapped: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Tool catalogue unavailable");
  });

  it("fails closed when the catalogue is empty: warns and maps nothing", async () => {
    catalogue.read.mockResolvedValue(buildToolCatalogue([]));
    const { report } = await mapToolMentionsToCatalogue([mention("Cursor")]);
    expect(report).toMatchObject({ mapped: 0, unmapped: 1, articleUnmapped: true });
    expect(report.catalogueError).toMatch(/no active rows/);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("ToolMapper is replaced (#187)", () => {
  it("is exported by neither ingestion file, and the second copy is deleted", async () => {
    const ingestion = (await import("../../lib/services/article-ingestion.service")) as Record<string, unknown>;
    expect(ingestion["ToolMapper"]).toBeUndefined();
    expect(existsSync(resolve(__dirname, "../../lib/services/tool-mapper.service.ts"))).toBe(false);
  });
});

describe("AIAnalyzer maps the model's tool mentions through the catalogue (#187)", () => {
  const analysis = {
    title: "Cursor ships an update",
    summary: `Cursor shipped an update. ${Array.from({ length: 80 }, (_, i) => `detail${i}`).join(" ")}.`,
    source: "example.com",
    category: "Code Assistant",
    tags: [],
    tool_mentions: [mention("cursor"), mention("Claude")],
    company_mentions: [],
    overall_sentiment: 0.1,
    importance_score: 5,
    key_insights: [],
  };

  it("returns catalogue names for hits, raw names for misses, and the mapping report", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "g",
            object: "chat.completion",
            created: 1,
            model: "m",
            choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(analysis) } }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
          { status: 200 }
        )
      )
    );
    const result = await new AIAnalyzer().analyzeContent("body");
    expect(result.tool_mentions.map((m) => m.tool)).toEqual(["Cursor", "Claude"]);
    expect(result.toolMapping).toMatchObject({ mapped: 1, unmapped: 1, unmappedNames: ["Claude"], articleUnmapped: false });
  });
});

describe("the run summary counts unmapped articles (#187)", () => {
  it("counts an unmapped article and a catalogue failure, and carries both in the summary", () => {
    const counts = emptyRunCounts();
    noteToolMapping(counts, { mapped: 2, unmapped: 0, unmappedNames: [], catalogueError: null, articleUnmapped: false });
    noteToolMapping(counts, { mapped: 0, unmapped: 1, unmappedNames: ["X"], catalogueError: null, articleUnmapped: true });
    noteToolMapping(counts, { mapped: 0, unmapped: 1, unmappedNames: ["Y"], catalogueError: "db down", articleUnmapped: true });
    noteToolMapping(counts, undefined); // no report is unmapped, never mapped
    expect(counts).toMatchObject({ unmappedArticles: 3, toolCatalogueFailures: 1 });
    const summary = buildRunSummary({ runId: "r", status: "completed", errors: [], durationMs: 1, dryRun: false }, counts);
    expect(summary).toMatchObject({ unmappedArticles: 3, toolCatalogueFailures: 1 });
  });
});
