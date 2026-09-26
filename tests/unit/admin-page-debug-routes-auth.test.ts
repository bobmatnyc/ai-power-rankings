import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin checks on the admin dashboard page and the `/api/admin` debug routes.
 *
 * Why: The admin page trusted `lib/auth-helper.ts`, which returned a mock
 * admin whenever `NEXT_PUBLIC_DISABLE_AUTH` was set, with no environment
 * check. The debug routes return 404 only when NODE_ENV is production;
 * elsewhere any signed-in user could read their configuration metadata.
 * What: The page goes through `requireAdmin()`: anonymous → sign-in
 * redirect, non-admin → unauthorized redirect, and the flag no longer
 * bypasses it in production. Each debug route keeps its production 404 and
 * otherwise answers 401 anonymous / 403 non-admin without touching the
 * database or reading configuration.
 * Test: `npx vitest run tests/unit/admin-page-debug-routes-auth.test.ts`.
 * No database access, no network.
 */

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
const touched = vi.hoisted(() => ({
  getDb: vi.fn(() => null),
  testConnection: vi.fn(async () => false),
  articlesRepository: vi.fn(),
  neon: vi.fn(),
}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../../components/admin/unified-admin-dashboard", () => ({
  default: () => null,
}));
vi.mock("../../lib/db/connection", () => ({
  getDb: touched.getDb,
  testConnection: touched.testConnection,
}));
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  ArticlesRepository: class {
    constructor() {
      touched.articlesRepository();
    }
  },
}));
vi.mock("@neondatabase/serverless", () => ({ neon: touched.neon }));

import AdminPage from "../../app/[lang]/(authenticated)/admin/page";
import * as bypassTest from "../../app/api/admin/bypass-test/route";
import * as dbTest from "../../app/api/admin/db-test/route";
import * as debugAuth from "../../app/api/admin/debug-auth/route";
import * as runtimeFixTest from "../../app/api/admin/runtime-fix-test/route";
import * as testAuth from "../../app/api/admin/test-auth/route";

const ANONYMOUS = [{ userId: null }, null] as const;
const NON_ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: {} }] as const;
const ADMIN = [{ userId: "user_1" }, { id: "user_1", privateMetadata: { isAdmin: true } }] as const;

function signIn([session, user]: readonly [unknown, unknown]) {
  clerk.auth.mockResolvedValue(session);
  clerk.currentUser.mockResolvedValue(user);
}

function touchedCount(): number {
  return Object.values(touched).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

async function renderAdminPage(): Promise<string | null> {
  try {
    await AdminPage({ params: Promise.resolve({ lang: "en" }) });
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("REDIRECT:")) return message.slice("REDIRECT:".length);
    throw error;
  }
}

const DEBUG_ROUTES: Array<[string, () => Promise<Response>]> = [
  ["GET /api/admin/debug-auth", () => debugAuth.GET()],
  ["GET /api/admin/test-auth", () => testAuth.GET()],
  [
    "GET /api/admin/runtime-fix-test",
    () => runtimeFixTest.GET(new NextRequest("http://localhost/api/admin/runtime-fix-test")),
  ],
  ["GET /api/admin/db-test", () => dbTest.GET()],
  [
    "GET /api/admin/bypass-test?mode=public",
    () => bypassTest.GET(new NextRequest("http://localhost/api/admin/bypass-test?mode=public")),
  ],
  [
    "POST /api/admin/bypass-test",
    () =>
      bypassTest.POST(
        new NextRequest("http://localhost/api/admin/bypass-test", { method: "POST", body: "{}" })
      ),
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  // Runtime-only stub keys so the real Clerk check runs; never real keys.
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_stub");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_stub");
  vi.stubEnv("DATABASE_URL", "postgresql://u:pw@db.example.test/stubdb");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("admin dashboard page requires an admin", () => {
  it("redirects an anonymous visitor to sign-in", async () => {
    signIn(ANONYMOUS);
    expect(await renderAdminPage()).toBe("/en/sign-in");
  });

  it("redirects a signed-in non-admin to the unauthorized page", async () => {
    signIn(NON_ADMIN);
    expect(await renderAdminPage()).toBe("/en/unauthorized");
  });

  it("ignores NEXT_PUBLIC_DISABLE_AUTH in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "true");
    signIn(ANONYMOUS);
    // Re-import so any module that reads the flag at load time sees it.
    vi.resetModules();
    const { default: FreshAdminPage } = await import("../../app/[lang]/(authenticated)/admin/page");
    await expect(FreshAdminPage({ params: Promise.resolve({ lang: "en" }) })).rejects.toThrow(
      "REDIRECT:/en/sign-in"
    );
  });

  it("renders the dashboard for an admin", async () => {
    signIn(ADMIN);
    expect(await renderAdminPage()).toBeNull();
  });
});

describe("admin debug routes require an admin outside production", () => {
  it.each(DEBUG_ROUTES)("%s returns 401 for an anonymous caller", async (_name, call) => {
    signIn(ANONYMOUS);
    const res = await call();
    expect(res.status).toBe(401);
    expect(touchedCount()).toBe(0);
  });

  it.each(DEBUG_ROUTES)("%s returns 403 for a signed-in non-admin", async (_name, call) => {
    signIn(NON_ADMIN);
    const res = await call();
    expect(res.status).toBe(403);
    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/KeyLength|KEY_LENGTH|URL_LENGTH/i);
    expect(touchedCount()).toBe(0);
  });

  it.each(DEBUG_ROUTES)("%s keeps its 404 in production", async (_name, call) => {
    vi.stubEnv("NODE_ENV", "production");
    signIn(ADMIN);
    const res = await call();
    expect(res.status).toBe(404);
    expect(clerk.auth).not.toHaveBeenCalled();
  });
});
