import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A publish purges the cached `/api/rankings/current` board (#311).
 *
 * Why: the route caches its board in memory and sent a public `s-maxage`, while
 *   the monthly publish (`GET /api/cron/regenerate-rankings`) cleared neither, so
 *   the next read after a publish could serve the previous month.
 * What: over the in-memory rankings DB stand-in, publishes run through the cron
 *   route with `regenerateRankings()` stubbed to write (or fail to write) the
 *   current row. A committed publish makes the next read return the new month; a
 *   failed one purges nothing; a read with no publish in between is served from
 *   the cache; no response may be stored by a shared cache.
 * Test: `npx vitest run tests/unit/rankings-current-publish-purge-311.test.ts`.
 */

const db = vi.hoisted(() => ({ client: null as unknown }));
const publish = vi.hoisted(() => ({ impl: async (): Promise<unknown> => ({}) }));
const nextCache = vi.hoisted(() => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("next/cache", () => nextCache);
vi.mock("../../lib/db/connection", () => ({ getDb: () => db.client }));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findByIds = async () => [];
    findBySlugs = async () => [];
  },
}));
vi.mock("../../lib/services/ranking-generation.service", () => ({
  RankingGenerationInProgressError: class extends Error {
    period = "";
  },
  regenerateRankings: () => publish.impl(),
}));

import { GET as cronPublish } from "../../app/api/cron/regenerate-rankings/route";
import { GET as readCurrent } from "../../app/api/rankings/current/route";
import { clearCache } from "../../lib/memory-cache";
import { createFakeRankingsDb, rankingRow } from "../../lib/services/__fixtures__/fake-rankings-db";

let fake: ReturnType<typeof createFakeRankingsDb>;

const board = (period: string) => [{ tool_id: `tool-${period}`, tool_name: `Tool ${period}`, rank: 1, score: 80 }];

/** Demote the current combined row and make `period` current, as a committed publish does. */
function writeCurrent(period: string, data: unknown = board(period)) {
  for (const row of fake.state.rankings) row.isCurrent = false;
  fake.state.rankings.push(rankingRow({ period, isCurrent: true, data, publishedAt: new Date() }));
}

function publishOk(period: string) {
  publish.impl = async () => {
    writeCurrent(period);
    return { period, algorithmVersion: "7.9", toolCount: 1, publishedAt: new Date().toISOString(), topMovers: [] };
  };
}

const cronRequest = () =>
  new Request("http://localhost/api/cron/regenerate-rankings", {
    headers: { authorization: "Bearer test-cron-secret" },
  });

async function current(): Promise<{ status: number; period: string | undefined; cacheControl: string | null }> {
  const res = await readCurrent();
  const body = (await res.json()) as { data?: { period?: string } };
  return { status: res.status, period: body.data?.period, cacheControl: res.headers.get("Cache-Control") };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.stubEnv("ALERT_WEBHOOK_URL", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  nextCache.revalidatePath.mockClear();
  nextCache.revalidateTag.mockClear();
  clearCache();
  fake = createFakeRankingsDb({ rankings: [] });
  db.client = fake.client;
});

describe("/api/rankings/current after a publish (#311)", () => {
  it("returns the newly published month, not the cached previous one", async () => {
    publishOk("2026-09");
    expect((await cronPublish(cronRequest())).status).toBe(200);
    expect((await current()).period).toBe("2026-09"); // now cached

    publishOk("2026-10");
    expect((await cronPublish(cronRequest())).status).toBe(200);

    expect((await current()).period).toBe("2026-10");
    expect(nextCache.revalidateTag).toHaveBeenCalledWith("rankings");
  });

  it("keeps serving the cached month when the publish fails", async () => {
    publishOk("2026-09");
    await cronPublish(cronRequest());
    expect((await current()).period).toBe("2026-09");
    nextCache.revalidateTag.mockClear();

    // A failed run leaves a half-written current row behind and throws.
    publish.impl = async () => {
      writeCurrent("2026-10", []);
      throw new Error("write failed");
    };
    expect((await cronPublish(cronRequest())).status).toBe(500);

    expect((await current()).period).toBe("2026-09");
    expect(nextCache.revalidateTag).not.toHaveBeenCalled();
  });

  it("serves a cached read when no publish happened in between", async () => {
    publishOk("2026-09");
    await cronPublish(cronRequest());
    expect((await current()).period).toBe("2026-09");

    writeCurrent("2026-10"); // a row change that did not go through the publish route

    expect((await current()).period).toBe("2026-09");
  });

  it("lets no shared cache store a board or an error", async () => {
    const empty = await current();
    expect(empty.status).toBe(404);
    expect(empty.cacheControl).toBe("no-store");

    clearCache();
    publishOk("2026-09");
    await cronPublish(cronRequest());
    const ok = await current();
    expect(ok.status).toBe(200);
    expect(ok.cacheControl).toBe("no-store");
  });
});
