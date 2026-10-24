import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../middleware";
import { PROTECTED_ROUTE_PATTERNS } from "../../lib/route-access";

/**
 * Middleware coverage of the admin and dashboard page trees.
 *
 * Why: Every path under the admin and dashboard trees must reach the
 * middleware; this pins that through the real `config.matcher`.
 * What: Runs each path through the real `config.matcher`
 * (`unstable_doesMiddlewareMatch`) and, when it matches, the real middleware
 * handler with a signed-out session. Each path form must get the same
 * sign-in redirect as the route's base path. Controls: static assets stay
 * unmatched and `/en/rankings` stays public.
 * Test: `npx vitest run tests/unit/middleware-matcher-protected-trees.test.ts`.
 */

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return { ...actual, clerkMiddleware: (handler: unknown) => handler };
});

type Handler = (
  auth: () => Promise<{ userId: string | null; sessionId: string | null }>,
  req: NextRequest
) => Promise<Response>;

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));

/**
 * What Next does with a request: `null` when the matcher does not match,
 * else the middleware's response.
 */
async function dispatch(path: string): Promise<Response | null> {
  const url = `http://localhost${path}`;
  if (!unstable_doesMiddlewareMatch({ config, url })) return null;
  const { default: middleware } = await import("../../middleware");
  return (middleware as unknown as Handler)(anonymousAuth, new NextRequest(url));
}

const SUFFIXES = [".png", ".css", ".js", ".PNG"];

/** Dynamic page routes; `{s}` takes each `SUFFIXES` entry. */
const DYNAMIC_ROUTES: Array<[string, string]> = [
  ["admin news edit [id]", "/en/admin/news/edit/42{s}"],
  ["dashboard tools [slug]", "/en/dashboard/tools/some-tool{s}"],
  ["dashboard rankings [period] changes", "/en/dashboard/rankings/2025-06{s}/changes"],
  ["admin news edit [id] (de)", "/de/admin/news/edit/42{s}"],
];

beforeEach(() => {
  anonymousAuth.mockClear();
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("every path under the admin and dashboard trees", () => {
  it.each(DYNAMIC_ROUTES)("redirects a signed-out request for each path form of %s", async (_name, template) => {
    const base = await dispatch(template.replace("{s}", ""));
    expect(base?.status).toBe(307);
    const baseTarget = new URL(base?.headers.get("location") ?? "").pathname;

    for (const suffix of SUFFIXES) {
      const path = template.replace("{s}", suffix);
      const res = await dispatch(path);
      expect(res, `no sign-in redirect for ${path}`).not.toBeNull();
      expect(res?.status, path).toBe(307);
      const location = new URL(res?.headers.get("location") ?? "");
      expect(location.pathname, path).toBe(baseTarget);
      expect(location.searchParams.get("redirect_url"), path).toBe(path);
    }
  });

  it.each(["/en/admin.png", "/en/dashboard.css", "/fr/dashboard/x.js"])(
    "runs the middleware for %s",
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` })).toBe(true);
    }
  );

  it("has a matcher entry for each protected page pattern", () => {
    const pagePatterns = PROTECTED_ROUTE_PATTERNS.filter((p) => p.startsWith("/:locale/"));
    expect(pagePatterns.length).toBeGreaterThan(0);
    for (const pattern of pagePatterns) expect(config.matcher).toContain(pattern);
  });
});

describe("controls", () => {
  it.each([
    "/_next/static/chunks/main.js",
    "/_next/static/css/app.css",
    "/favicon.ico",
    "/crown-of-technology.png",
    "/tool-icons/cursor.png",
    "/fonts/inter.woff2",
  ])("does not run the middleware for static asset %s", (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` })).toBe(false);
  });

  it("serves /en/rankings to a signed-out request without an auth lookup", async () => {
    const res = await dispatch("/en/rankings");
    expect(res?.headers.get("x-middleware-next")).toBe("1");
    expect(anonymousAuth).not.toHaveBeenCalled();
  });
});
