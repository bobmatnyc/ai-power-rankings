import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../middleware";
import { type RouteAccess, routeAccess } from "../../lib/route-access";

/**
 * Percent-encoded path classification for #228.
 *
 * Why: `routeAccess()` matched the raw pathname, which keeps percent escapes,
 * so `/en/%61dmin` classed `default` and skipped the protected branch. Only
 * Next's router refusing the encoded segment kept it from serving admin.
 * What: Classifies encoded paths and drives the real middleware handler with
 * an anonymous session. A path is protected when its raw OR once-decoded form
 * is protected; it is decoded exactly once; a malformed escape falls back to
 * the raw form without throwing. Each block names the wrong implementation it
 * rejects.
 * Test: `npx vitest run tests/unit/route-access-encoded-228.test.ts`.
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

function classify(path: string): RouteAccess {
  return routeAccess(new NextRequest(`http://localhost${path}`));
}

async function run(path: string): Promise<Response> {
  const { default: middleware } = await import("../../middleware");
  return (middleware as unknown as Handler)(anonymousAuth, new NextRequest(`http://localhost${path}`));
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

/** Encoded protected API paths: an anonymous request must get 401. */
const ENCODED_API: string[] = [
  "/api/%61dmin/x", // one encoded character
  "/api/%64ata/db-status",
  "/api/%61i/analyze-news",
  "/%61%70%69/%61%64%6d%69%6e/news", // every character of /api/admin encoded
  "/api/%61%44%6D%49%6e", // mixed-case hex, decodes to /api/aDmIn
  "/api/admin%2Fnews", // encoded slash
  "/api/admin%zz", // malformed escape; the raw form is protected
];

/** Encoded protected page paths: an anonymous request must redirect to sign-in. */
const ENCODED_PAGES: string[] = [
  "/en/%61dmin", // one encoded character
  "/en/%61dmin/news",
  "/en/%64ashboard/tools",
  "/%65%6e/%64%61%73%68%62%6f%61%72%64", // every character of /en/dashboard encoded
  "/en/%61%64%6Din", // mixed-case hex: %6D upper, %61/%64 lower
  "/en/%61%64%6din%2Fnews", // lower-case hex plus an encoded slash
  // Raw form is protected (locale segment "x%2Fy"); the decoded /x/y/admin is
  // not. Rejects an implementation that classifies only the decoded form.
  "/x%2Fy/admin",
  // Malformed escape: decoding throws, the raw form is protected.
  "/en/admin%E0%A4%A",
];

describe("#228: encoded protected paths classify as protected", () => {
  // Rejects classifying only the raw form (the pre-#228 behaviour).
  it.each([...ENCODED_API, ...ENCODED_PAGES])("classes %s as protected", (path) => {
    expect(classify(path)).toBe("protected");
  });

  it.each(ENCODED_API)("refuses anonymous GET %s with 401 after an auth lookup", async (path) => {
    const res = await run(path);
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(false);
    expect(res.status).toBe(401);
  });

  it.each(ENCODED_PAGES)("redirects anonymous GET %s to sign-in after an auth lookup", async (path) => {
    const res = await run(path);
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(false);
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location") ?? "").pathname).toMatch(/\/sign-in$/);
  });

  it.each(["/en/%61dmin", "/%61pi/admin/x", "/en/%2561dmin"])("runs the middleware for %s", (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${path}` })).toBe(true);
  });
});

describe("#228: a double-encoded path is decoded once, as Next's router does", () => {
  // `/en/%2561dmin` decodes once to `/en/%61dmin`, which names no route, so it
  // stays `default`. A recursive decoder reaches `/en/admin` and fails here.
  it.each(["/en/%2561dmin", "/api/%2561dmin/x", "/en/%2564ashboard"])("classes %s as default", (path) => {
    expect(classify(path)).toBe("default");
  });

  it("runs the auth lookup for /en/%2561dmin and never treats it as public", async () => {
    const res = await run("/en/%2561dmin");
    expect(anonymousAuth).toHaveBeenCalledTimes(1);
    expect(passedThrough(res)).toBe(true);
  });
});

describe("#228: a malformed escape never throws", () => {
  // Rejects a decoder that lets decodeURIComponent's URIError escape.
  it.each([
    ["/en/%E0%A4%A", "default"],
    ["/en/%", "default"],
    ["/en/admin%E0%A4%A", "protected"],
    ["/api/admin%zz", "protected"],
    // The whole-path decode fails, so only the raw form is classified; Next's
    // router falls back to the raw form too and resolves no admin route.
    ["/en/%61dmin%E0%A4%A", "default"],
  ] as const)("classes %s as %s without throwing", async (path, access) => {
    expect(() => classify(path)).not.toThrow();
    expect(classify(path)).toBe(access);
    await expect(run(path)).resolves.toBeInstanceOf(Response);
  });
});

describe("#228: public paths stay public; decoding never widens public access", () => {
  it.each(["/api/cron/daily-news", "/api/cron/monthly-rankings", "/api/cron/%64aily-news", "/en/news"])(
    "passes %s through without an auth lookup",
    async (path) => {
      expect(classify(path)).toBe("public");
      const res = await run(path);
      expect(passedThrough(res)).toBe(true);
      expect(anonymousAuth).not.toHaveBeenCalled();
    }
  );

  // An encoded public path is only public when its raw form is.
  it.each(["/en/%6eews", "/api/%63ron/daily-news"])("classes %s as default, not public", (path) => {
    expect(classify(path)).toBe("default");
  });

  it("keeps a raw-protected path protected when its decoded form names a public route", () => {
    expect(classify("/api/admin%2F..%2Fcron")).toBe("protected");
  });
});
