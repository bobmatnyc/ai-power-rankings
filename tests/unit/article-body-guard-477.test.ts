import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Why: #477 — a URL whose fallback HTML fetch yielded only a cookie banner was
 * analyzed and inserted as an active article.
 * What: Runs a full URL `ingestArticle()` through the real ContentExtractor
 * fallback path (Jina unavailable, `fetch` stubbed) with the analyzer, current
 * state and `ArticleDatabaseService` replaced, and asserts an empty or
 * consent-only body is refused before analysis and never saved.
 * Test: `npx vitest run tests/unit/article-body-guard-477.test.ts`. No network, no DB.
 */

const saveArticle = vi.hoisted(() => vi.fn(async () => ({ id: "article-1" })));
const analyzeContent = vi.hoisted(() => vi.fn());

vi.mock("../../lib/services/jina-reader.service", () => ({
  jinaReaderService: { isAvailable: () => false, fetchArticle: vi.fn() },
}));
vi.mock("../../lib/services/article-db-service", () => ({
  ArticleDatabaseService: class {
    ingestArticle = saveArticle;
  },
}));

import { ArticleIngestionService } from "../../lib/services/article-ingestion.service";

function stubbedService(): ArticleIngestionService {
  const service = new ArticleIngestionService();
  Object.defineProperty(service, "aiAnalyzer", { value: { analyzeContent } });
  Object.defineProperty(service, "rankingsCalculator", {
    value: {
      calculateRankingChanges: () => [],
      identifyNewEntities: () => ({ newTools: [], newCompanies: [] }),
    },
  });
  Object.defineProperty(service, "getCurrentState", {
    value: async () => ({ currentRankings: [], existingTools: [], existingCompanies: [] }),
  });
  return service;
}

function serveHtml(html: string): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }))
  );
}

const COOKIE_BANNER_HTML = `<html><body><main>
<p>We use cookies and similar tracking technologies to improve your experience.</p>
<p>By clicking "Accept all", you consent to our use of cookies. You can manage preferences at any time.</p>
<button>Accept all</button><button>Reject all</button>
<p>See our Privacy Policy for details.</p></main></body></html>`;

const ARTICLE_HTML = `<html><body><article>
<p>Vercel announced a new board member on Tuesday and outlined plans for agent swarms in its platform.
The company said the feature enters public beta next month for all paid teams.</p>
</article></body></html>`;

const URL = "https://example.com/news/vercel";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  analyzeContent.mockResolvedValue({
    title: "Vercel adds board member",
    summary: "s",
    source: "src",
    tags: [],
    category: "news",
    importance_score: 5,
    overall_sentiment: 0,
    tool_mentions: [],
    company_mentions: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("URL ingestion refuses a page with no article body (#477)", () => {
  it("rejects a cookie-banner-only page on the HTML fallback path and inserts nothing", async () => {
    serveHtml(COOKIE_BANNER_HTML);
    await expect(
      stubbedService().ingestArticle({ type: "url", input: URL, dryRun: false })
    ).rejects.toMatchObject({ name: "ArticleBodyRejectedError", reason: "boilerplate_body" });
    expect(analyzeContent).not.toHaveBeenCalled();
    expect(saveArticle).not.toHaveBeenCalled();
  });

  it("rejects an empty body and inserts nothing", async () => {
    serveHtml("<html><body><main>   </main></body></html>");
    await expect(
      stubbedService().ingestArticle({ type: "url", input: URL, dryRun: false })
    ).rejects.toMatchObject({ name: "ArticleBodyRejectedError", reason: "empty_body" });
    expect(analyzeContent).not.toHaveBeenCalled();
    expect(saveArticle).not.toHaveBeenCalled();
  });

  it("still ingests a short real news article", async () => {
    serveHtml(ARTICLE_HTML);
    await stubbedService().ingestArticle({ type: "url", input: URL, dryRun: false });
    expect(analyzeContent).toHaveBeenCalledTimes(1);
    expect(saveArticle).toHaveBeenCalledTimes(1);
  });
});

// #477: a real article about privacy/consent, as Jina markdown (headings and
// list items carry no terminal punctuation), must not be read as a banner.
const CONSENT_NEWS_MARKDOWN = `# EU regulators fine ad network over cookie consent

## Privacy enforcement

The French data regulator fined an ad network 40 million euros on Monday for setting tracking cookies before users gave consent.
- The network must change its banner within three months
- Regulators said the decision applies across the EU
The company said it will appeal the ruling in court.`;

describe("assertArticleBody keeps real consent news (#477)", () => {
  it("passes a ~300-char markdown news article about cookie consent", async () => {
    const { assertArticleBody } = await import("../../lib/services/article-body-guard");
    expect(() => assertArticleBody(CONSENT_NEWS_MARKDOWN)).not.toThrow();
  });
});
