/**
 * Auth-gate coverage for GET /api/cron/daily-news (issue #134).
 *
 * Why: `app/api/cron/` had no tests at all, yet its bearer check is the only thing standing
 * between the public internet and a full ingestion run — and a silent 401 there is
 * indistinguishable, from the database's point of view, from a cron that never fired. The
 * #134 investigation could not rule out either. These tests pin two properties the route
 * must keep: an unauthorized request costs nothing (the ingestion service is never even
 * constructed, so no API spend and no run row), and an unset or empty `CRON_SECRET` never
 * degrades into "any empty bearer is fine".
 *
 * What: Drives the real GET handler with mocked `AutomatedIngestionService` and
 * `invalidateArticleCache` modules. The service mock records every construction, which is
 * what makes "auth is checked before the service is built" an assertable ordering fact
 * rather than a code-reading claim.
 *
 * Test: `npx vitest run tests/unit/cron-daily-news-auth.test.ts`, or the whole suite via
 * `npm run test:unit`. No network, no database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  /** Called once per `new AutomatedIngestionService()` — the ordering probe. */
  constructed: vi.fn(),
  runDailyDiscovery: vi.fn(),
}));

vi.mock("../../lib/services/automated-ingestion.service", () => ({
  AutomatedIngestionService: class {
    runDailyDiscovery = mocks.runDailyDiscovery;

    constructor() {
      mocks.constructed();
    }
  },
}));

vi.mock("../../lib/cache/invalidation.service", () => ({
  invalidateArticleCache: vi.fn(async () => ({
    pathsRevalidated: [],
    tagsRevalidated: [],
    memoryCacheCleared: [],
    success: true,
  })),
}));

import { GET } from "../../app/api/cron/daily-news/route";

const SECRET = "cron-secret-fixture-value";

const originalCronSecret = process.env["CRON_SECRET"];
const originalWebhookUrl = process.env["ALERT_WEBHOOK_URL"];

/** Restore an env var to its pre-test value, deleting it when it was previously unset. */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function cronRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set("authorization", authHeader);
  }
  return new Request("https://aipowerranking.com/api/cron/daily-news", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/daily-news — cron auth gate", () => {
  beforeEach(() => {
    mocks.constructed.mockClear();
    mocks.runDailyDiscovery.mockReset();
    process.env["CRON_SECRET"] = SECRET;
    // sendCronAlert() no-ops without this, keeping the 401 paths network-free.
    delete process.env["ALERT_WEBHOOK_URL"];
  });

  afterEach(() => {
    restoreEnv("CRON_SECRET", originalCronSecret);
    restoreEnv("ALERT_WEBHOOK_URL", originalWebhookUrl);
  });

  it("returns 401 and never constructs the ingestion service when the Authorization header is missing", async () => {
    const response = await GET(cronRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Unauthorized",
    });
    expect(mocks.constructed).not.toHaveBeenCalled();
    expect(mocks.runDailyDiscovery).not.toHaveBeenCalled();
  });

  it("returns 401 and never constructs the ingestion service for a wrong bearer token", async () => {
    const response = await GET(cronRequest("Bearer not-the-cron-secret"));

    expect(response.status).toBe(401);
    expect(mocks.constructed).not.toHaveBeenCalled();
    expect(mocks.runDailyDiscovery).not.toHaveBeenCalled();
  });

  // Drop the `if (!cronSecret) return false` guard and the comparison becomes
  // `authHeader === "Bearer undefined"` — which the second case below then authorizes. The
  // "Bearer " cases stay as boundary coverage; note the Headers constructor trims header
  // values, so they reach the route as "Bearer".
  it.each([
    { label: "unset", secret: undefined, header: "Bearer " },
    { label: "unset", secret: undefined, header: "Bearer undefined" },
    { label: "empty", secret: "", header: "Bearer " },
  ])("returns 401 for '$header' when CRON_SECRET is $label", async ({ secret, header }) => {
    restoreEnv("CRON_SECRET", secret);

    const response = await GET(cronRequest(header));

    expect(response.status).toBe(401);
    expect(mocks.constructed).not.toHaveBeenCalled();
  });

  it("proceeds to the ingestion service for the correct bearer token", async () => {
    mocks.runDailyDiscovery.mockResolvedValue({
      runId: "run-1",
      status: "completed",
      articlesDiscovered: 4,
      articlesPassedQuality: 2,
      articlesIngested: 0,
      articlesSkipped: 4,
      rankingChanges: 0,
      estimatedCostUsd: 0,
      errors: [],
      ingestedArticleIds: [],
      durationMs: 12,
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(mocks.constructed).toHaveBeenCalledTimes(1);
    expect(mocks.runDailyDiscovery).toHaveBeenCalledTimes(1);

    const payload = (await response.json()) as {
      success: boolean;
      data: { runId: string; status: string };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.runId).toBe("run-1");
  });
});
