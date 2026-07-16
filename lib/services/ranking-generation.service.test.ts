import { describe, expect, it, vi } from "vitest";
import {
  buildPreviousRankMap,
  calculateTier,
  computeRankings,
  RankingGenerationInProgressError,
  type RankingEntry,
  type RankingPersistencePort,
  type RankingSourceTool,
  RANKING_ALGORITHM_VERSION,
  regenerateRankings,
  toPeriod,
} from "./ranking-generation.service";

function makeTool(id: string, name: string, users: number): RankingSourceTool {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    category: "code-editor",
    status: "active",
    data: { metrics: { users, github_stars: users / 10 } },
  };
}

const sampleTools = [
  makeTool("t1", "Alpha", 1_000_000),
  makeTool("t2", "Bravo", 500_000),
  makeTool("t3", "Charlie", 10_000),
];

/** In-memory persistence adapter capturing the saved snapshot. */
function fakePersistence(
  current: { data: unknown } | null = null
): RankingPersistencePort & { saved?: { period: string; algorithmVersion: string; data: RankingEntry[] } } {
  const port: RankingPersistencePort & {
    saved?: { period: string; algorithmVersion: string; data: RankingEntry[] };
  } = {
    loadActiveTools: async () => sampleTools,
    loadCurrentRankings: async () => current,
    saveSnapshot: async ({ period, algorithmVersion, data }) => {
      port.saved = { period, algorithmVersion, data };
    },
  };
  return port;
}

