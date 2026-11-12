import { readdirSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { config } from "../../middleware";
import { needsClerk } from "../../lib/route-access";
import { clerkTestAuth, runMiddleware } from "./helpers/clerk-middleware-harness";

/**
 * #368: Clerk's middleware runs only where auth is used.
 *
 * Why: Clerk on every path made every public page a per-user response, so the
 *   edge cached none of them. Auth still has to run for admin, dashboard, the
 *   `(authenticated)` group and every API route, whose `auth()` calls need it.
 * What: A table of paths, each through the real `config.matcher`, the real
 *   `needsClerk()` and the real middleware with a counted Clerk wrapper: a
 *   Clerk path must reach the wrapper and keep its old answer (sign-in
 *   redirect, 401); a public page must pass through without it. The
 *   `(authenticated)` folders and `app/api` folders are read from disk, so a
 *   new folder that the patterns miss fails here.
 * Test: `npx vitest run tests/unit/middleware-clerk-scope-368.test.ts`.
 */

const clerkCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  const { fakeClerkMiddleware } = await import("./helpers/clerk-middleware-harness");
  return {
    ...actual,
    // Counts every request that reaches Clerk's wrapper, whether or not it calls auth().
    clerkMiddleware: (handler: Parameters<typeof fakeClerkMiddleware>[0]) => {
      const wrapped = fakeClerkMiddleware(handler);
      return (req: NextRequest) => {
        clerkCalls.count += 1;
        return wrapped(req);
      };
    },
  };
});

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));

function request(p: string): NextRequest {
  return new NextRequest(`http://localhost${p}`);
}

beforeEach(() => {
  clerkCalls.count = 0;
  anonymousAuth.mockClear();
  clerkTestAuth.current = anonymousAuth;
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** [path, runs Clerk, expected anonymous status (`next` = passes through)] */
const TABLE: Array<[string, boolean, number | "next"]> = [
  ["/api/admin/x", true, 401],
  ["/api/admin/rankings/set-current", true, 401],
  ["/api/data/db-status", true, 401],
  ["/api/ai/analyze-news", true, 401],
  ["/api/user/preferences", true, "next"], // its handler answers 401 itself
  ["/api/companies", true, "next"], // POST calls requireAdmin()
  ["/api/whats-new/summary", true, "next"], // POST calls requireAdmin()
  ["/api/rankings", true, "next"],
  ["/en/admin", true, 307],
  ["/en/admin/news/edit/42", true, 307],
  ["/de/dashboard/tools", true, 307],
  ["/en/sign-in", true, "next"],
  ["/en/sign-in/factor-one", true, "next"],
  ["/en/sign-up", true, "next"],
  ["/sign-in", true, "next"],
  ["/en/clerk-debug", true, "next"],
  ["/en/unauthorized", true, "next"],
  ["/en/%61dmin", true, 307], // #228: once-decoded admin
  ["/en/%2561dmin", true, "next"], // double-encoded: Clerk runs, nothing to protect
  ["/", false, "next"],
  ["/en", false, "next"],
  ["/de", false, "next"],
  ["/en/tools", false, "next"],
  ["/en/tools/foo", false, "next"],
  ["/en/rankings", false, "next"],
  ["/en/rankings/models", false, "next"],
  ["/en/news", false, "next"],
  ["/en/news/foo", false, "next"],
  ["/en/about", false, "next"],
  ["/en/methodology", false, "next"],
  ["/en/privacy", false, "next"],
  ["/en/terms", false, "next"],
  ["/en/trending", false, "next"],
  ["/en/best-ai-coding-tools", false, "next"],
  // #191: /en/whats-new now 308s to /en/insights (url-table-191.test.ts); the live page takes its place.
  ["/en/insights", false, "next"],
  ["/en/whats-new/2026-10", false, "next"],
];

describe("#368: which matched paths run Clerk", () => {
  it.each(TABLE)("%s: Clerk %s, anonymous answer %s", async (p, clerk, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `http://localhost${p}` }), "matcher").toBe(true);
    expect(needsClerk(request(p)), "needsClerk").toBe(clerk);

    const res = await runMiddleware(anonymousAuth, request(p));
    expect(clerkCalls.count, "Clerk wrapper calls").toBe(clerk ? 1 : 0);
    if (!clerk) expect(anonymousAuth).not.toHaveBeenCalled();
    if (expected === "next") {
      expect(res.headers.get("x-middleware-next")).toBe("1");
    } else {
      expect(res.status).toBe(expected);
    }
  });

  it("a signed-in request to a protected page passes through Clerk", async () => {
    const res = await runMiddleware(async () => ({ userId: "user_1", sessionId: "sess_1" }), request("/en/admin"));
    expect(clerkCalls.count).toBe(1);
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("#368: every auth-using folder runs Clerk", () => {
  const root = path.resolve(__dirname, "../..");
  const folders = (dir: string): string[] =>
    readdirSync(path.join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

  it.each(folders("app/[lang]/(authenticated)"))("/en/%s runs Clerk", (folder) => {
    expect(needsClerk(request(`/en/${folder}`))).toBe(true);
    expect(needsClerk(request(`/de/${folder}/nested`))).toBe(true);
  });

  it.each(folders("app/api"))("/api/%s runs Clerk", (folder) => {
    expect(needsClerk(request(`/api/${folder}`))).toBe(true);
  });

  it("the auth-disabled 403 still guards a public path in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "true");
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await runMiddleware(anonymousAuth, request("/en/rankings"));
    expect(res.status).toBe(403);
    expect(clerkCalls.count).toBe(0);
  });
});
