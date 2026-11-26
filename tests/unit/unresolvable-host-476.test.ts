import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UNRESOLVABLE_EXCLUDE_DOMAINS,
  resolvePublisherUrl,
  unresolvableHostRule,
} from "../../lib/services/teaser-detection";
import { TavilySearchService } from "../../lib/services/tavily-search.service";

/**
 * Why: #476 — on 2026-11-25, 17 of 30 candidates were www.google.com or
 * tavily.com pages instead of the publisher's. They gave all 9
 * teaser_unexpanded rejections and 1 extraction failure.
 */

/** The pipeline order: unwrap first, then classify what is left. */
const ruleAfterUnwrap = (url: string) => unresolvableHostRule(resolvePublisherUrl(url));

describe("unresolvableHostRule (#476)", () => {
  it.each([
    // 11-25 shape: a Google Alerts redirect with no target param.
    ["https://www.google.com/url?rct=j&sa=t&ct=ga&cd=CAIyGjQ5", "google_wrapper"],
    ["https://www.google.com/url?url=javascript%3Aalert(1)", "google_wrapper"],
    ["https://www.google.com/search?q=claude+code", "google_wrapper"],
    ["https://google.co.uk/url?sa=t", "google_wrapper"],
    ["https://news.google.com/rss/articles/CBMiWkFVX3lxTE1fake?oc=5", "news_google"],
    ["https://news.google.com/articles/CAIiEFake", "news_google"],
    ["https://tavily.com/blog/some-post", "tavily"],
    ["https://www.tavily.com/", "tavily"],
    ["not a url", "malformed_url"],
    ["", "malformed_url"],
    ["ftp://files.example/x", "malformed_url"],
  ])("drops %j as %s", (url, rule) => {
    expect(ruleAfterUnwrap(url)).toBe(rule);
  });

  it.each([null, undefined, 42])("drops a non-string URL %j as malformed_url without throwing", (url) => {
    expect(unresolvableHostRule(url)).toBe("malformed_url");
  });

  it("keeps a google url= wrapper that resolves, as the publisher URL", () => {
    const wrapper = "https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Fwww.marktechpost.com%2F2026%2F11%2F22%2Fstory%2F&ct=ga";
    const resolved = resolvePublisherUrl(wrapper);
    expect(resolved).toBe("https://www.marktechpost.com/2026/11/22/story/");
    expect(unresolvableHostRule(resolved)).toBeNull();
  });

  it.each([
    "https://www.vals.ai/benchmarks/swe-bench",
    "https://www.marktechpost.com/2026/11/22/story/",
    "https://www.infosecurity-magazine.com/news/ai-coding/",
    // Google's own publisher pages are not wrappers.
    "https://cloud.google.com/blog/products/ai-machine-learning/gemini-code-assist",
    "https://ai.google.dev/gemini-api/docs/changelog",
    "https://blog.google/technology/ai/",
    "https://developers.googleblog.com/en/jules/",
  ])("keeps publisher URL %j", (url) => {
    expect(ruleAfterUnwrap(url)).toBeNull();
  });
});

describe("Tavily search request (#476)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends exclude_domains for the aggregator hosts and leaves include_domains unset", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ query: "q", results: [], response_time: 0.1 }),
    } as unknown as Response);

    await new TavilySearchService("test-key").searchAINews({ topic: "news" });

    const bodies = fetchSpy.mock.calls
      .filter((call) => String(call[0]).includes("tavily.com/search"))
      .map((call) => JSON.parse(call[1]?.body as string) as Record<string, unknown>);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.exclude_domains).toEqual([...UNRESOLVABLE_EXCLUDE_DOMAINS]);
      expect(body.include_domains).toBeUndefined();
    }
    expect(UNRESOLVABLE_EXCLUDE_DOMAINS).toEqual(
      expect.arrayContaining(["google.com", "news.google.com", "tavily.com"])
    );
  });
});
