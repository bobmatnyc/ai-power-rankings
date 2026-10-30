// The Next server's own first import: installs AsyncLocalStorage, which the work store below needs.
import "next/dist/server/node-environment-baseline";
import type { WorkStore } from "next/dist/server/app-render/work-async-storage.external";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { getImplicitTags } from "next/dist/server/lib/implicit-tags";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin set-current purges the public ranking caches (#354).
 *
 * Why: changing the current board through `POST /api/admin/rankings`
 *   (`set-current`) or `POST /api/admin/rankings/set-current` purged no cache,
 *   so the ISR home page and the `/[lang]/rankings` fetch served the previous
 *   board for about five minutes. The shared purge also named `/rankings` and
 *   `/tools`, which match no page under `app/[lang]/`, and the rankings fetch
 *   carried no tag for `revalidateTag('rankings')` to reach.
 * What: over the in-memory rankings DB stand-in, both set-current routes purge
 *   after the write commits, purge nothing when the write fails, and report a
 *   failed purge in a 200 body as `cache_purge`. Without the `'/'` layout
 *   call, the purge still marks stale a tag that Next's own `getImplicitTags`
 *   gives the home, rankings and tool pages in every locale, and the rankings
 *   page fetch carries the `rankings` tag.
 * Test: `npx vitest run tests/unit/set-current-cache-purge-354.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
const fsSpy = vi.hoisted(() => ({ writeFileSync: vi.fn() }));
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("next/cache", () => nextCache);
vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));
vi.mock("../../lib/api-auth", () => ({
  requireAdmin: async () => ({ userId: "admin", user: { id: "admin" }, error: null }),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, default: { ...actual, writeFileSync: fsSpy.writeFileSync }, writeFileSync: fsSpy.writeFileSync };
});

import { RankingListPage } from "../../app/[lang]/rankings/ranking-list-page";
import { POST as consolidatedPost } from "../../app/api/admin/rankings/route";
import { POST as setCurrentPost } from "../../app/api/admin/rankings/set-current/route";
import { locales } from "../../i18n/config";
import { invalidateRankingsCache } from "../../lib/cache/invalidation.service";
import { RankingsRepository } from "../../lib/db/repositories/rankings.repository";
import { loggers } from "../../lib/logger";
import { createFakeRankingsDb, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";

let fake: ReturnType<typeof createFakeRankingsDb>;

const currentPeriods = () => fake.state.rankings.filter((r) => r.isCurrent).map((r) => r.period);

/** The two set-current entry points, each called for `period`. */
const routes = {
  "POST /api/admin/rankings set-current": (period: string) =>
    consolidatedPost(
      new NextRequest("http://localhost/api/admin/rankings", {
        method: "POST",
        body: JSON.stringify({ action: "set-current", period }),
        headers: { "content-type": "application/json" },
      })
    ),
  "POST /api/admin/rankings/set-current": (period: string) =>
    setCurrentPost(
      new NextRequest("http://localhost/api/admin/rankings/set-current", {
        method: "POST",
        body: JSON.stringify({ period }),
        headers: { "content-type": "application/json" },
      })
    ),
};

beforeEach(() => {
  vi.restoreAllMocks();
  fsSpy.writeFileSync.mockClear();
  nextCache.revalidatePath.mockReset();
  nextCache.revalidateTag.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  fake = createFakeRankingsDb({
    rankings: [
      rankingRow({ period: "2026-07", isCurrent: true, id: "current-row" }),
      rankingRow({ period: "2026-08", isCurrent: false, id: "draft-row-v2" }),
    ],
  });
  db.client = fake.client;
});

describe.each(Object.entries(routes))("%s (#354)", (_name, setCurrent) => {
  it("purges the rankings caches after the write commits", async () => {
    // The current period at the moment the purge runs: proves it ran after the commit.
    const seenAtPurge: string[][] = [];
    nextCache.revalidateTag.mockImplementation(() => seenAtPurge.push(currentPeriods()));

    const res = await setCurrent("2026-08");
    const body = (await res.json()) as { cache_purge?: { success: boolean; errors: string[] } };

    expect(res.status).toBe(200);
    expect(nextCache.revalidateTag).toHaveBeenCalledWith("rankings");
    expect(seenAtPurge.length).toBeGreaterThan(0);
    expect(seenAtPurge.every((periods) => periods.join() === "2026-08")).toBe(true);
    expect(nextCache.revalidatePath).toHaveBeenCalledWith("/[lang]", "page");
    expect(body.cache_purge).toEqual({ success: true, errors: [] });
  });

  it("purges nothing when the write fails", async () => {
    // The row read before a rebuild replaced it, so setAsCurrent throws and rolls back.
    vi.spyOn(RankingsRepository.prototype, "getByPeriod").mockResolvedValue({
      ...(await new RankingsRepository().getByPeriod("2026-08"))!,
      id: "draft-row-v1",
    });

    const res = await setCurrent("2026-08");

    expect(res.status).toBe(500);
    expect(currentPeriods()).toEqual(["2026-07"]);
    expect(nextCache.revalidatePath).not.toHaveBeenCalled();
    expect(nextCache.revalidateTag).not.toHaveBeenCalled();
  });

  it("reports a failed purge in the 200 body and logs it", async () => {
    nextCache.revalidateTag.mockImplementation(() => {
      throw new Error("tag store unavailable");
    });
    const logged = vi.spyOn(loggers.api, "error").mockImplementation(() => loggers.api);

    const res = await setCurrent("2026-08");
    const body = (await res.json()) as { success: boolean; cache_purge?: { success: boolean; errors: string[] } };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(currentPeriods()).toEqual(["2026-08"]);
    expect(body.cache_purge?.success).toBe(false);
    expect(body.cache_purge?.errors.join("\n")).toMatch(/tag store unavailable/);
    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/purge failed/), expect.objectContaining({ period: "2026-08" }));
  });
});

describe("invalidateRankingsCache paths (#354)", () => {
  /** Each ranking page's route and a URL under it; `<lang>` is filled per locale. */
  const pages = [
    { page: "/[lang]/page", url: "/<lang>" },
    { page: "/[lang]/rankings/page", url: "/<lang>/rankings" },
    { page: "/[lang]/rankings/[list]/page", url: "/<lang>/rankings/coding-agents" },
    { page: "/[lang]/tools/[slug]/page", url: "/<lang>/tools/cursor" },
  ];

  /**
   * The tags the purge's `revalidatePath` calls mark stale, other than the
   * `'/'` layout call. Each call is replayed through Next's own
   * `revalidatePath` in a work store, which collects the tags it computes.
   */
  async function purgedTags(): Promise<string[]> {
    const real = await vi.importActual<typeof import("next/cache")>("next/cache");
    const store = { route: "/api/admin/rankings", incrementalCache: {} } as unknown as WorkStore;
    workAsyncStorage.run(store, () => {
      for (const [path, type] of nextCache.revalidatePath.mock.calls) {
        if (path === "/" && type === "layout") continue;
        real.revalidatePath(path, type);
      }
    });
    return store.pendingRevalidatedTags ?? [];
  }

  it("purges a tag every ranking page carries in every locale, without the '/' layout call", async () => {
    const result = await invalidateRankingsCache();
    const purged = await purgedTags();

    for (const { page, url } of pages) {
      for (const lang of locales) {
        const pathname = url.replace("<lang>", lang);
        // #354: the tags Next itself attaches to this page's cache entry.
        const { tags } = await getImplicitTags(page, { pathname }, null);
        expect(purged.filter((tag) => tags.includes(tag)), `${pathname} (${page}) tags ${tags.join(" ")}`).not.toEqual([]);
      }
    }
    expect(result.success).toBe(true);
  });

  it("names no bare /rankings or /tools path", async () => {
    await invalidateRankingsCache();
    const paths = nextCache.revalidatePath.mock.calls.map(([path]) => path);

    expect(paths.filter((p) => p === "/rankings" || p === "/tools")).toEqual([]);
  });
});

describe("rankings page fetch (#354)", () => {
  it("carries the rankings tag so revalidateTag('rankings') reaches it", async () => {
    const fetchSpy = vi.fn<(url: string, init?: RequestInit & { next?: { tags?: string[] } }) => Promise<Response>>(
      async () => Response.json({ rankings: [], list_meta: null })
    );
    vi.stubGlobal("fetch", fetchSpy);
    try {
      await RankingListPage({ lang: "en", list: "harness" });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetchSpy).toHaveBeenCalled();
    const init = fetchSpy.mock.calls[0]?.[1];
    expect(init?.next?.tags).toContain("rankings");
  });
});
