import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";
import { formatHeaderDate } from "../../lib/rankings/header";

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
 * must render its children as before.
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

async function renderLayout(lang: string): Promise<ReactElement> {
  const { default: LanguageLayout } = await import("../../app/[lang]/layout");
  return LanguageLayout({ children: <p>page body</p>, params: Promise.resolve({ lang }) });
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
