/**
 * #95 step 6: typed admin metrics, validated before any write.
 *
 * Why: free-text metrics ("$10.2B") scored 0 and wrong-unit numbers passed unseen.
 *   An invalid value must never be stored as 0, null or a default, and a request
 *   with one bad field must write none of its fields.
 * What: pure-module cases for `validateAdminMetrics` / `applyAdminMetrics`, then
 *   the admin PUT route on PGlite with the real ToolsRepository, then the real
 *   RankingEngineV76 scoring the stored row (only
 *   `requireAdmin` and `getDb` replaced). Rows are read back from the database.
 * Test: `npx vitest run tests/unit/admin-metrics-validation-95.test.ts`.
 */

import type { PGlite } from "@electric-sql/pglite";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAdminMetrics, validateAdminMetrics } from "../../lib/admin-metrics-validation";
import { parseNumeric } from "../../lib/parse-numeric";
import {
  canonicalizeMetricPaths,
  RankingEngineV76,
  type ToolMetricsV76,
} from "../../lib/ranking-algorithm-v76";
import { linkedDb } from "./fixtures/tool-links-183-fixture";

const { requireAdmin, getDb, holder } = vi.hoisted(() => {
  const holder = { db: null as unknown };
  return { requireAdmin: vi.fn(), getDb: vi.fn(() => holder.db), holder };
});
vi.mock("../../lib/api-auth", () => ({ requireAdmin }));
vi.mock("../../lib/db/connection", () => ({ getDb }));

import { PUT } from "../../app/api/admin/tools/[slug]/route";

vi.setConfig({ testTimeout: 60_000 });

const NOW = new Date("2026-10-26T12:00:00Z");
const leaf = (value: unknown, over: Record<string, unknown> = {}) => ({
  value,
  source: "https://example.com/report",
  as_of: "2026-10-01",
  ...over,
});

describe("#95 validateAdminMetrics", () => {
  it("accepts valid leaves for all four fields with no warnings", () => {
    const r = validateAdminMetrics(
      {
        monthly_arr: leaf(5_000_000),
        users: leaf(250_000),
        valuation: leaf(10_200_000_000),
        swe_bench: { verified: leaf(72.5) },
      },
      NOW
    );
    expect(r).toMatchObject({ ok: true, warnings: [] });
    expect(r.ok && r.entries.map((e) => e.field)).toEqual([
      "monthly_arr",
      "users",
      "valuation",
      "swe_bench.verified",
    ]);
  });

  it.each([
    ["a string value", { users: leaf("$10.2B") }],
    ["a numeric string", { users: leaf("5000") }],
    ["null", { users: leaf(null) }],
    ["NaN", { users: leaf(Number.NaN) }],
    ["Infinity", { users: leaf(Number.POSITIVE_INFINITY) }],
    ["a negative", { monthly_arr: leaf(-1) }],
    ["an absurd magnitude", { valuation: leaf(1e18) }],
    ["swe_bench above 100", { swe_bench: { verified: leaf(180) } }],
    ["a missing source", { users: leaf(5000, { source: undefined }) }],
    ["an empty source", { users: leaf(5000, { source: " " }) }],
    ["a non-http source", { users: leaf(5000, { source: "ftp://x.test/a" }) }],
    ["a javascript source", { users: leaf(5000, { source: "javascript:alert(1)" }) }],
    ["a source with credentials", { users: leaf(5000, { source: "https://u:p@x.test/a" }) }],
    ["a missing as_of", { users: leaf(5000, { as_of: undefined }) }],
    ["a malformed as_of", { users: leaf(5000, { as_of: "10/01/2026" }) }],
    ["an impossible as_of", { users: leaf(5000, { as_of: "2026-02-30" }) }],
    ["a future as_of", { users: leaf(5000, { as_of: "2026-10-27" }) }],
    ["an unknown metric", { employees: leaf(5) }],
    ["an unknown swe_bench key", { swe_bench: { lite: leaf(5) } }],
    ["a bare number instead of a leaf", { users: 5000 }],
    ["an empty object", {}],
  ])("rejects %s", (_label, input) => {
    const r = validateAdminMetrics(input, NOW);
    expect(r.ok).toBe(false);
  });

  it("accepts today as as_of", () => {
    expect(validateAdminMetrics({ users: leaf(5000, { as_of: "2026-10-26" }) }, NOW).ok).toBe(true);
  });

  it.each([
    ["users=9 (a percentage)", { users: leaf(9) }],
    ["users above 1e9", { users: leaf(2e9) }],
    ["monthly_arr far too small", { monthly_arr: leaf(12) }],
    ["swe_bench as a fraction", { swe_bench: { verified: leaf(0.8) } }],
  ])("warns, not rejects, for %s", (_label, input) => {
    const r = validateAdminMetrics(input, NOW);
    expect(r.ok && r.warnings.length).toBe(1);
    expect(r.ok && r.entries.length).toBe(1);
  });

  it("reports an error in one field even when another field is valid", () => {
    const r = validateAdminMetrics({ users: leaf(5000), valuation: leaf("big") }, NOW);
    expect(r).toMatchObject({ ok: false, errors: [{ field: "valuation" }] });
  });
});

