import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { i18n, locales } from "../../i18n/config";
import { rootLocaleRedirect } from "../../lib/root-locale-redirect";

/**
 * #487: `/` redirects at the edge; `/[lang]/news` prerenders every locale.
 *
 * Why: #487 — the `/` page was a `force-dynamic` function on every bare-domain
 *   visit, and `/[lang]/news` rendered each locale on its first request.
 * What: `rootLocaleRedirect` answers a 307 to `/en` for `/` only, dropping the
 *   query as the old page did; no `app/page.tsx` is left to run; the news page
 *   returns one static param per configured locale; the insights hub returns
 *   none, because it reads the database, which is null during `next build`.
 * Test: `npx vitest run tests/unit/root-locale-redirect-487.test.ts`.
 */

// `server-only` throws outside the react-server condition; the news page imports it via getDictionary.
vi.mock("server-only", () => ({}));

const req = (p: string, method = "GET") => new NextRequest(`https://aipowerranking.com${p}`, { method });

describe("#487: rootLocaleRedirect", () => {
  it.each(["GET", "HEAD"])("%s / answers a temporary redirect to the default locale", (method) => {
    const res = rootLocaleRedirect(req("/", method));
    expect(res?.status).toBe(307);
    expect(res?.headers.get("location")).toBe(`https://aipowerranking.com/${i18n.defaultLocale}`);
    expect(i18n.defaultLocale).toBe("en");
  });

  it("drops the query, as redirect(\"/en\") in the old page did", () => {
    const res = rootLocaleRedirect(req("/?utm_source=x&ref=y"));
    expect(res?.headers.get("location")).toBe("https://aipowerranking.com/en");
  });

  it("ignores Accept-Language and cookies: the target never depended on the request", () => {
    const r = new NextRequest("https://aipowerranking.com/", {
      headers: { "accept-language": "de-DE,de;q=0.9", cookie: "NEXT_LOCALE=ja" },
    });
    expect(rootLocaleRedirect(r)?.headers.get("location")).toBe("https://aipowerranking.com/en");
  });

  it.each(["/en", "/de", "/en/", "/en/rankings", "/api/rankings", "/foo", "/%2F"])("%s is not redirected", (p) => {
    expect(rootLocaleRedirect(req(p))).toBeNull();
  });

  it("no app/page.tsx remains, so / has no page function", () => {
    expect(existsSync(path.resolve(__dirname, "../../app/page.tsx"))).toBe(false);
  });
});

describe("#487: static params", () => {
  it("/[lang]/news prerenders every configured locale", async () => {
    const { generateStaticParams } = await import("../../app/[lang]/news/page");
    expect(generateStaticParams()).toEqual(locales.map((lang) => ({ lang })));
    expect(generateStaticParams()).toHaveLength(locales.length);
  });

  it("/[lang]/insights is ISR per locale but prerenders none: its database reads throw at build", async () => {
    const { generateStaticParams } = await import("../../app/[lang]/insights/page");
    expect(generateStaticParams()).toEqual([]);
  });
});
