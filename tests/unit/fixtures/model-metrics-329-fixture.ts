/**
 * #329: synthetic model metrics for tests.
 *
 * Why: the real Vals Terminal-Bench 4.0 figures are not published in this repo, so no test may
 *   read or restate them. Tests use made-up whole numbers that are not leaderboard figures.
 * What: `SEED_SLUGS` are the slugs of the committed model seed files; `METRIC_SLUGS` adds the
 *   existing family allowlist (`metricTargetSlugs`); `syntheticMetricsDoc`
 *   builds a valid metrics document for the given slugs, one synthetic figure per row.
 * Test: used by the `*-329` metrics tests.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { metricTargetSlugs } from "../../../lib/db/repositories/model-metrics-seed.repository";
import { MODEL_TERMINAL_BENCH_SOURCE } from "../../../lib/rankings/lists";
import { readModelSeeds } from "../../../scripts/load-model-seeds";

const ROOT = path.resolve(__dirname, "../../..");

export const SEED_SLUGS: readonly string[] = readModelSeeds("all", (file) => readFileSync(path.join(ROOT, file), "utf8")).map(
  (e) => e.row.slug
);

/** #329: every slug a metric row may name: the seed slugs plus the existing family rows. */
export const METRIC_SLUGS: readonly string[] = metricTargetSlugs(SEED_SLUGS);

/** A synthetic figure: whole numbers from 40 up, never a leaderboard value. */
export function syntheticValue(i: number): number {
  return 40 + i;
}

export function syntheticMetricRow(slug: string, i: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { slug, field: "terminal_bench", value: syntheticValue(i), source: MODEL_TERMINAL_BENCH_SOURCE, as_of: "2026-10-20", ...overrides };
}

export function syntheticMetricsDoc(slugs: readonly string[] = METRIC_SLUGS, rows?: Record<string, unknown>[]): Record<string, unknown> {
  return { checked_at: "2026-10-21", metrics: rows ?? slugs.map((slug, i) => syntheticMetricRow(slug, i)) };
}
