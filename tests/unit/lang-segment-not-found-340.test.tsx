import type { ReactElement, ReactNode } from "react";
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { isLocale, locales } from "../../i18n/config";
import { formatHeaderDate } from "../../lib/rankings/header";
import { URL_TABLE_ROWS, resolveTableRedirect } from "../../lib/seo/url-table";

/**
 * #340: a `[lang]` segment that is not a supported locale answers 404.
 *
 * Why: `/news_sitemap.xml/rankings` matched `app/[lang]/rankings` with
 * `lang = "news_sitemap.xml"`. The rankings grid passes `lang` to
 * `formatHeaderDate()`, whose `toLocaleDateString` throws a RangeError for a
 * value that is not a language tag, so the request answered 500.
 * What: runs the real `[lang]` layout. Next.js answers HTTP 404 for exactly
 * the error `notFound()` throws (digest `NEXT_HTTP_ERROR_FALLBACK;404`). An
 * unsupported segment must reject with it; every locale in `i18n/config.ts`
 * must render its children as before. The held #191 sources whose first
 * segment is not a locale (`/tech/best-ide-assistants`) still render their
 * English best-of page with a 200 at their own URL: the real middleware, then
 * the real layout and page at the path it serves.
 * Test: `npx vitest run tests/unit/lang-segment-not-found-340.test.tsx`.
 */

const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

// `server-only` throws outside the react-server condition; the layout is a Server Component.
vi.mock("server-only", () => ({}));
vi.mock("../../components/layout/client-layout", () => ({
  ClientLayout: ({ lang, children }: { lang: string; children: ReactNode }) => (
    <div data-lang={lang}>{children}</div>
  ),
}));
vi.mock("../../components/analytics/GoogleAnalytics", () => ({ GoogleAnalytics: () => null }));
vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return { ...actual, clerkMiddleware: (handler: unknown) => handler };
});

async function renderLayout(lang: string, children: ReactNode = <p>page body</p>): Promise<ReactElement> {
  const { default: LanguageLayout } = await import("../../app/[lang]/layout");
  return LanguageLayout({ children, params: Promise.resolve({ lang }) });
}

describe("[lang] layout rejects a segment that is not a supported locale (#340)", () => {
  it.each(["news_sitemap.xml", "sitemap-index.xml", "sitemap.txt", "xx", "EN"])(
    "answers 404 for %s",
    async (lang) => {
      await expect(renderLayout(lang)).rejects.toMatchObject(NOT_FOUND);
    }
  );

  it.each([...locales])("renders the page for the supported locale %s", async (lang) => {
    const html = renderToStaticMarkup(await renderLayout(lang));
    expect(html).toContain(`data-lang="${lang}"`);
    expect(html).toContain("page body");
  });

  it("the rankings header date throws for such a segment, which is the 500 the guard prevents", () => {
    expect(() => formatHeaderDate("2026-10-21T00:00:00Z", "news_sitemap.xml", "long")).toThrow(RangeError);
  });
});

type Handler = (
  auth: () => Promise<{ userId: string | null; sessionId: string | null }>,
  req: NextRequest
) => Promise<Response>;

/** The path Next.js renders for `source` after the real middleware: its rewrite target, else itself. */
async function servedPath(source: string): Promise<{ status: number; location: string | null; path: string }> {
  const { default: middleware } = await import("../../middleware");
  const res = await (middleware as unknown as Handler)(
    async () => ({ userId: null, sessionId: null }),
    new NextRequest(`http://localhost${source}`)
  );
  const rewrite = res.headers.get("x-middleware-rewrite");
  return {
    status: res.status,
    location: res.headers.get("location"),
    path: rewrite ? new URL(rewrite).pathname : source,
  };
}

// The signed table's 308 rows whose first segment is not a locale and that the
// table holds (resolveTableRedirect answers null): served as before (#191).
const heldNonLocaleSources = URL_TABLE_ROWS.filter(
  (row) =>
    row.action === "308" &&
    !isLocale(row.source.split("/")[1] ?? "") &&
    resolveTableRedirect(row.source.split("?")[0] ?? row.source) === null
).map((row) => row.source);

describe("held #191 sources under a non-locale segment keep rendering (#340)", () => {
  it("the table holds such sources", () => {
    expect(heldNonLocaleSources.length).toBeGreaterThan(0);
  });

  it.each(heldNonLocaleSources)("renders the English best-of page with a 200 at %s", async (source) => {
    const served = await servedPath(source);
    expect(served.status).toBe(200);
    expect(served.location).toBeNull();

    const [, lang = "", slug = ""] = served.path.split("/");
    const { default: Page } = await import(`../../app/[lang]/${slug}/page.tsx`);
    const params = Promise.resolve({ lang });
    const page = await Page({ params });
    const html = renderToStaticMarkup(await renderLayout(lang, page));
    expect(html).toContain('data-lang="en"');
    expect(html).toMatch(/<h1[^>]*>Best /);
  });
});
