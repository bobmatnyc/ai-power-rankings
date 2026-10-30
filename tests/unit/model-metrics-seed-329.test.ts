/**
 * #329: the model metrics seed validator, the private-file guard and the projected index count.
 *
 * Why: a metrics row that reaches `tools.data` must be a Vals TB 4.0 figure for a seeded model
 *   family (D63, D86), and the real figures must never become committable in this public repo.
 * What: checks each rejection rule of `parseModelMetricsSeed` on synthetic rows, that
 *   `git check-ignore` matches the default private path, that a tracked copy is refused, and the
 *   models-list metric count the seeded rows would reach after the write and activation (D86).
 * Test: `npx vitest run tests/unit/model-metrics-seed-329.test.ts`. No database, no network.
 */

import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import {
  EXCLUDED_METRIC_SLUGS,
  EXISTING_FAMILY_METRIC_SLUGS,
  MODEL_METRICS_DEFAULT_PATH,
  metricDataAfterWrite,
  parseModelMetricsSeed,
} from "../../lib/db/repositories/model-metrics-seed.repository";
import { hasCodingMetric, isRankingListIndexable, METRIC_INDEX_MIN_ROWS, MODEL_TERMINAL_BENCH_SOURCE } from "../../lib/rankings/lists";
import { readModelMetrics } from "../../scripts/load-model-metrics";
import { METRIC_SLUGS, SEED_SLUGS, syntheticMetricRow, syntheticMetricsDoc } from "./fixtures/model-metrics-329-fixture";

// Tests spawn child processes or shell scripts, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const KNOWN = new Set(METRIC_SLUGS);
const parse = (doc: unknown) => parseModelMetricsSeed(JSON.stringify(doc), KNOWN);
const oneRow = (overrides: Record<string, unknown>) => syntheticMetricsDoc(SEED_SLUGS, [syntheticMetricRow("glm", 0, overrides)]);

