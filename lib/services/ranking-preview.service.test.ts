import { describe, expect, it, vi } from "vitest";

/**
 * Admin ranking preview (#93).
 *
 * Why: the preview moved off the V6 engine onto the cron's pipeline; it must
 *   write nothing and keep its `rankings_comparison` response shape.
 * What: checks comparison rows against both stored snapshot shapes, the
 *   preview-date filter, and that `previewRankings()` calls no write method.
 * Test: `npx vitest run lib/services/ranking-preview.service.test.ts`.
 */

import golden from "./__fixtures__/regenerate-publish.golden.json";
import { GOLDEN_NOW, GOLDEN_TOOLS } from "./__fixtures__/regenerate-golden-input";
import type { RankingEntry, RankingPersistencePort } from "./ranking-generation.service";
import { buildPreviewComparison, filterByPreviewDate, previewRankings } from "./ranking-preview.service";

const entries = golden.saveSnapshotCalls[0]!.data as RankingEntry[];

describe("buildPreviewComparison", () => {
  it("labels new, up, down and same against a bare-array snapshot", () => {
    const [first, second, third] = entries;
    const rows = buildPreviewComparison(entries, [
      { tool_id: first!.tool_id, rank: 3, score: 1 },
      { tool_id: second!.tool_id, rank: 1, score: 2 },
      { tool_id: third!.tool_id, rank: 3, score: 3 },
    ]);

    expect(rows.slice(0, 4).map((r) => r.movement)).toEqual(["up", "down", "same", "new"]);
    expect(rows[0]).toEqual({
      tool_id: first!.tool_id,
      tool_name: first!.tool_name,
      category: first!.category,
      current_rank: 1,
      current_score: first!.score,
      previous_rank: 3,
      previous_score: 1,
      rank_change: 2,
      score_change: first!.score - 1,
      movement: "up",
    });
    expect(rows[3]).toMatchObject({ previous_rank: undefined, rank_change: 0, score_change: entries[3]!.score });
  });

  it("reads `position` from the older { rankings: [] } shape", () => {
    const rows = buildPreviewComparison(entries, { rankings: [{ tool_id: entries[0]!.tool_id, position: 2 }] });
    expect(rows[0]).toMatchObject({ previous_rank: 2, rank_change: 1, movement: "up" });
  });
});

describe("filterByPreviewDate", () => {
  it("drops tools launched after the date and keeps tools with no launch date", () => {
    const tools = [
      { ...GOLDEN_TOOLS[0]!, data: { launch_date: "2026-01-01" } },
      { ...GOLDEN_TOOLS[1]!, data: { launch_date: "2026-09-01" } },
      { ...GOLDEN_TOOLS[2]!, data: {} },
    ];
    const kept = filterByPreviewDate(tools, new Date("2026-06-30T00:00:00Z"));
    expect(kept.map((t) => t.id)).toEqual([GOLDEN_TOOLS[0]!.id, GOLDEN_TOOLS[2]!.id]);
  });
});

describe("previewRankings", () => {
  it("scores like the cron and calls no write method", async () => {
    const saveSnapshot = vi.fn(async () => {});
    const saveDraft = vi.fn(async () => {});
    const persistence: RankingPersistencePort = {
      loadActiveTools: async () => GOLDEN_TOOLS,
      loadCurrentRankings: async () => ({ data: [] }),
      saveSnapshot,
      saveDraft,
    };

    const rows = await previewRankings({ period: "2026-07", persistence, now: () => new Date(GOLDEN_NOW) });

    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(saveDraft).not.toHaveBeenCalled();
    expect(rows.map(({ tool_id, rank, score, tier, factor_scores }) => ({ tool_id, rank, score, tier, factor_scores }))).toEqual(
      entries.map(({ tool_id, rank, score, tier, factor_scores }) => ({ tool_id, rank, score, tier, factor_scores }))
    );
  });
});