describe("ranking-generation.service", () => {
  describe("toPeriod", () => {
    it("formats a UTC date as YYYY-MM", () => {
      expect(toPeriod(new Date("2026-07-01T00:00:00Z"))).toBe("2026-07");
      expect(toPeriod(new Date("2026-01-31T23:59:59Z"))).toBe("2026-01");
    });
  });

  describe("calculateTier", () => {
    it("assigns tiers by rank band", () => {
      expect(calculateTier(1)).toBe("S");
      expect(calculateTier(6)).toBe("A");
      expect(calculateTier(16)).toBe("B");
      expect(calculateTier(31)).toBe("C");
      expect(calculateTier(46)).toBe("D");
    });
  });

  describe("buildPreviousRankMap", () => {
    it("reads a bare array snapshot", () => {
      const map = buildPreviousRankMap([{ tool_id: "t1", rank: 3 }, { tool_id: "t2", rank: 1 }]);
      expect(map.get("t1")).toBe(3);
      expect(map.get("t2")).toBe(1);
    });

    it("reads a wrapped { rankings: [] } snapshot and tolerates null", () => {
      expect(buildPreviousRankMap({ rankings: [{ id: "t9", position: 4 }] }).get("t9")).toBe(4);
      expect(buildPreviousRankMap(null).size).toBe(0);
    });
  });

  describe("computeRankings", () => {
    it("scores, sorts descending, and assigns sequential ranks + tiers", () => {
      const result = computeRankings(sampleTools, new Map());

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i]!.score).toBeGreaterThanOrEqual(result[i + 1]!.score);
        expect(result[i]!.tier).toBe(calculateTier(result[i]!.rank));
        expect(Object.keys(result[i]!.factor_scores).length).toBeGreaterThan(0);
      }
    });

    it("marks all tools as new when there is no prior snapshot", () => {
      const result = computeRankings(sampleTools, new Map());
      for (const entry of result) {
        expect(entry.movement.previous_position).toBeNull();
        expect(entry.movement.change).toBe(0);
        expect(entry.movement.direction).toBe("same");
      }
    });

    it("computes upward movement relative to a prior rank", () => {
      const first = computeRankings(sampleTools, new Map());
      const top = first[0]!;
      // Pretend the current #1 was previously ranked 3 places lower.
      const prev = new Map([[top.tool_id, top.rank + 3]]);

      const again = computeRankings(sampleTools, prev);
      const moved = again.find((r) => r.tool_id === top.tool_id)!;

      expect(moved.movement.previous_position).toBe(top.rank + 3);
      expect(moved.movement.change).toBe(3);
      expect(moved.movement.direction).toBe("up");
    });
  });

  describe("regenerateRankings", () => {
    it("loads, computes, persists a current snapshot, and returns a summary", async () => {
      const persistence = fakePersistence();
      const now = () => new Date("2026-07-01T09:00:00Z");

      const result = await regenerateRankings({ persistence, now });

      expect(result.period).toBe("2026-07");
      expect(result.algorithmVersion).toBe(RANKING_ALGORITHM_VERSION);
      expect(result.toolCount).toBe(3);
      expect(result.publishedAt).toBe("2026-07-01T09:00:00.000Z");

      expect(persistence.saved).toBeDefined();
      expect(persistence.saved!.period).toBe("2026-07");
      expect(persistence.saved!.algorithmVersion).toBe(RANKING_ALGORITHM_VERSION);
      expect(persistence.saved!.data).toHaveLength(3);
    });

    it("leaves the LIVE path untouched when no metrics override is configured", async () => {
      // The historical backfill must be strictly additive: the cron path (no
      // metricsOverridePath) has to score live tools.data and persist rows with
      // no reconstructed/provenance markers.
      const persistence = fakePersistence();
      const now = () => new Date("2026-07-01T09:00:00Z");

      await regenerateRankings({ persistence, now });

      for (const row of persistence.saved!.data) {
        expect(row.reconstructed).toBeUndefined();
        expect(row.provenance).toBeUndefined();
      }
      // Identical to scoring the source tools directly with no override applied.
      expect(persistence.saved!.data.map((r) => r.tool_slug)).toEqual(
        computeRankings(sampleTools, new Map(), now()).map((r) => r.tool_slug)
      );
    });

    it("ignores a metrics override path that does not exist on disk", async () => {
      const persistence = fakePersistence();
      const now = () => new Date("2026-07-01T09:00:00Z");

      await regenerateRankings({
        persistence,
        now,
        metricsOverridePath: "/nonexistent/data/historical-metrics/1999-01.json",
      });

      for (const row of persistence.saved!.data) {
        expect(row.reconstructed).toBeUndefined();
      }
      expect(persistence.saved!.data).toHaveLength(3);
    });

    it("honors an explicit period override", async () => {
      const persistence = fakePersistence();
      const result = await regenerateRankings({ persistence, period: "2025-12" });
      expect(result.period).toBe("2025-12");
      expect(persistence.saved!.period).toBe("2025-12");
    });

    it("rejects a concurrent run for the same period", async () => {
      let releaseLoad: () => void = () => {};
      const gate = new Promise<void>((resolve) => {
        releaseLoad = resolve;
      });

      const persistence: RankingPersistencePort = {
        loadActiveTools: async () => {
          await gate; // hold the first run open
          return sampleTools;
        },
        loadCurrentRankings: async () => null,
        saveSnapshot: async () => {},
      };

      const opts = { persistence, period: "2026-07" };
      const firstRun = regenerateRankings(opts);
      // Second run for the same period must be rejected while the first is in flight.
      await expect(regenerateRankings(opts)).rejects.toBeInstanceOf(
        RankingGenerationInProgressError
      );

      releaseLoad();
      await expect(firstRun).resolves.toMatchObject({ period: "2026-07" });
    });

    it("surfaces the prior snapshot as movement context", async () => {
      const seedRun = fakePersistence();
      await regenerateRankings({ persistence: seedRun, period: "2026-06" });
      const prior = seedRun.saved!.data;
      const topId = prior.find((r) => r.rank === 1)!.tool_id;

      const persistence = fakePersistence({ data: prior.map((r) => ({ tool_id: r.tool_id, rank: r.rank + (r.tool_id === topId ? 2 : 0) })) });
      const spy = vi.spyOn(persistence, "loadCurrentRankings");
      await regenerateRankings({ persistence, period: "2026-07" });

      expect(spy).toHaveBeenCalledOnce();
      const movedTop = persistence.saved!.data.find((r) => r.tool_id === topId)!;
      expect(movedTop.movement.previous_position).toBe(movedTop.rank + 2);
    });
  });
});
