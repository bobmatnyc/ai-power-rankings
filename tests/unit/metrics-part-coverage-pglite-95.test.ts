/**
 * #95: the per-part coverage floor and flat-value queries on real Postgres (PGlite).
 *
 * Why: two writers date history rows on a day other than the 1st: the open-weight
 *   collection (`scripts/collect-open-weight-metrics.ts --apply`) and a manual re-run of a
 *   failed shard. When such a day was the latest earlier collected_date, the query took it
 *   as every part's previous collection, so the parts it lacked had no eligible tools and
 *   the report printed "no eligible tools" with the floor off.
 * What: builds minimal `tools` and `tool_metrics_history` tables, inserts a full collection
 *   on 2026-10-01, an open-weight row on 2026-10-15 and an npm-only re-run row on 2026-10-20,
 *   then runs the real `PART_COVERAGE_QUERY` and `FLAT_QUERY`. Each part must read its own
 *   latest earlier date, and the rendered report must fail the parts nobody recorded on 2026-11-01.
 *   #184: `huggingface` is checked too; a `kind='model'` tool with an `hf_repo` is eligible for it.
 * Test: `npx vitest run tests/unit/metrics-part-coverage-pglite-95.test.ts`. No server, no network.
 */

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_URL_PATHS } from "../../lib/metrics-collectors/github";
import { HF_METRICS_KEY } from "../../lib/metrics-collectors/huggingface";
import { COLLECTOR_PARTS } from "../../lib/metrics-collectors/registry";
import { CHECKED_PARTS, renderMetricsHistoryReport } from "../../lib/metrics-history/check-report";
import { FLAT_QUERY, PART_COVERAGE_QUERY } from "../../scripts/check-metrics-history";

vi.setConfig({ testTimeout: 60_000 });

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const C = "00000000-0000-4000-8000-00000000000c";

const leaf = { value: 1, source: "https://example.com", as_of: "2026-10-01" };

