import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin authentication on the data, summary-regeneration and news-analysis
 * endpoints.
 *
 * Why: `/api/data/*` accepted any request carrying a session cookie of any
 * value, the what's-new summary POST accepted any signed-in user (and anyone
 * outside NODE_ENV=production), and `/api/ai/analyze-news` had no check, so
 * anonymous callers could start LLM calls.
 * What: Calls each handler through the real `requireAdmin()` with Clerk's
 * `auth`/`currentUser` replaced. Anonymous (with or without a forged session
 * cookie) → 401, signed-in non-admin → 403, and neither reaches the database,
 * the summary service or the LLM `fetch`. The public summary GET still serves
 * anonymous visitors without an auth lookup.
 * Test: `npx vitest run tests/unit/auth-hardening.test.ts`. No database
 * access, no network.
 */

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));

const touched = vi.hoisted(() => ({
  getDb: vi.fn(() => ({})),
  testConnection: vi.fn(async () => true),
  summaryService: vi.fn(),
  getCachedSummary: vi.fn(),
  getLatestSummary: vi.fn(),
  generateMonthlySummary: vi.fn(),
  llmFetch: vi.fn(),
}));

// A session cookie whose value is not a valid Clerk token.
const forgedCookies = vi.hoisted(() => ({
  get: (name: string) =>
    name === "__session" || name === "__clerk_session" ? { name, value: "anything" } : undefined,
}));

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("next/headers", () => ({
  cookies: async () => forgedCookies,
  headers: async () => new Headers(),
}));
vi.mock("../../lib/db/connection", () => ({
  getDb: touched.getDb,
  testConnection: touched.testConnection,
}));
vi.mock("../../lib/services/whats-new-summary.service", () => ({
  WhatsNewSummaryService: class {
    constructor() {
      touched.summaryService();
    }
    getCachedSummary = touched.getCachedSummary;
    getLatestSummary = touched.getLatestSummary;
    generateMonthlySummary = touched.generateMonthlySummary;
  },
}));

import * as dataArticles from "../../app/api/data/articles/route";
import * as dataDbStatus from "../../app/api/data/db-status/route";
import * as whatsNewSummary from "../../app/api/whats-new/summary/route";
import * as analyzeNews from "../../app/api/ai/analyze-news/route";

function jsonReq(path: string, method: string, payload: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json", cookie: "__session=anything" },
  });
}

const article = {
  title: "t",
  content: "c",
  published_date: "2026-01-01",
  source: "s",
};

const HANDLERS: Array<[string, () => Promise<Response>]> = [
  ["GET /api/data/db-status", () => dataDbStatus.GET()],
  ["GET /api/data/articles", () => dataArticles.GET()],
  [
    "POST /api/whats-new/summary",
    () => whatsNewSummary.POST(jsonReq("/api/whats-new/summary", "POST", { period: "2026-01" })),
  ],
  [
    "POST /api/ai/analyze-news",
    () => analyzeNews.POST(jsonReq("/api/ai/analyze-news", "POST", { article, toolName: "x" })),
  ],
];

