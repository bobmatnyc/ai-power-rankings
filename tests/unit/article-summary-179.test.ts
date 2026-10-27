/**
 * Article summaries are one 80-120 word paragraph (issue #179).
 *
 * Why: The analysis prompt asked for a 400-500 word summary and listed its parts as
 *   bullets, and the news page used the whole summary as its meta description.
 * What: Pins the prompt text at all four summary sites, the 6,500 token budget, the
 *   logged word count, and the ~160 character
 *   word-boundary meta description, both in the helper and in the news page metadata.
 * Test: `npx vitest run tests/unit/article-summary-179.test.ts`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countWords,
  META_DESCRIPTION_MAX_CHARS,
  SUMMARY_PROMPT_RULE,
  toMetaDescription,
} from "../../lib/article-summary";
import { AIAnalyzer } from "../../lib/services/article-ingestion.service";

vi.mock("server-only", () => ({}));
// generateMetadata needs none of the page's component tree.
vi.mock("@/components/news/news-detail-content", () => ({ default: () => null }));

/** The rule, written out so an edit to the constant also has to edit this test. */
const PINNED_RULE =
  "ONE paragraph of 80-120 words of plain prose, " +
  "with no bullet points, numbered lists, headings, markdown or line breaks";

const LONG_SUMMARY =
  "Anthropic has made code review for Claude Code generally available to every paid plan, " +
  "after a preview in which teams used it to flag defects before merge. The company says " +
  "reviews now run on each pull request and post findings inline, and that pricing follows usage.";

function words(n: number): string {
  // #180: the last word ends a sentence, so an in-range summary passes the validator.
  return `${Array.from({ length: n }, (_, i) => `word${i}`).join(" ")}.`;
}

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

let requests: Array<{ max_tokens: number; messages: Array<{ role: string; content: string }> }>;

function stubOpenRouter(summary: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
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
    })
  );
}

beforeEach(() => {
  requests = [];
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("analysis prompt (#179)", () => {
  it("states the one-paragraph rule once, as SUMMARY_PROMPT_RULE", () => {
    expect(SUMMARY_PROMPT_RULE).toBe(PINNED_RULE);
  });

  it("asks for one 80-120 word paragraph at all four summary sites, with no bullets", async () => {
    stubOpenRouter(words(100));
    vi.spyOn(console, "info").mockImplementation(() => {});
    await new AIAnalyzer().analyzeContent("article body");

    const [system, user] = requests[0]?.messages.map((m) => m.content) ?? [];
    const occurrences = (text = "") => text.split(PINNED_RULE).length - 1;
    expect(occurrences(system), "system prompt").toBe(1);
    expect(occurrences(user), "user prompt: template + two requirements").toBe(3);

    for (const text of [system, user]) {
      expect(text).not.toMatch(/400-500/);
    }
    // The JSON template's summary value: one line, no list items.
    const template = /"summary": "([^"]*)"/.exec(user ?? "")?.[1];
    expect(template).toBeDefined();
    expect(template).not.toMatch(/\n/);
    expect(template).not.toMatch(/(^|\s)[-*•]\s/);
  });

  it("requests max_tokens 6500", async () => {
    stubOpenRouter(words(100));
    vi.spyOn(console, "info").mockImplementation(() => {});
    await new AIAnalyzer().analyzeContent("article body");

    expect(requests[0]?.max_tokens).toBe(6500);
  });
});

describe("summary word count (#179)", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one\n two\tthree  ")).toBe(3);
  });

  // #180: an off-length summary is now rejected; see article-summary-validator-180.test.ts.
  it("logs the word count of an in-range summary and returns it unchanged", async () => {
    const summary = words(100);
    stubOpenRouter(summary);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await new AIAnalyzer().analyzeContent("article body");

    expect(result.summary).toBe(summary);
    expect(info).toHaveBeenCalledWith(
      "[AIAnalyzer] Summary word count",
      expect.objectContaining({ words: 100 })
    );
  });
});

describe("toMetaDescription (#179)", () => {
  it("cuts a long summary to at most 160 characters on a word boundary", () => {
    const out = toMetaDescription(LONG_SUMMARY);

    expect(Array.from(out).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_CHARS);
    expect(out.endsWith("…")).toBe(true);
    const kept = out.slice(0, -1);
    expect(LONG_SUMMARY.startsWith(kept)).toBe(true);
    // The next source character after the kept text is a word boundary.
    expect(LONG_SUMMARY.charAt(kept.length)).toMatch(/[\s,.;:]/);
    expect(kept.length).toBeGreaterThan(120);
  });

  it("returns a short summary unchanged, with whitespace collapsed", () => {
    expect(toMetaDescription("A short\n summary.")).toBe("A short summary.");
  });

  it("hard-cuts text with no spaces", () => {
    const out = toMetaDescription("x".repeat(500));

    expect(out).toBe(`${"x".repeat(META_DESCRIPTION_MAX_CHARS - 1)}…`);
  });

  it("keeps a whole last word that ends exactly at the cut", () => {
    const text = `${"a".repeat(158)}b c`; // the 160th character is the space
    expect(toMetaDescription(text)).toBe(`${"a".repeat(158)}b…`);
  });
});

describe("news article metadata (#179)", () => {
  it("derives a description of at most ~160 characters from a long summary", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3007");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          article: {
            id: "a1",
            slug: "big-launch",
            title: "Big launch",
            content: "Body",
            summary: `${LONG_SUMMARY} ${LONG_SUMMARY}`,
            published_date: "2026-09-01",
            created_at: "2026-09-01",
            updated_at: "2026-09-02",
          },
          tool: null,
        })
      )
    );
    const { generateMetadata } = await import("../../app/[lang]/news/[slug]/page");

    const metadata = await generateMetadata({
      params: Promise.resolve({ lang: "en", slug: "big-launch" }),
    });

    const description = String(metadata.description);
    expect(Array.from(description).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_CHARS);
    expect(description).toBe(toMetaDescription(LONG_SUMMARY));
    expect(metadata.openGraph?.description).toBe(description);
  }, 60_000);
});
