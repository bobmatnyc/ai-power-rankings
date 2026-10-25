/**
 * AI analysis on anthropic/claude-sonnet-5.5: truncated and wrapped replies (issue #172).
 *
 * Why: The 2026-10-21 06:00Z daily-news run failed its first two articles with "AI response
 *   was not valid JSON" after the model switch. The analyzer sent max_tokens 4000, never
 *   read finish_reason, and only stripped a bare ```json fence.
 * What: Drives `AIAnalyzer.analyzeContent` and `OpenRouterService.generate` against stubbed
 *   OpenRouter replies: a reply cut off with finish_reason "length" (reconstructed from the
 *   run's log line) must fail as truncation; a fenced reply with leading prose must parse;
 *   the request must carry the larger budget and a prompt template free of JSON comments.
 * Test: `npx vitest run tests/unit/ai-analyzer-truncation.test.ts`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ANALYSIS_MAX_TOKENS, AIAnalyzer } from "../../lib/services/article-ingestion.service";
import { OpenRouterService } from "../../lib/services/openrouter.service";

const MODEL = "anthropic/claude-sonnet-5.5";

/** The cut-off reply, reconstructed from the run's "[AIAnalyzer] Failed to parse" line. */
const TRUNCATED_RESPONSE = {
  id: "gen-truncated",
  object: "chat.completion",
  created: 1792562400,
  model: MODEL,
  choices: [
    {
      index: 0,
      finish_reason: "length",
      message: {
        role: "assistant",
        content:
          '{"title":"Anthropic Makes Code Review for Claude Code Generally Available",' +
          '"summary":"Anthropic has made its automated code review feature for Claude Code ' +
          "generally available. The company says the preview period was used to",
      },
    },
  ],
  usage: { prompt_tokens: 6100, completion_tokens: 4000, total_tokens: 10100 },
};

const ANALYSIS = {
  title: "Anthropic Makes Code Review for Claude Code Generally Available",
  summary: "Anthropic has made code review for Claude Code generally available.",
  rewritten_content: "Anthropic has made code review for Claude Code generally available.",
  source: "example.com",
  published_date: "2026-10-20",
  category: "Code Assistant",
  tags: ["code review"],
  tool_mentions: [{ tool: "Claude Code", context: "launch", sentiment: 0.7, relevance: 1 }],
  company_mentions: [{ company: "Anthropic", context: "vendor", tools: ["Claude Code"] }],
  overall_sentiment: 0.6,
  importance_score: 7,
  key_insights: ["Code review is now generally available"],
};

/** A complete reply wrapped in a sentence of prose and a code fence. */
const FENCED_RESPONSE = {
  ...TRUNCATED_RESPONSE,
  id: "gen-fenced",
  choices: [
    {
      index: 0,
      finish_reason: "stop",
      message: {
        role: "assistant",
        content: `Here is the analysis:\n\n\`\`\`json\n${JSON.stringify(ANALYSIS, null, 2)}\n\`\`\`\n`,
      },
    },
  ],
  usage: { prompt_tokens: 6100, completion_tokens: 2900, total_tokens: 9000 },
};

let requests: Array<{ max_tokens: number; messages: Array<{ content: string }> }>;

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
  requests = [];
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AIAnalyzer.analyzeContent", () => {
  it("fails a finish_reason=length reply as truncation, not as malformed JSON", async () => {
    stubOpenRouter(TRUNCATED_RESPONSE);

    await expect(new AIAnalyzer().analyzeContent("article body")).rejects.toThrow(
      /truncated at the token limit \(finish_reason=length, model=anthropic\/claude-sonnet-5\.5/
    );
  });

  it("parses a complete reply wrapped in prose and a ```json fence", async () => {
    stubOpenRouter(FENCED_RESPONSE);

    const result = await new AIAnalyzer().analyzeContent("article body");

    expect(result.title).toBe(ANALYSIS.title);
    expect(result.tool_mentions[0]?.tool).toBe("Claude Code");
    expect(result.model).toBe(MODEL);
  });

  it("requests a budget sized for the requested output, with a comment-free JSON template", async () => {
    // A bare reply, so this case isolates the request shape from the fence handling.
    stubOpenRouter({
      ...FENCED_RESPONSE,
      choices: [{ ...FENCED_RESPONSE.choices[0], message: { role: "assistant", content: JSON.stringify(ANALYSIS) } }],
    });
    await new AIAnalyzer().analyzeContent("article body");

    const request = requests[0];
    // #179: 80-120 + 800-1000 words at ~1.35 tokens/word plus ~1,000 structure tokens is
    // about 2,500; the budget must leave at least 2.5x that.
    expect(request?.max_tokens).toBeGreaterThanOrEqual(6250);
    expect(request?.max_tokens).toBe(ANALYSIS_MAX_TOKENS);
    // JS comments in the template invite the model to emit invalid JSON.
    expect(request?.messages[1]?.content).not.toMatch(/\d,?\s*\/\/ /);
  });
});

describe("OpenRouterService.generate (article-quality, state-of-ai summary)", () => {
  it("rejects a finish_reason=length reply once, without retrying", async () => {
    stubOpenRouter(TRUNCATED_RESPONSE);

    await expect(
      new OpenRouterService().generate({
        model: MODEL,
        messages: [{ role: "user", content: "q" }],
        max_tokens: 1000,
      })
    ).rejects.toThrow(/finish_reason=length.*max_tokens=1000/);
    expect(requests).toHaveLength(1);
  });
});
