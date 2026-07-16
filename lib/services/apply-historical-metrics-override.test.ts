import { describe, expect, it } from "vitest";
import {
  applyHistoricalMetricsOverride,
  computeRankings,
  type HistoricalMetricsOverride,
  type RankingSourceTool,
} from "./ranking-generation.service";

function tool(
  id: string,
  slug: string,
  data: Record<string, unknown> | null = { metrics: {} }
): RankingSourceTool {
  return { id, name: slug, slug, category: "code-editor", status: "active", data };
}

const overrides: HistoricalMetricsOverride = {
  period: "2026-03",
  reconstructed: true,
  tools: {
    "claude-code": {
      display_name: "Claude Code",
      metrics: {
        npm: { downloads_last_month: { value: 42_617_911, fidelity: "real", source: "npm", as_of: "2026-03", recovery_note: "n" } },
        monthly_arr: { value: 2_500_000_000, fidelity: "interpolated", source: "s", as_of: "2026-03", recovery_note: "n" },
        swe_bench: { verified: { value: 74.5, fidelity: "held_flat", source: "s", as_of: "2025-08", recovery_note: "n" } },
      },
      provenance: { overall_confidence: "medium-high" },
    },
    aider: {
      metrics: {
        github: { stars: { value: 44_800, fidelity: "interpolated", source: "gh", as_of: "2026-03", recovery_note: "n" } },
      },
    },
  },
};

describe("applyHistoricalMetricsOverride", () => {
  it("deep-merges numeric .value leaves into the exact engine metric paths", () => {
    const [claude] = applyHistoricalMetricsOverride([tool("4", "claude-code")], overrides);
    const metrics = (claude!.data as { metrics: Record<string, unknown> }).metrics as Record<string, unknown>;

    // Nested container leaves flattened to their .value.
    expect((metrics.npm as Record<string, unknown>).downloads_last_month).toBe(42_617_911);
    expect((metrics.swe_bench as Record<string, unknown>).verified).toBe(74.5);
    // Flat leaf.
    expect(metrics.monthly_arr).toBe(2_500_000_000);
  });

  it("stamps __reconstructed and a __provenance block on matched tools", () => {
    const [claude] = applyHistoricalMetricsOverride([tool("4", "claude-code")], overrides);
    const data = claude!.data as Record<string, unknown>;
    expect(data.__reconstructed).toBe(true);
    expect(data.__provenance).toMatchObject({ period: "2026-03", reconstructed: true, overall_confidence: "medium-high" });
  });

  it("passes non-matching tools through untouched (same reference)", () => {
    const other = tool("99", "not-in-override");
    const [result] = applyHistoricalMetricsOverride([other], overrides);
    expect(result).toBe(other); // referential identity => byte-for-byte unchanged
    expect((result!.data as Record<string, unknown>).__reconstructed).toBeUndefined();
  });

  it("does not mutate the input tool for matched tools", () => {
    const input = tool("4", "claude-code");
    applyHistoricalMetricsOverride([input], overrides);
    expect((input.data as { metrics: Record<string, unknown> }).metrics).toEqual({});
    expect((input.data as Record<string, unknown>).__reconstructed).toBeUndefined();
  });

  it("preserves existing base metrics not named in the override", () => {
    const base = tool("4", "claude-code", { metrics: { users: 850_000, github: { stars: 1 } } });
    const [claude] = applyHistoricalMetricsOverride([base], overrides);
    const metrics = (claude!.data as { metrics: Record<string, unknown> }).metrics;
    // untouched base value survives the merge
    expect(metrics.users).toBe(850_000);
    // overridden branch is applied
    expect((metrics.npm as Record<string, unknown>).downloads_last_month).toBe(42_617_911);
  });

  it("handles a null base data object without throwing", () => {
    const [claude] = applyHistoricalMetricsOverride([tool("4", "claude-code", null)], overrides);
    const metrics = (claude!.data as { metrics: Record<string, unknown> }).metrics;
    expect((metrics.npm as Record<string, unknown>).downloads_last_month).toBe(42_617_911);
  });

  it("makes computeRankings surface reconstructed + provenance on scored rows", () => {
    const applied = applyHistoricalMetricsOverride(
      [tool("4", "claude-code"), tool("99", "not-in-override")],
      overrides
    );
    const rows = computeRankings(applied, new Map(), new Date("2026-03-01T00:00:00Z"));
    const claudeRow = rows.find((r) => r.tool_slug === "claude-code")!;
    const otherRow = rows.find((r) => r.tool_slug === "not-in-override")!;

    expect(claudeRow.reconstructed).toBe(true);
    expect(claudeRow.provenance).toMatchObject({ period: "2026-03" });
    // Untouched tool has neither field (keeps live-path snapshots identical).
    expect(otherRow.reconstructed).toBeUndefined();
    expect(otherRow.provenance).toBeUndefined();
  });

  it("is a no-op when the override has an empty tools map", () => {
    const t = tool("1", "cursor");
    const [result] = applyHistoricalMetricsOverride([t], { tools: {} });
    expect(result).toBe(t);
  });
});

