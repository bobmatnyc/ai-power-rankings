/**
 * #325: the middleware's anonymous `/api/admin/*` 401 is no-store.
 *
 * Why: the middleware refuses an anonymous admin API request before the route runs, so a
 *   route's own no-store wrapper never sees that response; it went out as
 *   `public, max-age=0, must-revalidate`.
 * What: runs the real middleware handler (Clerk's wrapper replaced by an identity
 *   function, as in `middleware-route-access.test.ts`) with an anonymous `auth`, and reads
 *   the response the middleware itself returns. `requireAdmin` is not involved.
 * Test: `npx vitest run tests/unit/middleware-401-no-store-325.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { runMiddleware } from "./helpers/clerk-middleware-harness";

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  // #368: the real middleware calls Clerk's wrapper only for needsClerk() paths.
  const { fakeClerkMiddleware } = await import("./helpers/clerk-middleware-harness");
  return { ...actual, clerkMiddleware: fakeClerkMiddleware };
});

async function run(path: string): Promise<Response> {
  return runMiddleware(
    async () => ({ userId: null, sessionId: null }),
    new NextRequest(`http://localhost${path}`)
  );
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware 401 for anonymous admin API requests", () => {
  // #393: the spend route sits under the same protected prefix.
  it.each([
    "/api/admin/crawl-monitor/overview",
    "/api/admin/crawl-monitor/runs",
    "/api/admin/crawl-monitor/spend",
    // #394: so does the balance cross-check route.
    "/api/admin/crawl-monitor/balances",
    "/api/admin/automated-ingestion",
  ])(
    "%s answers 401 with Cache-Control: no-store",
    async (path) => {
      const res = await run(path);
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toMatchObject({ code: "AUTH_REQUIRED" });
    }
  );
});
