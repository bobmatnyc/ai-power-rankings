import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Admin authentication on `/api/admin/*` handlers that only checked sign-in
 * (or nothing).
 *
 * Why: These handlers accepted any signed-in Clerk user, and sign-up is open,
 * so admin reads and writes were not limited to admins. The static stub
 * handlers had no check at all.
 * What: Calls each handler through the real `requireAdmin()` with Clerk's
 * `auth`/`currentUser` replaced. Anonymous → 401, signed-in non-admin → 403,
 * and neither caller reaches the database, the article services, the cache
 * writers, Search Console or the filesystem.
 * Test: `npx vitest run tests/unit/admin-api-auth.test.ts`. No database
 * access, no network, no file writes.
 */

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));

const touched = vi.hoisted(() => ({
  getDb: vi.fn(() => ({})),
  testConnection: vi.fn(async () => true),
  articleDbService: vi.fn(),
  articlesRepository: vi.fn(),
  invalidateArticleCache: vi.fn(async () => undefined),
  writeRankingsStaticCache: vi.fn(),
  searchConsole: vi.fn(),
  readFile: vi.fn(async () => "[]"),
  writeFile: vi.fn(async () => undefined),
}));

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("../../lib/db/connection", () => ({
  getDb: touched.getDb,
  testConnection: touched.testConnection,
}));
vi.mock("../../lib/services/article-db-service", () => ({
  ArticleDatabaseService: class {
    constructor() {
      touched.articleDbService();
    }
  },
}));
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  ArticlesRepository: class {
    constructor() {
      touched.articlesRepository();
    }
  },
}));
vi.mock("../../lib/cache/invalidation.service", () => ({
  invalidateArticleCache: touched.invalidateArticleCache,
}));
vi.mock("../../lib/cache/rankings-static-cache", () => ({
  writeRankingsStaticCache: touched.writeRankingsStaticCache,
}));
vi.mock("../../lib/google-search-console", () => ({
  GoogleSearchConsole: class {
    constructor() {
      touched.searchConsole();
    }
  },
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const promises = { ...actual.promises, readFile: touched.readFile, writeFile: touched.writeFile };
  return { ...actual, default: { ...actual, promises }, promises };
});
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return { ...actual, default: { ...actual, writeFile: touched.writeFile }, writeFile: touched.writeFile };
});

import * as articleById from "../../app/api/admin/articles/[id]/route";
import * as articleRecalculate from "../../app/api/admin/articles/[id]/recalculate/route";
import * as articleIngest from "../../app/api/admin/articles/ingest/route";
import * as articlesV2 from "../../app/api/admin/articles-v2/route";
import * as checkOrphanedMetrics from "../../app/api/admin/check-orphaned-metrics/route";
import * as createUser from "../../app/api/admin/create-user/route";
import * as dbStatus from "../../app/api/admin/db-status/route";
import * as dbStatusV2 from "../../app/api/admin/db-status-v2/route";
import * as fixOrphanedData from "../../app/api/admin/fix-orphaned-data/route";
import * as fixOrphanedMetrics from "../../app/api/admin/fix-orphaned-metrics/route";
import * as rankingsRollback from "../../app/api/admin/rankings/rollback/[id]/route";
import * as rankingsVersions from "../../app/api/admin/rankings/versions/route";
import * as removeData from "../../app/api/admin/remove-data/route";
import * as submitSitemap from "../../app/api/admin/seo/submit-sitemap/route";
import * as uploadImage from "../../app/api/admin/upload-image/route";

function req(path: string, method = "GET", body?: BodyInit): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method, body });
}

function jsonReq(path: string, method: string, payload: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
}