describe("#95 applyAdminMetrics", () => {
  it("returns a data.metrics patch of bare numbers with sibling provenance, keeping siblings", () => {
    const r = validateAdminMetrics({ monthly_arr: leaf(5_000_000), swe_bench: { verified: leaf(70) } }, NOW);
    if (!r.ok) throw new Error("expected valid");
    const patch = applyAdminMetrics(
      {
        keep: 1,
        info: { metrics: { monthly_arr: 1, swe_bench: { lite: 30 } } },
        metrics: { funding: "$1B" },
        metrics_provenance: { funding: { source: "s", as_of: "2026-01-01" } },
      },
      r.entries
    );
    expect(Object.keys(patch).sort()).toEqual(["metrics", "metrics_provenance"]);
    expect(patch.metrics).toEqual({
      funding: "$1B",
      monthly_arr: 5_000_000,
      // Started from the effective (legacy nested) swe_bench so `lite` is not shadowed.
      swe_bench: { lite: 30, verified: 70 },
    });
    expect(patch.metrics_provenance).toEqual({
      funding: { source: "s", as_of: "2026-01-01" },
      monthly_arr: { source: "https://example.com/report", as_of: "2026-10-01" },
      swe_bench: { verified: { source: "https://example.com/report", as_of: "2026-10-01" } },
    });
  });
});

