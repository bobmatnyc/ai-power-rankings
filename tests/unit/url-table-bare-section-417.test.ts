import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * #417: a bare unprefixed section path 308s once to its English page.
 *
 * Why: `/news` reached `app/[lang]` with `news` as the locale, and the #340
 *   layout 404s a non-locale segment; the pattern rule skipped single segments.
 * What: `/news`, `/rankings`, `/tools`, `/admin` resolve to `/en/<section>` in
 *   one hop, through the middleware too, and `/admin` then reaches sign-in.
 *   Reserved, locale, root and unknown single segments still answer null.
 * Test: `npx vitest run tests/unit/url-table-bare-section-417.test.ts`.
 */

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  const { fakeClerkMiddleware } = await import("./helpers/clerk-middleware-harness");
  return { ...actual, clerkMiddleware: fakeClerkMiddleware };
});

import { locales } from "../../i18n/config";
import {
  LOCALIZED_SECTIONS,
  RESERVED_FIRST_SEGMENTS,
  resolveHeldSourcePage,
  resolveTableRedirect,
} from "../../lib/seo/url-table";
import { runMiddleware } from "./helpers/clerk-middleware-harness";

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));
const pathOf = (url: string) => url.split("?")[0] ?? url;

async function run(path: string): Promise<Response> {
  return runMiddleware(anonymousAuth, new NextRequest(`http://localhost${path}`));
}

describe("#417 bare section paths", () => {
  it("resolve to their English page", () => {
    for (const section of ["news", "rankings", "tools", "admin", "trending", "dashboard"]) {
      expect(resolveTableRedirect(`/${section}`), section).toBe(`/en/${section}`);
    }
    expect(resolveTableRedirect("/news/")).toBe("/en/news");
  });

  it("reach any section in one hop, never a chain", () => {
    for (const section of LOCALIZED_SECTIONS) {
      if (RESERVED_FIRST_SEGMENTS.has(section)) continue;
      const target = resolveTableRedirect(`/${section}`) ?? resolveHeldSourcePage(`/${section}`);
      expect(target, section).not.toBeNull();
      expect(resolveTableRedirect(pathOf(target as string)), section).toBeNull();
    }
    // A section whose English page is itself a table source goes straight to that row's target.
    expect(resolveTableRedirect("/contact")).toBe("/en/contact/default");
  });

  it("308 once through the middleware, on the same origin, without the query", async () => {
    const res = await run("/news?next=https://evil.example");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost/en/news");
  });

  it("send /admin on to sign-in for a signed-out user", async () => {
    const moved = await run("/admin");
    expect(moved.status).toBe(308);
    expect(moved.headers.get("location")).toBe("http://localhost/en/admin");

    const signIn = await run("/en/admin");
    expect(signIn.status).toBe(307);
    expect(new URL(signIn.headers.get("location") ?? "").pathname).toBe("/en/sign-in");
  });

  it("leave reserved, locale, root and unknown single segments alone", () => {
    const unchanged = [
      "/",
      "/api",
      "/sign-in",
      "/sign-up",
      "/design",
      "/data",
      "/_next",
      "/robots.txt",
      "/favicon.ico",
      "/%6Eews",
      "/News",
      "/foo",
      "/cursor",
      "/$",
      ...locales.map((lang) => `/${lang}`),
    ];
    for (const path of unchanged) {
      expect(resolveTableRedirect(path), path).toBeNull();
      expect(resolveHeldSourcePage(path), path).toBeNull();
    }
  });

  it("send an unknown single segment to the site 404 (no table redirect)", async () => {
    // #443: was a pass-through to the [lang] layout's notFound(), which as a root layout has no boundary above it.
    const res = await run("/foo");
    expect(res.headers.get("location")).toBeNull();
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "http://x/").pathname).toBe("/en/__not-found");
  });
});