describe("parseModelMetricsSeed (#329)", () => {
  it("accepts a synthetic row for every seeded family and every allowlisted existing family", () => {
    const seed = parse(syntheticMetricsDoc());
    expect(seed.rows.map((r) => r.slug)).toEqual(METRIC_SLUGS);
    // #329: the existing family rows stay out of the seed files and are accepted only by the allowlist.
    // M3: devstral-small-2 joins through the lifecycle's live slugs.
    expect(EXISTING_FAMILY_METRIC_SLUGS).toEqual(["claude-opus", "claude-sonnet", "grok", "devstral-small-2"]);
    for (const slug of EXISTING_FAMILY_METRIC_SLUGS) expect(SEED_SLUGS).not.toContain(slug);
    expect(() => parseModelMetricsSeed(JSON.stringify(oneRow({ slug: "grok" })), new Set(SEED_SLUGS))).toThrow(/unknown slug/);
    expect(seed.rows.every((r) => r.field === "terminal_bench" && r.source === MODEL_TERMINAL_BENCH_SOURCE)).toBe(true);
    expect(parse(oneRow({ version: "GLM snapshot 0101" })).rows[0]!.version).toBe("GLM snapshot 0101");
  });

  it.each([
    ["an unknown slug", oneRow({ slug: "gpt-oss" }), /unknown slug/],
    ["a version-bearing slug of an existing family", oneRow({ slug: "claude-opus-5-5" }), /unknown slug/],
    ["a vendor source", oneRow({ source: "https://www.anthropic.com/news" }), /source must be/],
    ["the Vals page with a fragment", oneRow({ source: `${MODEL_TERMINAL_BENCH_SOURCE}#snapshot` }), /source must be/],
    ["a TB 2.1 source", oneRow({ source: "https://www.tbench.ai/leaderboard/terminal-bench/2.1" }), /source must be/],
    ["a zero figure", oneRow({ value: 0 }), /finite number above 0/],
    ["a negative figure", oneRow({ value: -4 }), /finite number above 0/],
    ["a figure as text", oneRow({ value: "41" }), /finite number above 0/],
    ["a figure above 100", oneRow({ value: 101 }), /at most 100/],
    ["a missing as_of", oneRow({ as_of: undefined }), /as_of is required/],
    ["a non-date as_of", oneRow({ as_of: "2026-02-30" }), /real YYYY-MM-DD/],
    ["an as_of after checked_at", oneRow({ as_of: "2026-10-22" }), /after checked_at/],
    ["muse-wonder", oneRow({ slug: "muse-wonder" }), /slug is excluded \(muse-wonder\)/],
    ["swe_bench", oneRow({ field: "swe_bench" }), /field is not allowed/],
    ["swe_bench.verified", oneRow({ field: "swe_bench.verified" }), /not allowed/],
    ["an extra key", oneRow({ rank: 1 }), /has a key outside/],
    ["an empty version", oneRow({ version: "" }), /version is required/],
  ])("rejects %s", (_name, doc, error) => {
    expect(() => parse(doc)).toThrow(error);
  });

  it("names no input text in any rejection (#329: the loader output reaches a public log)", () => {
    const cases = [
      oneRow({ slug: "gpt-oss" }),
      oneRow({ field: "swe_bench" }),
      oneRow({ rank: 1 }),
      oneRow({ as_of: "2026-10-22" }),
      oneRow({ source: "https://example.com/leak" }),
      oneRow({ value: 101 }),
    ];
    for (const doc of cases) {
      let message = "";
      try {
        parse(doc);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe("");
      for (const leak of ["gpt-oss", "swe_bench", "rank", "2026-10-22", "example.com", "101"]) expect(message).not.toContain(leak);
    }
  });

  it("rejects a non-finite figure, which JSON cannot carry, at the row level", () => {
    const doc = oneRow({});
    const text = JSON.stringify(doc).replace(/"value":\d+/, '"value":1e999');
    expect(() => parseModelMetricsSeed(text, KNOWN)).toThrow(/finite number above 0/);
  });

  it("rejects muse-wonder even when a seed lists it", () => {
    expect(EXCLUDED_METRIC_SLUGS).toEqual(["muse-wonder"]);
    expect(() => parseModelMetricsSeed(JSON.stringify(oneRow({ slug: "muse-wonder" })), new Set([...KNOWN, "muse-wonder"]))).toThrow(
      /excluded/
    );
  });

  it("rejects a duplicate slug, an empty list and a bad checked_at", () => {
    expect(() => parse(syntheticMetricsDoc(SEED_SLUGS, [syntheticMetricRow("glm", 0), syntheticMetricRow("glm", 1)]))).toThrow(
      /duplicate slug glm/
    );
    expect(() => parse({ checked_at: "2026-10-21", metrics: [] })).toThrow(/no metrics array/);
    expect(() => parse({ ...syntheticMetricsDoc(), checked_at: "soon" })).toThrow(/checked_at/);
  });
});

describe("the private metrics file (#329)", () => {
  it("git ignores the default path, so `git add -A` cannot stage it", () => {
    const res = spawnSync("git", ["check-ignore", "--no-index", "-q", MODEL_METRICS_DEFAULT_PATH], { encoding: "utf8" });
    expect(res.status).toBe(0);
    expect(MODEL_METRICS_DEFAULT_PATH).toBe("data/private/model-metrics.json");
  });

  it("refuses a metrics file that git tracks, and checks the real tracked state", () => {
    const text = JSON.stringify(syntheticMetricsDoc());
    expect(() => readModelMetrics("any.json", KNOWN, () => text, () => true)).toThrow(/tracked by git/);
    expect(readModelMetrics("any.json", KNOWN, () => text, () => false).rows).toHaveLength(METRIC_SLUGS.length);
    // A committed file is tracked; the default private path never is.
    expect(() => readModelMetrics("package.json", KNOWN, () => text)).toThrow(/tracked by git/);
  });
});

describe("projected models-list metric count after activation (#329, D86)", () => {
  /** Rows counted by `hasCodingMetric` once every listed row is written and activated. */
  function projectedCount(rows: Record<string, unknown>[]): number {
    const seed = parse(syntheticMetricsDoc(SEED_SLUGS, rows));
    return seed.rows.filter((row) => hasCodingMetric(metricDataAfterWrite(row))).length;
  }

  it("reaches the index threshold when every seeded and allowlisted family carries a figure", () => {
    const count = projectedCount(METRIC_SLUGS.map((slug, i) => syntheticMetricRow(slug, i)));
    // #329: every seed row plus the allowlisted live rows (the lifecycle's live slugs).
    expect(METRIC_SLUGS).toHaveLength(SEED_SLUGS.length + EXISTING_FAMILY_METRIC_SLUGS.length);
    expect(count).toBe(METRIC_SLUGS.length);
    expect(count).toBeGreaterThanOrEqual(METRIC_INDEX_MIN_ROWS);
    // Activated rows are on the board, so the board holds at least `count` entries.
    expect(isRankingListIndexable("model", count, count)).toBe(true);
  });

  it("stays below the threshold with nine rows", () => {
    const count = projectedCount(SEED_SLUGS.slice(0, 9).map((slug, i) => syntheticMetricRow(slug, i)));
    expect(count).toBe(9);
    expect(isRankingListIndexable("model", 20, count)).toBe(false);
  });
});
