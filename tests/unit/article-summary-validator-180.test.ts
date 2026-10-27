/**
 * Article summaries are validated, and a rejected one is retried once (issue #180).
 *
 * Why: #179 made the summary one 80-120 word paragraph but only logged its length, so
 *   an off-length, bulleted or cut-off summary still ingested and reached the news page.
 * What: Pins every `validateSummary` branch and the 79/80/120/121 word boundaries, then
 *   drives the real `AIAnalyzer` and `ArticleIngestionService` with only the OpenRouter
 *   `fetch` replaced: one retry after a backoff, success on the retry, and a typed
 *   `SummaryRejectedError` naming the failed check after a second failure. The backoff
 *   timer is faked, so no test sleeps in real time.
 * Test: `npx vitest run tests/unit/article-summary-validator-180.test.ts`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SUMMARY_RETRY_BACKOFF_MS,
  SUMMARY_WORD_MAX,
  SUMMARY_WORD_MIN,
  SummaryRejectedError,
  validateSummary,
} from "../../lib/article-summary";
import {
  AIAnalyzer,
  ArticleIngestionService,
} from "../../lib/services/article-ingestion.service";

vi.mock("server-only", () => ({}));

/** `n` words, the last carrying a full stop: a valid one-paragraph summary when 80 <= n <= 120. */
function sentence(n: number): string {
  const body = Array.from({ length: n }, (_, i) => `word${i}`);
  return `${body.join(" ")}.`;
}

describe("validateSummary (#180)", () => {
  it("passes a single paragraph of in-range words that ends a sentence", () => {
    expect(validateSummary(sentence(100))).toEqual([]);
  });

  it.each([
    [SUMMARY_WORD_MIN - 1, ["word_count_below_min (79<80)"]],
    [SUMMARY_WORD_MIN, []],
    [SUMMARY_WORD_MAX, []],
    [SUMMARY_WORD_MAX + 1, ["word_count_above_max (121>120)"]],
  ])("treats %i words as %j", (n, expected) => {
    expect(validateSummary(sentence(n))).toEqual(expected);
  });

  it.each([
    ["a line break", `${sentence(50)}\n${sentence(50)}`],
    ["a Windows line break", `${sentence(50)}\r\n${sentence(50)}`],
    ["a leading dash bullet", `- ${sentence(100)}`],
    ["a leading star bullet", `* ${sentence(100)}`],
    ["a leading bullet dot", `• ${sentence(100)}`],
    ["a leading numbered item", `1. ${sentence(100)}`],
  ])("rejects text with %s as not a single paragraph", (_label, text) => {
    expect(validateSummary(text)).toContain("not_single_paragraph");
  });

  it("does not mistake a leading year or a hyphenated word for a bullet", () => {
    expect(validateSummary(`2026 ${sentence(99)}`)).toEqual([]);
    expect(validateSummary(`Open-source ${sentence(99)}`)).toEqual([]);
  });

  it.each([
    ["no closing punctuation", `${sentence(100).slice(0, -1)}`],
    ["a trailing comma", `${sentence(100).slice(0, -1)},`],
    ["a trailing ellipsis", `${sentence(100).slice(0, -1)}…`],
    ["a trailing colon", `${sentence(100).slice(0, -1)}:`],
  ])("rejects a summary with %s as not ending a sentence", (_label, text) => {
    expect(validateSummary(text)).toEqual(["no_sentence_end"]);
  });

  it.each([
    ["a question mark", "?"],
    ["an exclamation mark", "!"],
    ["a closing quote", '."'],
    ["a closing curly quote", ".”"],
    ["a closing parenthesis", ".)"],
  ])("accepts a sentence end followed by %s", (_label, tail) => {
    expect(validateSummary(`${sentence(100).slice(0, -1)}${tail}`)).toEqual([]);
  });

  it("ignores surrounding whitespace", () => {
    expect(validateSummary(`\n  ${sentence(100)}  \n`)).toEqual([]);
  });

  it("rejects an empty summary on word count and sentence end", () => {
    expect(validateSummary("")).toEqual(["word_count_below_min (0<80)", "no_sentence_end"]);
  });

  it("reports every failed check, in a fixed order", () => {
    expect(validateSummary(`- ${sentence(130).slice(0, -1)}`)).toEqual([
      "not_single_paragraph",
      "word_count_above_max (131>120)",
      "no_sentence_end",
    ]);
  });
});

describe("SummaryRejectedError (#180)", () => {
  it("builds a reason that names each failed check", () => {
    const error = new SummaryRejectedError(["word_count_below_min (79<80)", "no_sentence_end"]);
    expect(error.reason).toBe("summary_rejected: word_count_below_min (79<80); no_sentence_end");
    expect(error.message).toBe(error.reason);
    expect(error.failures).toEqual(["word_count_below_min (79<80)", "no_sentence_end"]);
  });
});

