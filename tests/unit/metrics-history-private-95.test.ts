/**
 * #95: the metrics history stays private.
 *
 * Why: Bob's D20 ruling keeps the collected history private. Nothing that
 *   serves a page or a public API may read it; only the collect-metrics cron
 *   route writes it.
 * What: scans every source file under app/ and lib/ for the two history tables
 *   (drizzle names and SQL names) and the lib/metrics-history modules. Under
 *   app/ only the cron route may match; under lib/ only the schema and the
 *   history store. The route itself must match, so the scan cannot pass vacuously.
 * Test: `npx vitest run tests/unit/metrics-history-private-95.test.ts`
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const PATTERN = /toolMetricsHistory|metricsCollectionRuns|tool_metrics_history|metrics_collection_runs|metrics-history\//;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

function referencing(dir: string): string[] {
  return sourceFiles(dir)
    .filter((file) => PATTERN.test(readFileSync(path.join(ROOT, file), "utf8")))
    .map((file) => file.split(path.sep).join("/"))
    .sort();
}

describe("#95 metrics history is private", () => {
  it("no file under app/ references the history tables except the collect-metrics cron route", () => {
    expect(referencing("app")).toEqual(["app/api/cron/collect-metrics/route.ts"]);
  });

  it("under lib/ only the schema and the history store reference them", () => {
    expect(referencing("lib")).toEqual(["lib/db/schema.ts", "lib/metrics-history/store.ts"]);
  });
});