describe("override pipeline × double-nested tools (metric-path shadowing regression)", () => {
  // Pre-fix bug: overrides merged into data.metrics.* only, while developer
  // adoption / market traction read data.info.metrics.* for double-nested
  // tools — so ALL business overrides were silently inert for those factors.
  // These tests pin that a double-nested tool's overrides are actually read.

  /** A double-nested tool: `data.info` subtree exists, with stale nested metrics. */
  function doubleNestedTool(id: string, slug: string): RankingSourceTool {
    return tool(id, slug, {
      info: {
        description: "double-nested fixture",
        // Stale legacy copies that the override must beat.
        metrics: { monthly_arr: 100_000, users: 5_000 },
      },
      metrics: {},
    });
  }

  const businessOverride: HistoricalMetricsOverride = {
    period: "2026-03",
    reconstructed: true,
    tools: {
      "dn-tool": {
        metrics: {
          monthly_arr: { value: 400_000_000, fidelity: "real", source: "s", as_of: "2026-03" },
          users: { value: 1_000_000, fidelity: "real", source: "s", as_of: "2026-03" },
          valuation: { value: 5_000_000_000, fidelity: "real", source: "s", as_of: "2026-03" },
        },
      },
      "flat-tool": {
        metrics: {
          monthly_arr: { value: 400_000_000, fidelity: "real", source: "s", as_of: "2026-03" },
          users: { value: 1_000_000, fidelity: "real", source: "s", as_of: "2026-03" },
          valuation: { value: 5_000_000_000, fidelity: "real", source: "s", as_of: "2026-03" },
        },
      },
    },
  };

  const when = new Date("2026-03-01T00:00:00Z");

  it("a double-nested tool's business overrides move the getData-based factors", () => {
    const base = doubleNestedTool("1", "dn-tool");
    const [withOverride] = applyHistoricalMetricsOverride([base], businessOverride);

    const [beforeRow] = computeRankings([base], new Map(), when);
    const [afterRow] = computeRankings([withOverride!], new Map(), when);

    // Market traction reads ARR/valuation via getData().info.metrics — inert
    // before the fix, must now reflect the override over the stale nested copy.
    expect(afterRow!.factor_scores.marketTraction).toBeGreaterThan(
      beforeRow!.factor_scores.marketTraction
    );
    // Developer adoption reads users via getData().info.metrics.
    expect(afterRow!.factor_scores.developerAdoption).toBeGreaterThan(
      beforeRow!.factor_scores.developerAdoption
    );
    expect(afterRow!.score).toBeGreaterThan(beforeRow!.score);
  });

  it("overrides land identically for double-nested and flat tools", () => {
    const applied = applyHistoricalMetricsOverride(
      [
        doubleNestedTool("1", "dn-tool"),
        tool("2", "flat-tool", { metrics: { monthly_arr: 100_000, users: 5_000 } }),
      ],
      businessOverride
    );
    const rows = computeRankings(applied, new Map(), when);
    const dn = rows.find((r) => r.tool_slug === "dn-tool")!;
    const flat = rows.find((r) => r.tool_slug === "flat-tool")!;

    // Same override values → identical business-metric-driven factor scores,
    // regardless of the tool's storage shape.
    expect(dn.factor_scores.marketTraction).toBe(flat.factor_scores.marketTraction);
    expect(dn.factor_scores.developerAdoption).toBe(flat.factor_scores.developerAdoption);
    expect(dn.factor_scores.businessSentiment).toBe(flat.factor_scores.businessSentiment);
  });
});