function touchedCount(): number {
  return Object.values(touched).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

/** Body fields that describe the database or return data; none may reach a refused caller. */
const LEAK_FIELDS = ["database", "maskedHost", "connectionError", "provider", "articles", "summary"];

beforeEach(() => {
  vi.clearAllMocks();
  // Stub Clerk keys so the real check runs. Runtime-only values, never real keys.
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_stub");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_stub");
  vi.stubEnv("OPENAI_API_KEY", "sk-stub");
  vi.stubEnv("DATABASE_URL", "postgresql://user:pw@db.example.test:5432/stubdb");
  vi.stubGlobal("fetch", touched.llmFetch);
  touched.llmFetch.mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("data, summary and analysis endpoints require an admin", () => {
  it.each(HANDLERS)(
    "%s returns 401 for an anonymous caller carrying a forged session cookie",
    async (_name, call) => {
      clerk.auth.mockResolvedValue({ userId: null });
      clerk.currentUser.mockResolvedValue(null);
      const res = await call();
      expect(res.status).toBe(401);
      const body = await res.json();
      for (const field of LEAK_FIELDS) expect(body).not.toHaveProperty(field);
      expect(touchedCount()).toBe(0);
    }
  );

  it.each(HANDLERS)("%s returns 403 for a signed-in non-admin", async (_name, call) => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ id: "user_1", privateMetadata: {} });
    const res = await call();
    expect(res.status).toBe(403);
    const body = await res.json();
    for (const field of LEAK_FIELDS) expect(body).not.toHaveProperty(field);
    expect(touchedCount()).toBe(0);
  });

  // Shows the "not touched" assertions above can fail: an admin does reach
  // the mocked database, summary service and LLM layer through the same handlers.
  it.each(HANDLERS.filter(([name]) => !name.includes("/api/data/articles")))(
    "%s reaches its data or LLM layer for an admin",
    async (_name, call) => {
      clerk.auth.mockResolvedValue({ userId: "user_1" });
      clerk.currentUser.mockResolvedValue({ id: "user_1", privateMetadata: { isAdmin: true } });
      touched.generateMonthlySummary.mockResolvedValue({
        summary: { period: "2026-01", content: "", generatedAt: new Date(), metadata: {} },
        generationTimeMs: 1,
      });
      await call();
      expect(touchedCount()).toBeGreaterThan(0);
    }
  );
});

describe("data db-status masks the database host for an admin", () => {
  it("returns a short first-label prefix, never the full hostname", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://u:pw@ep-quiet-lake-123456.us-east-2.aws.neon.tech/stubdb");
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ id: "user_1", privateMetadata: { isAdmin: true } });
    const res = await dataDbStatus.GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.maskedHost).toBe("ep-qui***");
    expect(JSON.stringify(body)).not.toContain("quiet-lake-123456");
    expect(JSON.stringify(body)).not.toContain("us-east-2");
  });
});

describe("what's-new summary GET stays public", () => {
  it("serves a cached summary to an anonymous visitor without an auth lookup", async () => {
    touched.getCachedSummary.mockResolvedValue({
      period: "2026-01",
      content: "cached",
      generatedAt: new Date("2026-01-31T00:00:00Z"),
      metadata: {},
    });
    const res = await whatsNewSummary.GET(new NextRequest("http://localhost/api/whats-new/summary"));
    expect(res.status).toBe(200);
    expect((await res.json()).summary.content).toBe("cached");
    expect(clerk.auth).not.toHaveBeenCalled();
    expect(touched.generateMonthlySummary).not.toHaveBeenCalled();
  });

  // Generation spends LLM credits; only the admin POST may start it.
  it("serves the latest stored summary on a cache miss without generating", async () => {
    touched.getCachedSummary.mockResolvedValue(null);
    touched.getLatestSummary.mockResolvedValue({
      period: "2025-12",
      content: "previous month",
      generatedAt: new Date("2025-12-31T00:00:00Z"),
      metadata: {},
    });
    const res = await whatsNewSummary.GET(new NextRequest("http://localhost/api/whats-new/summary"));
    expect(touched.generateMonthlySummary).not.toHaveBeenCalled();
    expect(touched.llmFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect((await res.json()).summary.period).toBe("2025-12");
  });

  it.each([
    ["no period, nothing stored", "/api/whats-new/summary"],
    ["an explicit period with no stored summary", "/api/whats-new/summary?period=2026-02"],
  ])("returns 404 for %s without generating", async (_case, path) => {
    touched.getCachedSummary.mockResolvedValue(null);
    touched.getLatestSummary.mockResolvedValue(null);
    const res = await whatsNewSummary.GET(new NextRequest(`http://localhost${path}`));
    expect(touched.generateMonthlySummary).not.toHaveBeenCalled();
    expect(touched.llmFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(404);
    expect(clerk.auth).not.toHaveBeenCalled();
  });
});