describe("#95 PUT /api/admin/tools/[slug] metrics", () => {
  let pg: PGlite;
  const SLUG = "test-tool";
  beforeEach(async () => {
    let db: unknown;
    ({ pg, db } = await linkedDb([{ slug: SLUG, name: "Test Tool", kind: "harness" }]));
    holder.db = db;
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
    getDb.mockClear();
  });
  afterEach(async () => {
    await pg.close();
  });

  const seed = (data: Record<string, unknown>) =>
    pg.query(`UPDATE public."tools" SET data = $1 WHERE slug = $2`, [JSON.stringify(data), SLUG]);
  const put = (body: unknown) =>
    PUT(
      new NextRequest(`http://localhost/api/admin/tools/${SLUG}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ slug: SLUG }) }
    );
  const data = async () =>
    (await pg.query<{ data: Record<string, any> }>(`SELECT data FROM public."tools" WHERE slug = $1`, [SLUG]))
      .rows[0]?.data as Record<string, any>;

  /** The engine input exactly as computeRankings() builds it from a stored `data` blob. */
  const engineInput = (d: Record<string, any>) =>
    ({
      tool_id: "id-test-tool",
      name: "test-tool",
      slug: "test-tool",
      category: "code-editor",
      status: "active",
      info: d,
      metrics: d["metrics"] ?? {},
    }) as unknown as ToolMetricsV76;
  const score = (d: Record<string, any>) =>
    new RankingEngineV76().calculateToolScore(engineInput(d), NOW).overallScore;

  it("the engine scores the NEW valuation when data.metrics and a stale data.info.metrics both hold one", async () => {
    await seed({
      id: "tool-test",
      status: "active",
      info: { description: "d", metrics: { valuation: 1_000_000, users: 50_000 } },
      metrics: { valuation: 1_000_000_000, funding: "$1B", npm: { downloads_last_month: 1 } },
    });
    const before = score(await data());
    const res = await put({ metrics: { valuation: leaf(20_000_000_000) } });
    expect(res.status).toBe(200);

    const after = await data();
    expect(after["metrics"]).toEqual({
      valuation: 20_000_000_000,
      funding: "$1B",
      npm: { downloads_last_month: 1 },
    });
    expect(after["metrics_provenance"]["valuation"]).toEqual({
      source: "https://example.com/report",
      as_of: "2026-10-01",
    });
    // The stale legacy copy is left alone: data.metrics wins in canonicalizeMetricPaths.
    expect(after["info"]).toEqual({ description: "d", metrics: { valuation: 1_000_000, users: 50_000 } });

    const reference = {
      ...after,
      metrics: { ...after["metrics"] },
      info: { description: "d", metrics: { users: 50_000 } },
    };
    expect(score(after)).toBe(score(reference));
    expect(score(after)).not.toBe(before);
  });

  it("a flat tool (no data.info) gets data.metrics and no data.info is created", async () => {
    await seed({ id: "tool-test", status: "active", metrics: { valuation: 1_000_000_000 } });
    const before = score(await data());
    const res = await put({ metrics: { valuation: leaf(20_000_000_000) } });
    expect(res.status).toBe(200);
    const after = await data();
    expect("info" in after).toBe(false);
    expect(after["metrics"]["valuation"]).toBe(20_000_000_000);
    expect(score(after)).not.toBe(before);
  });

  it("a tool whose metrics live only under data.info.metrics keeps data.info unchanged and gains data.metrics", async () => {
    const info = { description: "d", metrics: { valuation: 1_000_000, users: 50_000 } };
    await seed({ id: "tool-test", status: "active", info });
    const res = await put({ metrics: { valuation: leaf(20_000_000_000) } });
    expect(res.status).toBe(200);
    const after = await data();
    expect(after["info"]).toEqual(info);
    expect(after["metrics"]).toEqual({ valuation: 20_000_000_000 });
    // Reader path: the canonical merge keeps nested-only `users` and takes the new valuation.
    expect(canonicalizeMetricPaths(after["metrics"], after["info"]["metrics"])).toEqual({
      valuation: 20_000_000_000,
      users: 50_000,
    });
    expect(parseNumeric(after["metrics"]["valuation"])).toBe(20_000_000_000);
  });

  it("writes swe_bench.verified into data.metrics without shadowing a nested lite score", async () => {
    await seed({ id: "tool-test", status: "active", info: { metrics: { swe_bench: { lite: 30 } } } });
    const res = await put({ metrics: { swe_bench: { verified: leaf(80.9) } } });
    expect(res.status).toBe(200);
    expect((await data())["metrics"]["swe_bench"]).toEqual({ lite: 30, verified: 80.9 });
  });

  it("returns magnitude warnings and still writes the value", async () => {
    await seed({ id: "tool-test", status: "active" });
    const res = await put({ metrics: { users: leaf(9) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { warnings: { field: string }[] };
    expect(body.warnings).toMatchObject([{ field: "users" }]);
    expect((await data())["metrics"]["users"]).toBe(9);
  });

  it("combines a description edit and metrics in one write", async () => {
    await seed({ id: "tool-test", status: "active", info: { description: "old" } });
    const res = await put({ description: "new", metrics: { users: leaf(250_000) } });
    expect(res.status).toBe(200);
    const after = await data();
    expect(after["info"]["description"]).toBe("new");
    expect(after["metrics"]["users"]).toBe(250_000);
  });

  it.each([
    ["a text value", { valuation: leaf("$10.2B") }],
    ["a negative", { users: leaf(-5) }],
    ["a missing source", { users: leaf(5000, { source: undefined }) }],
    ["a future as_of", { users: leaf(5000, { as_of: "2999-01-01" }) }],
    ["an unknown metric", { employees: leaf(5) }],
  ])("answers 400 for %s and writes nothing", async (_l, metrics) => {
    await seed({ id: "tool-test", status: "active", metrics: { valuation: 5 } });
    const before = await data();
    const res = await put({ metrics });
    expect(res.status).toBe(400);
    expect(await data()).toEqual(before);
  });

  it("writes no field when one of several is invalid, and not the description either", async () => {
    await seed({ id: "tool-test", status: "active", info: { description: "old" } });
    const before = await data();
    const res = await put({
      description: "new",
      metrics: { monthly_arr: leaf(5_000_000), users: leaf("many") },
    });
    expect(res.status).toBe(400);
    expect(await data()).toEqual(before);
  });

  it("refuses an unauthenticated caller before any read or write", async () => {
    await seed({ id: "tool-test", status: "active" });
    requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const before = await data();
    getDb.mockClear();
    const res = await put({ metrics: { users: leaf(5000) } });
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(await data()).toEqual(before);
  });
});
