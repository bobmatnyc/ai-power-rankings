import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #368 fix round: on an ISR page a failed database read fails the render.
 *
 * Why: Next keeps serving the last good page when a regeneration throws, but
 *   caches whatever a regeneration returns. A read error turned into an empty
 *   board (rankings, home) would be cached for the page's whole window.
 * What: runs the real `loadCurrentRankings` and `RankingsRepository` over a fake
 *   Drizzle client whose query rejects (no repository or loader is mocked), and
 *   checks the rankings page's metadata and body, `loadListBoard` and the home
 *   page all reject with that error. With the query answering no row, the
 *   rankings page and home still render their empty, noindex state.
 * Test: `npx vitest run tests/unit/isr-read-errors-368.test.tsx`. No network.
 */

const db = vi.hoisted(() => ({ rows: [] as unknown[], failure: null as Error | null }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({
  getDb: () => {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: async () => {
        if (db.failure) throw db.failure;
        return db.rows;
      },
    };
    return { select: () => chain };
  },
}));

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;

beforeEach(() => {
  Object.assign(db, { rows: [], failure: null });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

vi.setConfig({ testTimeout: 60_000 });

describe("a rejecting database query (#368)", () => {
  const failure = new Error("connection refused");
  beforeEach(() => {
    db.failure = failure;
  });

  it("rejects loadListBoard instead of returning an empty board", async () => {
    const { loadListBoard } = await import("../../lib/rankings/list-board");
    await expect(loadListBoard("harness")).rejects.toBe(failure);
  });

  it("rejects the rankings page's metadata and body", async () => {
    const mod = await import("../../app/[lang]/rankings/page");
    await expect(mod.generateMetadata(params({ lang: "en" }))).rejects.toBe(failure);
    await expect(mod.default(params({ lang: "en" }))).rejects.toBe(failure);
  });

  it("rejects the home page instead of rendering its empty state", async () => {
    const { default: Home } = await import("../../app/[lang]/page");
    await expect(Home(params({ lang: "en" }))).rejects.toBe(failure);
  });
});

describe("no current snapshot (#368)", () => {
  it("still gives the rankings page its empty, noindex board", async () => {
    const mod = await import("../../app/[lang]/rankings/page");
    const metadata = (await mod.generateMetadata(params({ lang: "en" }))) as { robots?: unknown };
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("still renders the home page", async () => {
    const { default: Home } = await import("../../app/[lang]/page");
    await expect(Home(params({ lang: "en" }))).resolves.toBeTruthy();
  });
});
