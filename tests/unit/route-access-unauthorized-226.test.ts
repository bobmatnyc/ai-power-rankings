import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { type RouteAccess, routeAccess } from "../../lib/route-access";
import { locales } from "../../i18n/config";

/**
 * Route classification snapshot for #226.
 *
 * Why: `/<locale>/unauthorized` matched no pattern, so the middleware classed it
 * `default` and ran an auth lookup for a static page shown to signed-out
 * visitors. Making it public must not move any other route between classes.
 * What: Classifies every page route under `app/[lang]/` for every configured
 * locale (plus an unknown `xx` segment), the bare root routes and each API
 * prefix, and compares the result with a fixed table. Only `/<locale>/unauthorized`
 * differs from the classification before #226.
 * Test: `npx vitest run tests/unit/route-access-unauthorized-226.test.ts`.
 */

function classify(path: string): RouteAccess {
  return routeAccess(new NextRequest(`http://localhost${path}`));
}

/** Class of each page suffix under a configured locale segment. */
const LOCALE_PAGES: Record<string, RouteAccess> = {
  "": "default",
  "/admin": "protected",
  "/admin/auth/signin": "protected",
  "/admin/automated-ingestion": "protected",
  "/admin/news": "protected",
  "/admin/news/edit/1": "protected",
  "/admin/news/new": "protected",
  "/admin/state-of-ai": "protected",
  "/admin/whats-new-summary": "protected",
  "/clerk-debug": "default",
  "/dashboard": "protected",
  "/dashboard/auth/error": "protected",
  "/dashboard/auth/signin": "protected",
  "/dashboard/cache": "protected",
  "/dashboard/dashboard": "protected",
  "/dashboard/news-ingestion": "protected",
  "/dashboard/rankings": "protected",
  "/dashboard/rankings/2026-10/changes": "protected",
  "/dashboard/tools": "protected",
  "/dashboard/tools/x": "protected",
  "/sign-in": "public",
  "/sign-in/factor-one": "public",
  "/sign-up": "public",
  "/sign-up/verify": "public",
  // #226: the only entry that changed class (was "default").
  "/unauthorized": "public",
  // The pattern is exact: neighbours of /unauthorized keep their old class.
  "/unauthorized/x": "default",
  "/unauthorizedx": "default",
  "/about": "public",
  "/best-ai-app-builders": "default",
  "/best-ai-code-editors": "default",
  "/best-ai-coding-tools": "default",
  "/best-autonomous-agents": "default",
  "/best-code-review-tools": "default",
  "/best-devops-assistants": "default",
  "/best-ide-assistants": "default",
  "/best-open-source-frameworks": "default",
  "/best-testing-tools": "default",
  "/contact": "public",
  "/contact/x": "public",
  "/methodology": "public",
  "/news": "public",
  "/news/x": "public",
  "/privacy": "public",
  "/rankings": "public",
  "/terms": "public",
  "/tools": "public",
  "/tools/x": "public",
  "/trending": "public",
  "/whats-new": "default",
  "/whats-new/recent": "default",
};

/** Under an unknown locale segment only the locale-free protected patterns apply. */
function unknownLocaleClass(suffix: string): RouteAccess {
  return suffix.startsWith("/admin") || suffix.startsWith("/dashboard") ? "protected" : "default";
}

const OTHER_ROUTES: Record<string, RouteAccess> = {
  "/": "public",
  "/design": "default",
  "/sign-in": "public",
  "/sign-up": "public",
  "/unauthorized": "default",
  "/sitemap.xml": "default",
  "/robots.txt": "default",
  "/api/admin": "protected",
  "/api/admin/x": "protected",
  "/API/admin/x": "protected",
  "/api/data/x": "protected",
  "/api/ai/x": "protected",
  "/api/public/x": "public",
  "/api/health": "public",
  "/api/rankings": "public",
  "/api/tools/x": "public",
  "/api/news": "public",
  "/api/og": "public",
  "/api/cron/x": "public",
  "/api/whats-new/summary": "public",
  "/api/companies": "default",
  "/api/state-of-ai/current": "default",
};

describe("#226: /<locale>/unauthorized is public", () => {
  it.each(["/en/unauthorized", "/es/unauthorized"])("classes %s as public", (path) => {
    expect(classify(path)).toBe("public");
  });
});

describe("#226: admin and dashboard routes stay protected", () => {
  it.each(["/en/admin", "/en/admin/news", "/en/admin/news/edit/1", "/en/dashboard", "/en/dashboard/tools"])(
    "classes %s as protected",
    (path) => {
      expect(classify(path)).toBe("protected");
    }
  );
});

describe("#226: classification snapshot of every known route", () => {
  const cases: Array<[string, RouteAccess]> = [];
  for (const locale of locales) {
    for (const [suffix, access] of Object.entries(LOCALE_PAGES)) {
      cases.push([`/${locale}${suffix}`, access]);
    }
  }
  for (const suffix of Object.keys(LOCALE_PAGES)) {
    cases.push([`/xx${suffix}`, unknownLocaleClass(suffix)]);
  }
  for (const [path, access] of Object.entries(OTHER_ROUTES)) cases.push([path, access]);

  it("covers every locale page, the unknown-locale pages and the API prefixes", () => {
    expect(cases).toHaveLength((locales.length + 1) * Object.keys(LOCALE_PAGES).length + Object.keys(OTHER_ROUTES).length);
  });

  it.each(cases)("classes %s as %s", (path, access) => {
    expect(classify(path)).toBe(access);
  });
});
