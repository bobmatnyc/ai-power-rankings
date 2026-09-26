import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin authentication on the tool-scoring API.
 *
 * Why: `/api/admin/tools/scoring` (GET/POST/PUT) and
 * `/api/admin/tools/scoring/recalculate` (POST) read and rewrite production
 * tool scores but had no handler-level auth, so they relied on the middleware
 * alone.
 * What: Calls each handler through the real `requireAdmin()` with Clerk's
 * `auth`/`currentUser` replaced. Anonymous → 401, signed-in non-admin → 403,
 * and in both cases neither the database handle nor the scoring service is
 * touched. The admin case proves the service mock does record calls.
 * Test: `npx vitest run tests/unit/admin-tool-scoring-auth.test.ts`. No
 * database access, no network.
 */

const clerk = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

const scoring = vi.hoisted(() => ({
  getToolsWithScores: vi.fn(async () => []),
  updateBaselineScore: vi.fn(async () => undefined),
  updateDeltaScore: vi.fn(async () => undefined),
  getToolScoring: vi.fn(async () => ({})),
  initializeBaselinesFromCurrent: vi.fn(async () => undefined),
  recalculateAllScores: vi.fn(async () => undefined),
}));

const db = vi.hoisted(() => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("../../lib/db/connection", () => db);
vi.mock("../../lib/services/tool-scoring.service", () => ({ toolScoringService: scoring }));

import * as scoringRoute from "../../app/api/admin/tools/scoring/route";
import * as recalculateRoute from "../../app/api/admin/tools/scoring/recalculate/route";

type Caller = "anonymous" | "non-admin" | "admin";

function signInAs(caller: Caller): void {
  if (caller === "anonymous") {
    clerk.auth.mockResolvedValue({ userId: null });
    clerk.currentUser.mockResolvedValue(null);
    return;
  }
  clerk.auth.mockResolvedValue({ userId: "user_1" });
  clerk.currentUser.mockResolvedValue({
    id: "user_1",
    privateMetadata: { isAdmin: caller === "admin" },
  });
}

function jsonRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/tools/scoring", {
    method: "POST",
    body: JSON.stringify({ toolId: "tool-1", baseline_score: { overall: 99 } }),
    headers: { "content-type": "application/json" },
  });
}

const HANDLERS: Array<[string, () => Promise<Response>]> = [
  ["GET /api/admin/tools/scoring", () => scoringRoute.GET()],
  ["POST /api/admin/tools/scoring", () => scoringRoute.POST(jsonRequest())],
  ["PUT /api/admin/tools/scoring", () => scoringRoute.PUT()],
  ["POST /api/admin/tools/scoring/recalculate", () => recalculateRoute.POST()],
];

function dataLayerCalls(): number {
  return (
    db.getDb.mock.calls.length +
    Object.values(scoring).reduce((n, fn) => n + fn.mock.calls.length, 0)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // requireAdmin() treats missing Clerk keys as "auth disabled"; stub them so
  // the real check runs. Runtime-only values, never real keys.
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_stub");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_stub");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin tool-scoring API requires an admin", () => {
  it.each(HANDLERS)("%s returns 401 for an anonymous caller", async (_name, call) => {
    signInAs("anonymous");
    const res = await call();
    expect(res.status).toBe(401);
    expect(dataLayerCalls()).toBe(0);
  });

  it.each(HANDLERS)("%s returns 403 for a signed-in non-admin", async (_name, call) => {
    signInAs("non-admin");
    const res = await call();
    expect(res.status).toBe(403);
    expect(dataLayerCalls()).toBe(0);
  });

  it.each(HANDLERS)("%s reaches the scoring service for an admin", async (_name, call) => {
    signInAs("admin");
    const res = await call();
    expect(res.status).toBe(200);
    expect(dataLayerCalls()).toBeGreaterThan(0);
  });
});