function imageUpload(): NextRequest {
  const form = new FormData();
  form.append("file", new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" }));
  return req("/api/admin/upload-image", "POST", form);
}

const id = { params: Promise.resolve({ id: "article-1" }) };
const params = () => ({ params: Promise.resolve({ id: "article-1" }) });

const HANDLERS: Array<[string, () => Promise<Response>]> = [
  ["GET /api/admin/articles/[id]", () => articleById.GET(req("/api/admin/articles/article-1"), params())],
  [
    "PATCH /api/admin/articles/[id]",
    () => articleById.PATCH(jsonReq("/api/admin/articles/article-1", "PATCH", { title: "x" }), params()),
  ],
  [
    "DELETE /api/admin/articles/[id]",
    () => articleById.DELETE(req("/api/admin/articles/article-1", "DELETE"), params()),
  ],
  [
    "GET /api/admin/articles/[id]/recalculate",
    () => articleRecalculate.GET(req("/api/admin/articles/article-1/recalculate"), params()),
  ],
  [
    "POST /api/admin/articles/[id]/recalculate",
    () =>
      articleRecalculate.POST(
        jsonReq("/api/admin/articles/article-1/recalculate", "POST", { dryRun: false }),
        params()
      ),
  ],
  [
    "POST /api/admin/articles/ingest",
    () => articleIngest.POST(jsonReq("/api/admin/articles/ingest", "POST", { input: "x", type: "text" })),
  ],
  ["GET /api/admin/articles-v2", () => articlesV2.GET()],
  ["GET /api/admin/db-status", () => dbStatus.GET()],
  ["GET /api/admin/db-status-v2", () => dbStatusV2.GET()],
  [
    "POST /api/admin/rankings/rollback/[id]",
    () => rankingsRollback.POST(req("/api/admin/rankings/rollback/v1", "POST"), id),
  ],
  ["GET /api/admin/rankings/versions", () => rankingsVersions.GET(req("/api/admin/rankings/versions"))],
  ["POST /api/admin/seo/submit-sitemap", () => submitSitemap.POST()],
  ["POST /api/admin/upload-image", () => uploadImage.POST(imageUpload())],
  ["GET /api/admin/remove-data", () => removeData.GET()],
  ["POST /api/admin/remove-data", () => removeData.POST(req("/api/admin/remove-data", "POST"))],
  ["GET /api/admin/fix-orphaned-data", () => fixOrphanedData.GET()],
  ["POST /api/admin/fix-orphaned-data", () => fixOrphanedData.POST(req("/api/admin/fix-orphaned-data", "POST"))],
  ["GET /api/admin/fix-orphaned-metrics", () => fixOrphanedMetrics.GET()],
  [
    "POST /api/admin/fix-orphaned-metrics",
    () => fixOrphanedMetrics.POST(req("/api/admin/fix-orphaned-metrics", "POST")),
  ],
  ["GET /api/admin/check-orphaned-metrics", () => checkOrphanedMetrics.GET()],
  [
    "POST /api/admin/check-orphaned-metrics",
    () => checkOrphanedMetrics.POST(req("/api/admin/check-orphaned-metrics", "POST")),
  ],
  ["POST /api/admin/create-user", () => createUser.POST()],
];

function touchedCount(): number {
  return Object.values(touched).reduce((n, fn) => n + fn.mock.calls.length, 0);
}

beforeEach(() => {
  vi.clearAllMocks();
  // requireAdmin() treats missing Clerk keys as "auth disabled"; stub them so
  // the real check runs. Runtime-only values, never real keys.
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_stub");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_stub");
  vi.stubEnv("GOOGLE_SEARCH_CONSOLE_SITE_URL", "https://example.test/");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin API handlers require an admin", () => {
  it.each(HANDLERS)("%s returns 401 for an anonymous caller", async (_name, call) => {
    clerk.auth.mockResolvedValue({ userId: null });
    clerk.currentUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(touchedCount()).toBe(0);
  });

  it.each(HANDLERS)("%s returns 403 for a signed-in non-admin", async (_name, call) => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    clerk.currentUser.mockResolvedValue({ id: "user_1", privateMetadata: {} });
    const res = await call();
    expect(res.status).toBe(403);
    expect(touchedCount()).toBe(0);
  });

  // The admin check must run before the request body is read or parsed.
  it.each([
    ["anonymous", { userId: null }, null, 401],
    ["signed-in non-admin", { userId: "user_1" }, { id: "user_1", privateMetadata: {} }, 403],
  ])(
    "POST /api/admin/articles/[id]/recalculate refuses a %s caller without reading the body",
    async (_who, session, user, status) => {
      clerk.auth.mockResolvedValue(session);
      clerk.currentUser.mockResolvedValue(user);
      const request = jsonReq("/api/admin/articles/article-1/recalculate", "POST", { dryRun: true });
      const readText = vi.spyOn(request, "text");
      const readJson = vi.spyOn(request, "json");
      const res = await articleRecalculate.POST(request, params());
      expect(res.status).toBe(status);
      expect(readText).not.toHaveBeenCalled();
      expect(readJson).not.toHaveBeenCalled();
      expect(touchedCount()).toBe(0);
    }
  );

  // Shows the "not touched" assertion above can fail: an admin does reach
  // the mocked data layer through the same handlers.
  it.each(HANDLERS.filter(([name]) => /db-status-v2|articles\/\[id\]$|rankings\/versions/.test(name)))(
    "%s reaches the data layer for an admin",
    async (_name, call) => {
      clerk.auth.mockResolvedValue({ userId: "user_1" });
      clerk.currentUser.mockResolvedValue({ id: "user_1", privateMetadata: { isAdmin: true } });
      await call();
      expect(touchedCount()).toBeGreaterThan(0);
    }
  );
});