describe("PART_COVERAGE_QUERY and FLAT_QUERY previous collection (#95)", () => {
  let pg: PGlite;

  beforeEach(async () => {
    pg = new PGlite();
    await pg.exec(`
      CREATE TABLE tools (
        id uuid PRIMARY KEY,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        kind text NOT NULL DEFAULT 'harness',
        hf_repo text
      );
      CREATE TABLE tool_metrics_history (
        tool_id uuid REFERENCES tools(id),
        collected_date date NOT NULL,
        metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
        UNIQUE (tool_id, collected_date)
      );
    `);
    for (const id of [A, B, C]) await pg.query("INSERT INTO tools (id) VALUES ($1)", [id]);
    const history = (id: string, date: string, metrics: Record<string, unknown>) =>
      pg.query("INSERT INTO tool_metrics_history (tool_id, collected_date, metrics) VALUES ($1, $2, $3::jsonb)", [
        id,
        date,
        JSON.stringify(metrics),
      ]);
    // The monthly collection: every part has one tool.
    await history(A, "2026-10-01", { github: { stars: leaf }, npm: { downloads: leaf } });
    await history(B, "2026-10-01", { pypi: { downloads: leaf }, vscode: { installs: leaf } });
    // Off-day writers: an open-weight row and an npm-only shard re-run.
    await history(C, "2026-10-15", { huggingface: { downloads: leaf } });
    await history(A, "2026-10-20", { npm: { downloads: leaf } });
    // The checked month: only npm was recorded.
    await history(A, "2026-11-01", { npm: { downloads: leaf } });
  });

  afterEach(async () => {
    await pg.close();
  });

  async function partCoverage(): Promise<{ part: string; eligible: number; recorded: number }[]> {
    // #184: CHECKED_PARTS and the open-weight key, as executeCheck passes them.
    const result = await pg.query<{ part: string; eligible: number; recorded: number }>(PART_COVERAGE_QUERY, [
      "2026-11-01",
      [...CHECKED_PARTS],
      [...GITHUB_URL_PATHS],
      HF_METRICS_KEY,
    ]);
    return result.rows;
  }

  it("takes each part's own latest earlier collection, not an off-day date of another part", async () => {
    const rows = await partCoverage();
    const byPart = Object.fromEntries(rows.map((r) => [r.part, { eligible: r.eligible, recorded: r.recorded }]));
    expect(byPart).toEqual({
      github: { eligible: 1, recorded: 0 },
      // #184: C carried the open-weight key on 2026-10-15 and has nothing on 2026-11-01.
      huggingface: { eligible: 1, recorded: 0 },
      npm: { eligible: 1, recorded: 1 },
      pypi: { eligible: 1, recorded: 0 },
      vscode: { eligible: 1, recorded: 0 },
    });
  });

  it("fails the floor instead of printing 'no eligible tools'", async () => {
    const { exitCode, report } = renderMetricsHistoryReport({
      date: "2026-11-01",
      rowsPerDate: [],
      ledger: [],
      coverage: { tools: 3, rows: 1 },
      previousDate: "2026-10-20",
      flat: [],
      partCoverage: await partCoverage(),
    });
    expect(report).not.toContain("no eligible tools");
    expect(report).toMatch(/pypi: 0 of 1 eligible \(0%\) FAIL/);
    expect(exitCode).toBe(3);
  });

  it("compares each part with its own latest earlier collection in the flat check", async () => {
    // B was recorded again on the checked date with October's pypi and vscode values.
    await pg.query("INSERT INTO tool_metrics_history (tool_id, collected_date, metrics) VALUES ($1, $2, $3::jsonb)", [
      B,
      "2026-11-01",
      JSON.stringify({ pypi: { downloads: leaf }, vscode: { installs: leaf } }),
    ]);
    const result = await pg.query<{ part: string; compared: number; unchanged: number }>(FLAT_QUERY, [
      "2026-11-01",
      [...COLLECTOR_PARTS],
    ]);
    const byPart = Object.fromEntries(result.rows.map((r) => [r.part, { compared: r.compared, unchanged: r.unchanged }]));
    expect(byPart).toEqual({
      npm: { compared: 1, unchanged: 1 },
      pypi: { compared: 1, unchanged: 1 },
      vscode: { compared: 1, unchanged: 1 },
    });
  });

  // #184: the open-weight run writes no ledger row, so this query is what sees a missed month.
  it("makes a model with an hf_repo eligible for huggingface on its first month, and counts its row", async () => {
    const D = "00000000-0000-4000-8000-00000000000d";
    const E = "00000000-0000-4000-8000-00000000000e";
    const F = "00000000-0000-4000-8000-00000000000f";
    await pg.query("INSERT INTO tools (id, kind, hf_repo) VALUES ($1, 'model', 'org/model-d')", [D]);
    await pg.query("INSERT INTO tools (id, kind, hf_repo) VALUES ($1, 'model', NULL)", [E]);
    await pg.query("INSERT INTO tools (id, kind, hf_repo) VALUES ($1, 'harness', 'org/not-a-model')", [F]);

    const missed = (await partCoverage()).find((r) => r.part === HF_METRICS_KEY);
    expect(missed).toEqual({ part: HF_METRICS_KEY, eligible: 2, recorded: 0 });

    for (const id of [C, D]) {
      await pg.query("INSERT INTO tool_metrics_history (tool_id, collected_date, metrics) VALUES ($1, $2, $3::jsonb)", [
        id,
        "2026-11-01",
        JSON.stringify({ [HF_METRICS_KEY]: { downloads_30d: leaf } }),
      ]);
    }
    const recorded = (await partCoverage()).find((r) => r.part === HF_METRICS_KEY);
    expect(recorded).toEqual({ part: HF_METRICS_KEY, eligible: 2, recorded: 2 });
  });
});
