import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { type RouteAccess, routeAccess } from "../../lib/route-access";
import { runMiddleware } from "./helpers/clerk-middleware-harness";

/**
 * #386: route access fails closed when Clerk's matcher reports a malformed URL.
 *
 * Why: From `@clerk/shared` 3.48 (`@clerk/nextjs` 6.39) the route matcher
 * decodes the path itself and throws `MalformedURLError` when it cannot.
 * `routeAccess()` must class such a path as protected, never public or default.
 * What: Wraps the real Clerk matchers so that any path still carrying a `%`
 * throws `MalformedURLError`, then classifies paths and drives the real
 * middleware handler with an anonymous session. Rejects code that lets the
 * error escape (the pre-#386 code) and code that catches it as "no match".
 * Test: `npx vitest run tests/unit/route-access-malformed-386.test.ts`.
 */

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  type Matcher = ReturnType<typeof actual.createRouteMatcher>;
  // #368: the real middleware calls Clerk's wrapper only for needsClerk() paths.
  const { fakeClerkMiddleware } = await import("./helpers/clerk-middleware-harness");
  return {
    ...actual,
    clerkMiddleware: fakeClerkMiddleware,
    createRouteMatcher: (...args: Parameters<typeof actual.createRouteMatcher>): Matcher => {
      const real = actual.createRouteMatcher(...args);
      return (req) => {
        const pathname = req.nextUrl.pathname;
        if (pathname.includes("boom")) throw new TypeError("unrelated matcher failure");
        if (pathname.includes("%")) {
          const err = new Error(`Malformed encoding in URL path: ${pathname}`);
          err.name = "MalformedURLError";
          throw err;
        }
        return real(req);
      };
    },
  };
});

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));

function classify(path: string): RouteAccess {
  return routeAccess(new NextRequest(`http://localhost${path}`));
}

async function run(path: string): Promise<Response> {
  return runMiddleware(anonymousAuth, new NextRequest(`http://localhost${path}`));
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

describe("#386: a MalformedURLError from the matcher fails closed", () => {
  // `/en/%6eews` and `/en/rank%69ngs` name public pages once decoded; a
  // malformed-URL report must still not make them public.
  const PAGES = ["/en/%E0%A4%A", "/en/admin%E0%A4%A", "/en/%6eews", "/en/rank%69ngs"];
  const APIS = ["/api/%E0%A4%A", "/api/admin%zz", "/api/%63ron/daily-news"];

  it.each([...PAGES, ...APIS])("classes %s as protected without throwing", (path) => {
    expect(() => classify(path)).not.toThrow();
    expect(classify(path)).toBe("protected");
  });

  it.each(PAGES)("redirects anonymous GET %s to sign-in", async (path) => {
    const res = await run(path);
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(false);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toMatch(/\/sign-in$/);
  });

  it.each(APIS)("refuses anonymous GET %s with 401", async (path) => {
    const res = await run(path);
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(false);
    expect(res.status).toBe(401);
  });

  it("still serves a well-formed public path without an auth lookup", async () => {
    expect(classify("/en/rankings")).toBe("public");
    const res = await run("/en/rankings");
    expect(passedThrough(res)).toBe(true);
    expect(anonymousAuth).not.toHaveBeenCalled();
  });

  it("propagates any other matcher error", () => {
    expect(() => classify("/en/boom")).toThrow(TypeError);
  });
});
