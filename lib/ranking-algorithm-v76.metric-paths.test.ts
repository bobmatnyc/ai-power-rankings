/**
 * Regression coverage for the metric-path shadowing fix.
 *
 * Bug: tools store business metrics at `data.metrics.*` (top level), at
 * `data.info.metrics.*` (double-nested tools), or at BOTH. Factor read sites
 * historically split into two groups reading the SAME logical field from
 * DIFFERENT paths, so a value present at only one path was invisible to half
 * the factors (e.g. `users` counted for developer adoption but not for
 * business sentiment / data completeness).
 *
 * Fix under test: `canonicalizeMetricPaths` + the engine's single
 * normalization step. Invariants pinned here:
 *  1. Precedence: per top-level key, `data.metrics.*` wins over
 *     `data.info.metrics.*`; nested-only keys are kept (union).
 *  2. Path-placement invariance: the same logical values placed nested-only,
 *     top-only, or (duplicated) at both paths score IDENTICALLY — one value,
 *     resolved once; duplication neither double-counts nor drops.
 *  3. Flat tools (single `data.metrics` path) are unaffected.
 *
 * DB-free: constructs engine inputs exactly the way
 * `computeRankings()` (ranking-generation.service.ts) does.
 */

import { describe, expect, it } from "vitest";
import {
  canonicalizeMetricPaths,
  RankingEngineV76,
  type ToolMetricsV76,
} from "./ranking-algorithm-v76";

const FIXED_DATE = new Date("2026-07-15T00:00:00Z");

/** Build an engine input the same way computeRankings() does. */
function engineInput(data: Record<string, unknown>, slug = "fixture-tool"): ToolMetricsV76 {
  return {
    tool_id: `id-${slug}`,
    name: slug,
    slug,
    category: "code-editor",
    status: "active",
    info: data,
    metrics: (data["metrics"] as Record<string, unknown>) ?? {},
  } as ToolMetricsV76;
}

const BUSINESS_METRICS = {
  users: 1_000_000,
  monthly_arr: 400_000_000,
  valuation: 5_000_000_000,
  funding: 100_000_000,
  employees: 100,
  news_mentions: 20,
  github_stars: 50_000,
  swe_bench: { verified: 65 },
};

/** Double-nested tool (`data.info` subtree exists) with metrics at a chosen placement. */
function doubleNestedTool(placement: "nested" | "top" | "both"): ToolMetricsV76 {
  const data: Record<string, unknown> = {
    description: "A code editor tool for testing metric path resolution.",
    info: {
      description: "A code editor tool for testing metric path resolution.",
      ...(placement !== "top" ? { metrics: structuredClone(BUSINESS_METRICS) } : {}),
    },
    // Structured platform metrics always live at the top-level subtree.
    metrics: {
      vscode: { installs: 1_000_000 },
      npm: { downloads_last_month: 100_000 },
      ...(placement !== "nested" ? structuredClone(BUSINESS_METRICS) : {}),
    },
  };
  return engineInput(data);
}

describe("canonicalizeMetricPaths", () => {
  it("top-level data.metrics.* wins over data.info.metrics.* on conflicts", () => {
    const canonical = canonicalizeMetricPaths(
      { monthly_arr: 400_000_000, swe_bench: { verified: 80.9 } },
      { monthly_arr: 1, swe_bench: { verified: 55, full: 30 }, news_mentions: 12 }
    );
    expect(canonical.monthly_arr).toBe(400_000_000);
    // Shallow precedence: the WHOLE top-level key wins, no object blending.
    expect(canonical.swe_bench).toEqual({ verified: 80.9 });
    // Nested-only keys are kept (union).
    expect(canonical.news_mentions).toBe(12);
  });

  it("nested-only metrics are kept when the top path is absent", () => {
    expect(canonicalizeMetricPaths(undefined, { users: 5 })).toEqual({ users: 5 });
  });

  it("top-only metrics are kept when the nested path is absent", () => {
    expect(canonicalizeMetricPaths({ users: 7 }, undefined)).toEqual({ users: 7 });
  });

  it("returns an empty object when neither path exists", () => {
    expect(canonicalizeMetricPaths(undefined, undefined)).toEqual({});
  });
});

