/**
 * #95 step 6: typed admin metrics, validated before any write.
 *
 * Why: free-text metrics ("$10.2B") scored 0 and wrong-unit numbers passed unseen.
 *   An invalid value must never be stored as 0, null or a default, and a request
 *   with one bad field must write none of its fields.
 * What: pure-module cases for `validateAdminMetrics` / `applyAdminMetrics`, then
 *   the admin PUT route on PGlite with the real ToolsRepository (only
 *   `requireAdmin` and `getDb` replaced). Rows are read back from the database.
 * Test: `npx vitest run tests/unit/admin-metrics-validation-95.test.ts`.
 */

import type { PGlite } from "@electric-sql/pglite";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAdminMetrics, validateAdminMetrics } from "../../lib/admin-metrics-validation";
import { parseNumeric } from "../../lib/parse-numeric";
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
  it("keeps the value a bare number, keeps siblings, and writes provenance beside it", () => {
    const r = validateAdminMetrics({ monthly_arr: leaf(5_000_000), swe_bench: { verified: leaf(70) } }, NOW);
    if (!r.ok) throw new Error("expected valid");
    const info = applyAdminMetrics(
      {
        keep: 1,
        metrics: { funding: "$1B", swe_bench: { lite: 30 } },
        metrics_provenance: { funding: { source: "s", as_of: "2026-01-01" } },
      },
      r.entries
    );
    expect(info).toEqual({
      keep: 1,
      metrics: { funding: "$1B", monthly_arr: 5_000_000, swe_bench: { lite: 30, verified: 70 } },
      metrics_provenance: {
        funding: { source: "s", as_of: "2026-01-01" },
        monthly_arr: { source: "https://example.com/report", as_of: "2026-10-01" },
        swe_bench: { verified: { source: "https://example.com/report", as_of: "2026-10-01" } },
      },
    });
  });
});

describe("#95 PUT /api/admin/tools/[slug] metrics", () => {
  let pg: PGlite;
  beforeEach(async () => {
    let db: unknown;
    ({ pg, db } = await linkedDb([{ slug: "claude-code", name: "Claude Code", kind: "harness" }]));
    await pg.query(`UPDATE public."tools" SET data = $1 WHERE slug = 'claude-code'`, [
      JSON.stringify({
        id: "tool-claude-code",
        status: "active",
        info: {
          description: "old",
          metrics: { funding: "$1B", valuation: "$10.2B (Sep 2025)", swe_bench: { lite: 30 } },
        },
      }),
    ]);
    holder.db = db;
    requireAdmin.mockReset();
    requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
    getDb.mockClear();
  });
  afterEach(async () => {
    await pg.close();
  });

  const put = (body: unknown) =>
    PUT(
      new NextRequest("http://localhost/api/admin/tools/claude-code", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ slug: "claude-code" }) }
    );
  const info = async () =>
    (
      await pg.query<{ data: { info: Record<string, any> } }>(
        `SELECT data FROM public."tools" WHERE slug = 'claude-code'`
      )
    ).rows[0]?.data.info as Record<string, any>;

  it("writes typed metrics, keeps sibling keys, and v7.6's numeric parse still yields the number", async () => {
    const res = await put({
      metrics: { monthly_arr: leaf(400_000_000), swe_bench: { verified: leaf(80.9) } },
    });
    expect(res.status).toBe(200);
    const stored = await info();
    expect(stored["description"]).toBe("old");
    expect(stored["metrics"]).toEqual({
      funding: "$1B",
      valuation: "$10.2B (Sep 2025)",
      monthly_arr: 400_000_000,
      swe_bench: { lite: 30, verified: 80.9 },
    });
    expect(stored["metrics_provenance"]["monthly_arr"]).toEqual({
      source: "https://example.com/report",
      as_of: "2026-10-01",
    });
    // The reader path in ranking-algorithm-v76 coerces info.metrics.monthly_arr with parseNumeric.
    expect(parseNumeric(stored["metrics"]["monthly_arr"])).toBe(400_000_000);
    expect(parseNumeric(stored["metrics"]["swe_bench"]["verified"])).toBe(80.9);
  });

  it("returns magnitude warnings and still writes the value", async () => {
    const res = await put({ metrics: { users: leaf(9) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { warnings: { field: string }[] };
    expect(body.warnings).toMatchObject([{ field: "users" }]);
    expect((await info())["metrics"]["users"]).toBe(9);
  });

  it("combines a description edit and metrics in one write", async () => {
    const res = await put({ description: "new", metrics: { users: leaf(250_000) } });
    expect(res.status).toBe(200);
    const stored = await info();
    expect(stored["description"]).toBe("new");
    expect(stored["metrics"]["users"]).toBe(250_000);
  });

  it.each([
    ["a text value", { valuation: leaf("$10.2B") }],
    ["a negative", { users: leaf(-5) }],
    ["a missing source", { users: leaf(5000, { source: undefined }) }],
    ["a future as_of", { users: leaf(5000, { as_of: "2999-01-01" }) }],
    ["an unknown metric", { employees: leaf(5) }],
  ])("answers 400 for %s and writes nothing", async (_l, metrics) => {
    const before = await info();
    const res = await put({ metrics });
    expect(res.status).toBe(400);
    expect(await info()).toEqual(before);
  });

  it("writes no field when one of several is invalid, and not the description either", async () => {
    const before = await info();
    const res = await put({
      description: "new",
      metrics: { monthly_arr: leaf(5_000_000), users: leaf("many") },
    });
    expect(res.status).toBe(400);
    expect(await info()).toEqual(before);
  });

  it("refuses an unauthenticated caller before any read or write", async () => {
    requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const before = await info();
    getDb.mockClear();
    const res = await put({ metrics: { users: leaf(5000) } });
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
    expect(await info()).toEqual(before);
  });
});
