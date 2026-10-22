/**
 * Article quality assessment fails closed on a truncated or unparseable reply (issue #172).
 *
 * Why: #203 added truncation handling to article analysis but not to the quality step. A
 *   reply that did not parse fell back to the default assessment with no `error`, so the
 *   candidate was counted as a quality rejection and the run still ended `completed`.
 * What: Drives `ArticleQualityService.assessArticle` against the real
 *   `OpenRouterService` with a stubbed `fetch`. A finish_reason "length" reply and a reply
 *   holding no complete JSON object must each yield an assessment carrying `error`, logged
 *   at error level. A complete reply wrapped in a fence must still parse. The request must
 *   carry the raised token budget.
 * Test: `npx vitest run lib/services/article-quality.service.test.ts`. No network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleQualityService } from "./article-quality.service";
import { loggers } from "../logger";

const MODEL = "anthropic/claude-sonnet-5.5";

const ARTICLE = {
  title: "Cursor ships background agents for large monorepos",
  content: "Cursor announced background agents that run tests across large monorepos.",
  source: "news-a.example.com",
};

function reply(content: string, finishReason: string) {
  return {
    id: "gen-fixture",
    object: "chat.completion",
    created: 1792648800,
    model: MODEL,
    choices: [{ index: 0, finish_reason: finishReason, message: { role: "assistant", content } }],
    usage: { prompt_tokens: 1800, completion_tokens: 900, total_tokens: 2700 },
  };
}

const VERDICT = {
  qualityScore: 8,
  relevanceScore: 9,
  credibilityScore: 8,
  reasoning: "Specific product news about an AI coding tool",
  suggestedCategories: ["AI Assistants"],
};

let requests: Array<{ max_tokens: number }>;
let errorLog: ReturnType<typeof vi.spyOn>;

function stubOpenRouter(body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(body), { status: 200 });
    })
  );
}

beforeEach(() => {
  requests = [];
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  errorLog = vi.spyOn(loggers.api, "error").mockImplementation(() => {});
  vi.spyOn(loggers.api, "warn").mockImplementation(() => {});
  vi.spyOn(loggers.api, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ArticleQualityService.assessArticle (#172)", () => {
  it("returns an assessment carrying `error` for a finish_reason=length reply", async () => {
    stubOpenRouter(reply('{"qualityScore": 8, "relevanceScore": 9, "reas', "length"));

    const assessment = await new ArticleQualityService().assessArticle(ARTICLE);

    expect(assessment.shouldIngest).toBe(false);
    expect(assessment.error).toMatch(/truncated at the token limit/);
    expect(errorLog).toHaveBeenCalled();
  });

  it.each([
    ["an unterminated object", '{"qualityScore": 8, "relevanceScore": 9, "reasoning": "Spec', "unterminated"],
    ["no JSON object at all", "I cannot evaluate this article.", "no_object"],
    ["a balanced but invalid object", "{qualityScore: 8, relevanceScore: 9}", "invalid"],
  ])("returns an assessment carrying `error` for %s, logged at error level", async (_name, content, reason) => {
    stubOpenRouter(reply(content, "stop"));

    const assessment = await new ArticleQualityService().assessArticle(ARTICLE);

    expect(assessment.shouldIngest).toBe(false);
    expect(assessment.error).toBeDefined();
    expect(assessment.error).toContain(reason);
    const logged = errorLog.mock.calls.map((call) => JSON.stringify(call));
    expect(logged.some((line) => line.includes(reason))).toBe(true);
  });

  // #172: a reply that parses but carries no numeric score is not a quality verdict.
  it.each([
    ["an empty object", "{}"],
    ["schema-drifted keys", '{"quality": 8, "relevance": 9, "credibility": 8}'],
  ])("returns an assessment carrying `error` for %s", async (_name, content) => {
    stubOpenRouter(reply(content, "stop"));

    const assessment = await new ArticleQualityService().assessArticle(ARTICLE);

    expect(assessment.shouldIngest).toBe(false);
    expect(assessment.error).toMatch(/no numeric score/);
  });

  it("parses a complete verdict wrapped in prose and a ```json fence, with no error", async () => {
    stubOpenRouter(reply(`Here is my evaluation:\n\`\`\`json\n${JSON.stringify(VERDICT)}\n\`\`\``, "stop"));

    const assessment = await new ArticleQualityService().assessArticle(ARTICLE);

    expect(assessment.error).toBeUndefined();
    expect(assessment.relevanceScore).toBe(9);
    expect(assessment.shouldIngest).toBe(true);
  });

  it("requests a token budget well above the ~300-token verdict", async () => {
    stubOpenRouter(reply(JSON.stringify(VERDICT), "stop"));

    await new ArticleQualityService().assessArticle(ARTICLE);

    expect(requests[0]?.max_tokens).toBeGreaterThanOrEqual(2000);
  });
});