describe("RankingEngineV76 metric-path resolution", () => {
  const engine = new RankingEngineV76();

  it("scores identically whether business metrics live at data.info.metrics, data.metrics, or both", () => {
    const nested = engine.calculateToolScore(doubleNestedTool("nested"), FIXED_DATE);
    const top = engine.calculateToolScore(doubleNestedTool("top"), FIXED_DATE);
    const both = engine.calculateToolScore(doubleNestedTool("both"), FIXED_DATE);

    // One value, once: duplication at both paths must not double-count
    // (both === single placement) and single placement must not drop
    // (nested === top).
    expect(nested.factorScores).toEqual(top.factorScores);
    expect(both.factorScores).toEqual(top.factorScores);
    expect(nested.overallScore).toBe(top.overallScore);
    expect(both.overallScore).toBe(top.overallScore);
    expect(nested.dataCompleteness).toBe(top.dataCompleteness);
    expect(both.dataCompleteness).toBe(top.dataCompleteness);
  });

  it("every factor group sees a nested-only value (the pre-fix bug made Group A blind to it)", () => {
    const withMetrics = engine.calculateToolScore(doubleNestedTool("nested"), FIXED_DATE);
    const withoutMetrics = engine.calculateToolScore(
      engineInput({
        description: "A code editor tool for testing metric path resolution.",
        info: { description: "A code editor tool for testing metric path resolution." },
        metrics: { vscode: { installs: 1_000_000 }, npm: { downloads_last_month: 100_000 } },
      }),
      FIXED_DATE
    );

    // Group B factors (via getData) — worked before the fix, must keep working.
    expect(withMetrics.factorScores.developerAdoption).toBeGreaterThan(
      withoutMetrics.factorScores.developerAdoption
    );
    expect(withMetrics.factorScores.marketTraction).toBeGreaterThan(
      withoutMetrics.factorScores.marketTraction
    );
    // Group A factors (direct info.metrics reads) — blind to nested-only
    // values before the fix.
    expect(withMetrics.factorScores.businessSentiment).toBeGreaterThan(
      withoutMetrics.factorScores.businessSentiment
    );
    expect(withMetrics.factorScores.agenticCapability).toBeGreaterThan(
      withoutMetrics.factorScores.agenticCapability
    );
    expect(withMetrics.dataCompleteness).toBeGreaterThan(withoutMetrics.dataCompleteness);
  });

  it("on a conflict, the top-level value wins for BOTH factor groups", () => {
    const conflicted = engineInput({
      info: {
        // Stale nested copy: tiny ARR, weak SWE-bench.
        metrics: { monthly_arr: 100_000, swe_bench: { verified: 10 } },
      },
      metrics: { monthly_arr: 400_000_000, swe_bench: { verified: 65 } },
    });
    const topOnly = engineInput({
      info: {},
      metrics: { monthly_arr: 400_000_000, swe_bench: { verified: 65 } },
    });

    const a = engine.calculateToolScore(conflicted, FIXED_DATE);
    const b = engine.calculateToolScore(topOnly, FIXED_DATE);

    // Group B (market traction reads ARR via getData) and Group A (agentic
    // reads swe_bench directly) must both resolve the top-level values.
    expect(a.factorScores.marketTraction).toBe(b.factorScores.marketTraction);
    expect(a.factorScores.agenticCapability).toBe(b.factorScores.agenticCapability);
  });

  it("flat tools (no data.info subtree) resolve data.metrics.* for all factors, unchanged", () => {
    const flat = engineInput({
      description: "A code editor tool for testing metric path resolution.",
      metrics: {
        ...structuredClone(BUSINESS_METRICS),
        vscode: { installs: 1_000_000 },
        npm: { downloads_last_month: 100_000 },
      },
    });
    const flatScore = engine.calculateToolScore(flat, FIXED_DATE);

    // Same logical values as the double-nested fixtures → identical
    // metric-driven factors (only info-field-driven factors may differ, and
    // the fixtures keep those aligned).
    const dn = engine.calculateToolScore(doubleNestedTool("both"), FIXED_DATE);
    expect(flatScore.factorScores.developerAdoption).toBe(dn.factorScores.developerAdoption);
    expect(flatScore.factorScores.marketTraction).toBe(dn.factorScores.marketTraction);
    expect(flatScore.factorScores.businessSentiment).toBe(dn.factorScores.businessSentiment);
    expect(flatScore.factorScores.agenticCapability).toBe(dn.factorScores.agenticCapability);
  });

  it("does not mutate the caller's tool data", () => {
    const data = {
      info: { metrics: { users: 10_000 } },
      metrics: { github: { stars: 1 } },
    };
    const snapshot = structuredClone(data);
    engine.calculateToolScore(engineInput(data), FIXED_DATE);
    expect(data).toEqual(snapshot);
  });
});
