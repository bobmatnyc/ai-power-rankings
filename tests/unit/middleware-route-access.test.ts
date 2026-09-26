import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../middleware";

/**
 * Route-access tests for `middleware.ts`.
 *
 * Why: Unanchored public patterns such as `/(.*)/tools(.*)` were evaluated
 * before the protected list, so admin API paths and dashboard pages skipped
 * authentication. The handler tests alone cannot show the middleware runs at
 * all for a path; that is decided by `config.matcher`.
 * What: Checks the real exported `config.matcher` with Next's
 * `unstable_doesMiddlewareMatch`, then runs the real middleware handler
 * (Clerk's wrapper is replaced by an identity function; `createRouteMatcher`
 * is Clerk's own) against an anonymous session. Protected paths must call
 * `auth()` and be refused (401 for API, redirect to sign-in for pages). Public
 * paths must pass through without an auth lookup.
 * Test: `npx vitest run tests/unit/middleware-route-access.test.ts`.
 */

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return {
    ...actual,
    // Expose the inner handler so the test can drive it with a fake `auth`.
    clerkMiddleware: (handler: unknown) => handler,
  };
});

type Handler = (
  auth: () => Promise<{ userId: string | null; sessionId: string | null }>,
  req: NextRequest
) => Promise<Response>;

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));

async function run(path: string, method = "GET"): Promise<Response> {
  const { default: middleware } = await import("../../middleware");
  return (middleware as unknown as Handler)(
    anonymousAuth,
    new NextRequest(`http://localhost${path}`, { method })
  );
}

function passedThrough(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

beforeEach(() => {
  anonymousAuth.mockClear();
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware: config.matcher decides which paths run the middleware", () => {
  it.each([
    "/api/admin/tools/scoring",
    "/api/admin/tools/scoring.json",
    "/api/admin/x.png",
    "/api/admin",
    "/API/admin/tools/scoring",
    "/en/sign-in/factor-one",
    "/en/admin/news",
    "/en/dashboard/tools",
    "/api/data/db-status",
    "/api/ai/analyze-news",
  ])("runs the middleware for %s", (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` })).toBe(true);
  });

  // Shows the matcher check can fail: static assets and Next internals skip it.
  it.each(["/logo.png", "/favicon.ico", "/_next/static/chunks/main.js"])(
    "skips the middleware for %s",
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` })).toBe(false);
    }
  );
});

describe("middleware: protected routes win over public patterns", () => {
  it.each([
    ["GET", "/api/admin/tools/scoring"],
    ["POST", "/api/admin/tools/scoring"],
    ["PUT", "/api/admin/tools/scoring"],
    ["POST", "/api/admin/tools/scoring/recalculate"],
    ["GET", "/api/admin/news"],
    ["GET", "/api/admin/rankings/versions"],
    ["GET", "/api/admin/tools/scoring.json"],
    ["GET", "/api/admin/x.png"],
    ["GET", "/api/admin"],
    ["GET", "/API/admin/tools/scoring"],
  ])("refuses anonymous %s %s with 401", async (method, path) => {
    const res = await run(path, method);
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(false);
    expect(res.status).toBe(401);
  });

  it.each([
    "/en/dashboard/tools",
    "/xx/dashboard/rankings",
    "/en/dashboard/news-ingestion",
    "/en/admin/news",
  ])("redirects anonymous page request %s to sign-in", async (path) => {
    const res = await run(path);
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(false);
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toMatch(/\/sign-in$/);
    expect(location.searchParams.get("redirect_url")).toBe(path);
  });
});

describe("middleware: public pages and APIs stay anonymous", () => {
  it.each([
    "/",
    "/en/tools",
    "/de/tools/cursor",
    "/en/rankings",
    "/en/news",
    "/en/news/some-article",
    "/en/news/rss.xml",
    "/ja/about",
    "/en/methodology",
    "/en/trending",
    "/en/privacy",
    "/en/terms",
    "/en/contact",
    "/en/sign-in",
    "/en/sign-up",
    "/en/sign-in/factor-one",
    "/sign-in",
    "/api/news",
    "/api/news/recent",
    "/api/rankings",
    "/api/rankings/current",
    "/api/tools",
    "/api/tools/cursor/json",
    "/api/whats-new/summary",
    "/api/og",
    "/api/health",
    "/api/public/health-check",
    "/api/cron/daily-news",
  ])("passes %s through without an auth lookup", async (path) => {
    const res = await run(path);
    expect(passedThrough(res)).toBe(true);
    expect(anonymousAuth).not.toHaveBeenCalled();
  });

  it.each([
    "/en",
    "/en/whats-new",
    "/sitemap.xml",
    "/robots.txt",
    "/api/companies",
    "/api/state-of-ai/current",
  ])(
    "lets unlisted, unprotected path %s through for anonymous visitors",
    async (path) => {
      const res = await run(path);
      expect(passedThrough(res)).toBe(true);
    }
  );
});

describe("route-access: public patterns are anchored", () => {
  it.each([
    "/api/admin/tools/scoring",
    "/api/admin/tools/scoring/recalculate",
    "/api/admin/news",
    "/api/admin/rankings",
    "/en/dashboard/tools",
    "/xx/dashboard/rankings",
    "/en/admin/news",
    "/api/admin/sign-in",
    "/api/admin",
    "/api/admin/x.png",
    "/API/admin/tools/scoring",
  ])("no public pattern matches %s", async (path) => {
    const { isPublicRoute, routeAccess } = await import("../../lib/route-access");
    const req = new NextRequest(`http://localhost${path}`);
    expect(isPublicRoute(req)).toBe(false);
    expect(routeAccess(req)).toBe("protected");
  });
});