function analysis(summary: string) {
  return {
    title: "Code review for Claude Code is generally available",
    summary,
    rewritten_content: "Body.",
    source: "example.com",
    published_date: "2026-10-20",
    category: "Code Assistant",
    tags: ["code review"],
    tool_mentions: [{ tool: "Claude Code", context: "launch", sentiment: 0.7, relevance: 1 }],
    company_mentions: [{ company: "Anthropic", context: "vendor", tools: ["Claude Code"] }],
    overall_sentiment: 0.6,
    importance_score: 7,
    key_insights: ["Generally available"],
  };
}

/** Answers each OpenRouter call with the next summary; the last one repeats. */
function stubOpenRouter(summaries: string[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const fetchStub = vi.fn(async () => {
    const summary = summaries[Math.min(call, summaries.length - 1)] ?? "";
    call += 1;
    const reply = {
      model: "anthropic/claude-sonnet-5.5",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: { role: "assistant", content: JSON.stringify(analysis(summary)) },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
    };
    return new Response(JSON.stringify(reply), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

/** Settles a promise into `{ value }` or `{ error }` so a rejection never goes unhandled. */
function settle<T>(promise: Promise<T>): Promise<{ value?: T; error?: unknown }> {
  return promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Only the backoff timer is faked: the test advances it by hand and never sleeps.
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AIAnalyzer summary retry (#180)", () => {
  it("makes one call and no backoff when the first summary is valid", async () => {
    const fetchStub = stubOpenRouter([sentence(100)]);

    const result = await new AIAnalyzer().analyzeContent("article body");

    expect(result.summary).toBe(sentence(100));
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retries once after the backoff and returns the retry's valid summary", async () => {
    const fetchStub = stubOpenRouter([sentence(SUMMARY_WORD_MIN - 1), sentence(100)]);

    const pending = settle(new AIAnalyzer().analyzeContent("article body"));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount(), "the retry waits on the backoff timer").toBe(1);

    await vi.advanceTimersByTimeAsync(SUMMARY_RETRY_BACKOFF_MS);
    const { value, error } = await pending;

    expect(error).toBeUndefined();
    expect(value?.summary).toBe(sentence(100));
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("does not call again before the backoff has elapsed", async () => {
    const fetchStub = stubOpenRouter([sentence(10), sentence(100)]);

    const pending = settle(new AIAnalyzer().analyzeContent("article body"));
    await vi.advanceTimersByTimeAsync(SUMMARY_RETRY_BACKOFF_MS - 1);
    expect(fetchStub).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("throws SummaryRejectedError naming the check after a second failure, with exactly two calls", async () => {
    const fetchStub = stubOpenRouter([sentence(SUMMARY_WORD_MAX + 1), sentence(SUMMARY_WORD_MIN - 1)]);

    const pending = settle(new AIAnalyzer().analyzeContent("article body"));
    await vi.advanceTimersByTimeAsync(SUMMARY_RETRY_BACKOFF_MS * 10);
    const { error } = await pending;

    expect(error).toBeInstanceOf(SummaryRejectedError);
    // The reason reports the retry's failure, the last one seen.
    expect((error as SummaryRejectedError).reason).toBe(
      "summary_rejected: word_count_below_min (79<80)"
    );
    expect(fetchStub).toHaveBeenCalledTimes(2);
  });

  it("does not retry an OpenRouter transport error", async () => {
    const fetchStub = vi.fn(async () => new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchStub);

    const { error } = await settle(new AIAnalyzer().analyzeContent("article body"));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SummaryRejectedError);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});

describe("ArticleIngestionService summary rejection (#180)", () => {
  it("passes SummaryRejectedError out of ingestArticle unwrapped", async () => {
    stubOpenRouter(["Too short.", sentence(100).slice(0, -1)]);
    const service = new ArticleIngestionService();
    Object.defineProperty(service, "getCurrentState", {
      value: async () => ({ currentRankings: [], existingTools: [], existingCompanies: [] }),
    });

    const pending = settle(service.ingestArticle({ type: "text", input: "body", dryRun: true }));
    await vi.advanceTimersByTimeAsync(SUMMARY_RETRY_BACKOFF_MS * 10);
    const { error } = await pending;

    expect(error).toBeInstanceOf(SummaryRejectedError);
    expect((error as SummaryRejectedError).reason).toBe(
      "summary_rejected: no_sentence_end"
    );
  });
});
