import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fail-closed behaviour of `requireAdmin()` / `requireAuth()` when Clerk is
 * not configured.
 *
 * Why: Missing Clerk keys used to mean "auth disabled", so a production or
 * preview deployment without keys returned a mock admin to every caller.
 * What: With the keys unset in a production-like environment (NODE_ENV
 * production, or VERCEL_ENV production/preview), both helpers return a 503
 * error and no user, and Clerk is never consulted. In a plain local
 * development environment the mock identities remain, with a warning.
 * Test: `npx vitest run tests/unit/api-auth-fail-closed.test.ts`.
 */

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => clerk);

import { optionalAuth, requireAdmin, requireAuth } from "../../lib/api-auth";

// Only development/test with VERCEL_ENV unset or "development" may bypass;
// every other combination is treated as production.
const PRODUCTION_LIKE: Array<[string, Record<string, string>]> = [
  ["NODE_ENV=production", { NODE_ENV: "production", VERCEL_ENV: "" }],
  ["NODE_ENV=staging", { NODE_ENV: "staging", VERCEL_ENV: "" }],
  ["NODE_ENV unset", { NODE_ENV: "", VERCEL_ENV: "" }],
  ["NODE_ENV=test, VERCEL_ENV=staging", { NODE_ENV: "test", VERCEL_ENV: "staging" }],
  ["VERCEL_ENV=production", { NODE_ENV: "development", VERCEL_ENV: "production" }],
  ["VERCEL_ENV=preview", { NODE_ENV: "development", VERCEL_ENV: "preview" }],
];

const MISSING_KEYS: Array<[string, Record<string, string>]> = [
  ["both keys unset", { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "" }],
  ["secret key unset", { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_stub", CLERK_SECRET_KEY: "" }],
  ["publishable key unset", { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "sk_test_stub" }],
];

function stubAll(env: Record<string, string>) {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}

const CASES = PRODUCTION_LIKE.flatMap(([envName, env]) =>
  MISSING_KEYS.map(([keysName, keys]) => [`${envName}, ${keysName}`, { ...env, ...keys }] as const)
);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("requireAdmin fails closed without Clerk keys in production-like environments", () => {
  it.each(CASES)("%s → 503, no user", async (_name, env) => {
    stubAll(env);
    const result = await requireAdmin();
    expect(result.error?.status).toBe(503);
    expect(result).not.toHaveProperty("user");
    expect(result).not.toHaveProperty("userId");
    expect(clerk.auth).not.toHaveBeenCalled();
    expect(clerk.currentUser).not.toHaveBeenCalled();
  });

  it("ignores NEXT_PUBLIC_DISABLE_AUTH in production and checks the Clerk session", async () => {
    stubAll({
      NODE_ENV: "production",
      NEXT_PUBLIC_DISABLE_AUTH: "true",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_stub",
      CLERK_SECRET_KEY: "sk_test_stub",
    });
    clerk.auth.mockResolvedValue({ userId: null });
    const result = await requireAdmin();
    expect(result.error?.status).toBe(401);
    expect(clerk.auth).toHaveBeenCalledTimes(1);
  });
});

describe("requireAuth fails closed without Clerk keys in production-like environments", () => {
  it.each(CASES)("%s → 503, no userId", async (_name, env) => {
    stubAll(env);
    const result = await requireAuth();
    expect(result.error?.status).toBe(503);
    expect(result).not.toHaveProperty("userId");
    expect(clerk.auth).not.toHaveBeenCalled();
  });

  it("optionalAuth reports no user", async () => {
    stubAll({ NODE_ENV: "production", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "" });
    expect(await optionalAuth()).toEqual({ userId: null, error: null });
  });
});

describe("local development keeps the bypass", () => {
  it("returns the mock admin when Clerk keys are unset outside production", async () => {
    stubAll({
      NODE_ENV: "development",
      VERCEL_ENV: "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
    });
    const result = await requireAdmin();
    expect(result.error).toBeNull();
    expect(result.userId).toBe("mock-admin-id");
    expect(clerk.auth).not.toHaveBeenCalled();
    // First bypass in this module instance, so the one-time warning fires here.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("bypassed for local development"));
  });

  it.each([
    ["NODE_ENV=test", { NODE_ENV: "test", VERCEL_ENV: "" }],
    ["NODE_ENV=development, VERCEL_ENV=development", { NODE_ENV: "development", VERCEL_ENV: "development" }],
  ])("keeps the bypass for %s", async (_name, env) => {
    stubAll({ ...env, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "", CLERK_SECRET_KEY: "" });
    const result = await requireAdmin();
    expect(result.error).toBeNull();
    expect(result.userId).toBe("mock-admin-id");
  });
});
