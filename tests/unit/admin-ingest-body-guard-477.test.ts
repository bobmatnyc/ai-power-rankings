import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Why: #477 — the admin route POST /api/admin/articles/ingest reaches
 * ArticleDatabaseService.ingestArticle, whose URL case extracted, analyzed and
 * inserted with no body check.
 * What: Drives the db-service URL path with a cookie-banner page (Jina off,
 * `fetch` stubbed, analyzer and repository replaced) and asserts a typed
 * refusal before analysis; then asserts the route maps that refusal to 422.
 * Test: `npx vitest run tests/unit/admin-ingest-body-guard-477.test.ts`. No network, no DB.
 */

const analyzeContent = vi.hoisted(() => vi.fn());
const repoCreate = vi.hoisted(() => vi.fn());
const routeIngest = vi.hoisted(() => vi.fn());

vi.mock("../../lib/services/jina-reader.service", () => ({
  jinaReaderService: { isAvailable: () => false, fetchArticle: vi.fn() },
}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  ArticlesRepository: class {
    create = repoCreate;
    createArticle = repoCreate;
  },
}));

const COOKIE_BANNER_HTML = `<html><body><main>
<p>We use cookies and similar tracking technologies to improve your experience.</p>
<p>By clicking "Accept all", you consent to our use of cookies. You can manage preferences at any time.</p>
<p>See our Privacy Policy for details.</p></main></body></html>`;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(COOKIE_BANNER_HTML, { status: 200, headers: { "content-type": "text/html" } })
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.doUnmock("../../lib/services/article-db-service");
  vi.doUnmock("../../lib/api-auth");
  vi.resetModules();
});

describe("admin URL ingest refuses a page with no article body (#477)", () => {
  it.each([true, false])(
    "rejects a cookie-banner page via ArticleDatabaseService (dryRun=%s)",
    async (dryRun) => {
      const { ArticleDatabaseService } = await import("../../lib/services/article-db-service");
      const service = new ArticleDatabaseService();
      Object.defineProperty(service, "aiAnalyzer", { value: { analyzeContent } });

      await expect(
        service.ingestArticle({ type: "url", input: "https://example.com/vercel", dryRun })
      ).rejects.toMatchObject({ name: "ArticleBodyRejectedError", reason: "boilerplate_body" });
      expect(analyzeContent).not.toHaveBeenCalled();
      expect(repoCreate).not.toHaveBeenCalled();
    }
  );

  it("returns 422 with error and reason from the admin route", async () => {
    vi.resetModules();
    const { ArticleBodyRejectedError } = await import("../../lib/services/article-body-guard");
    routeIngest.mockRejectedValue(new ArticleBodyRejectedError("empty_body", "0 chars"));
    vi.doMock("../../lib/api-auth", () => ({ requireAdmin: async () => ({ userId: "admin" }) }));
    vi.doMock("../../lib/services/article-db-service", () => ({
      ArticleDatabaseService: class {
        ingestArticle = routeIngest;
      },
    }));
    const { POST } = await import("../../app/api/admin/articles/ingest/route");

    const response = await POST(
      new NextRequest("http://localhost/api/admin/articles/ingest", {
        method: "POST",
        body: JSON.stringify({ type: "url", input: "https://example.com/x", dryRun: false }),
        headers: { "content-type": "application/json" },
      })
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      reason: "empty_body",
      error: expect.stringContaining("empty_body"),
    });
  });
});
