/**
 * #329: the Opus 4.x redirect re-point (PM call on D0c).
 *
 * Why: the step writes to hidden alias rows, so it must touch only the listed aliases in their
 *   expected state, show itself in the dry run and abort the whole apply on a 0-row match.
 * What: plans every arm against a recorded-SQL double and checks the apply's fail-closed arm and
 *   the loader's dry run.
 * Test: `npx vitest run tests/unit/model-redirect-repoint-329.test.ts`. No database.
 */

import { describe, expect, it } from "vitest";
import {
  applyRedirectRepoints,
  MODEL_REDIRECT_REPOINT_SQL,
  MODEL_REDIRECT_REPOINTS,
  planRedirectRepoints,
  type RedirectRepoint,
} from "../../lib/db/repositories/model-redirect-repoint";
import type { ModelSeedDb } from "../../lib/db/repositories/model-seed-writer";
import type { ModelLifecycle } from "../../lib/db/repositories/model-lifecycle";
import { loadModelSeeds, readModelLifecycle } from "../../scripts/load-model-seeds";
import { readFileSync } from "node:fs";

type Row = { slug: string; kind: string; status: string; redirect_to: string | null };

function fakeDb(rows: Row[], writeRows: (params: unknown[] | undefined) => unknown[] = (p) => [{ slug: p?.[0] }]) {
  const calls: { sql: string; params: unknown[] | undefined }[] = [];
  const query = async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.trimStart().startsWith("SELECT")) {
      const slugs = (params?.[0] as string[]) ?? [];
      return { rows: rows.filter((r) => slugs.includes(r.slug)) };
    }
    return { rows: writeRows(params) };
  };
  const db: ModelSeedDb = { query, transaction: (fn) => fn({ query }) };
  return { db, calls };
}

const alias = (slug: string, redirectTo: string | null, extra: Partial<Row> = {}): Row => ({
  slug,
  kind: "model",
  status: "redirect",
  redirect_to: redirectTo,
  ...extra,
});
const target: Row = { slug: "claude-opus-4", kind: "model", status: "active", redirect_to: null };
const PAIR: RedirectRepoint[] = [{ alias: "opus-4-6", from: "claude-opus", to: "claude-opus-4" }];
const LIFECYCLE = readModelLifecycle((file) => readFileSync(file, "utf8"));
const ACTIVE = new Set(LIFECYCLE.rows.filter((r) => r.targetStatus === "active").map((r) => r.slug));
const OPUS_4: ModelLifecycle = { checkedAt: LIFECYCLE.checkedAt, rows: LIFECYCLE.rows.filter((r) => r.slug === "claude-opus-4") };

describe("redirect re-point plan (#329)", () => {
  // D58: the four alias groups.
  it("lists the four alias groups, each to the active lifecycle row of its tier and major", () => {
    expect(MODEL_REDIRECT_REPOINTS).toEqual([
      { alias: "opus-4-6", from: "claude-opus", to: "claude-opus-4" },
      { alias: "opus-4-5", from: "claude-opus", to: "claude-opus-4" },
      { alias: "sonnet-4-5", from: "claude-sonnet", to: "claude-sonnet-4" },
      { alias: "kimi-2-5", from: "kimi", to: "kimi-2" },
      { alias: "moonshot-kimi-2-5", from: "kimi", to: "kimi-2" },
      { alias: "deepseek-v3-2", from: "deepseek", to: "deepseek-base" },
    ]);
    const bySlug = new Map(LIFECYCLE.rows.map((r) => [r.slug, r]));
    const expected: Record<string, [string, number]> = {
      "claude-opus-4": ["claude-opus", 4],
      "claude-sonnet-4": ["claude-sonnet", 4],
      "kimi-2": ["kimi", 2],
      "deepseek-base": ["deepseek-base", 3],
    };
    for (const pair of MODEL_REDIRECT_REPOINTS) {
      const row = bySlug.get(pair.to)!;
      expect([row.line, row.major, row.targetStatus], pair.alias).toEqual([...expected[pair.to]!, "active"]);
    }
  });

  it.each<[string, Row[], ReadonlySet<string>, RegExp | "repoint" | "unchanged"]>([
    ["an alias at the expected target with a live new target", [alias("opus-4-6", "claude-opus"), target], new Set(), "repoint"],
    ["a new target the seed inserts in the same transaction", [alias("opus-4-6", "claude-opus")], new Set(["claude-opus-4"]), "repoint"],
    ["an alias already at the new target", [alias("opus-4-6", "claude-opus-4"), target], new Set(), "unchanged"],
    ["a missing alias", [target], new Set(), /no tools row/],
    ["an alias that is not a redirect", [alias("opus-4-6", "claude-opus", { status: "active" }), target], new Set(), /not a model redirect/],
    ["an alias at an unexpected target", [alias("opus-4-6", "claude-sonnet"), target], new Set(), /expected claude-opus/],
    ["a new target that does not exist", [alias("opus-4-6", "claude-opus")], new Set(), /status step can set active/],
    ["a new target that is itself a redirect", [alias("opus-4-6", "claude-opus"), { ...target, status: "redirect" }], new Set(), /status step can set active/],
    // D58: an inactive target is fine when the lifecycle sets it active earlier in the transaction.
    ["an inactive target the lifecycle sets active", [alias("opus-4-6", "claude-opus"), { ...target, status: "inactive" }], new Set(), "repoint"],
  ])("plans %s", async (_name, rows, pending, expected) => {
    const [plan] = await planRedirectRepoints(fakeDb(rows).db, PAIR, pending, ACTIVE);
    if (typeof expected === "string") expect(plan!.outcome).toBe(expected);
    else expect(plan).toMatchObject({ outcome: "refused", reason: expect.stringMatching(expected) });
  });
});

describe("redirect re-point target must be active (D58)", () => {
  it("refuses a target the lifecycle does not set active", async () => {
    const [plan] = await planRedirectRepoints(fakeDb([alias("opus-4-6", "claude-opus"), target]).db, PAIR, new Set(), new Set());
    expect(plan).toMatchObject({ outcome: "refused", reason: "new target claude-opus-4 is not active in the lifecycle" });
  });

  it("the guarded statement needs an active target", () => {
    expect(MODEL_REDIRECT_REPOINT_SQL).toMatch(/t\.kind = 'model' AND t\.status = 'active'\)/);
  });
});

describe("redirect re-point apply (#329)", () => {
  it("writes each re-point with the guarded statement", async () => {
    const { db, calls } = fakeDb([alias("opus-4-6", "claude-opus"), target]);
    const plans = await planRedirectRepoints(db, PAIR, new Set(), ACTIVE);
    expect(await applyRedirectRepoints(db, plans)).toBe(1);
    expect(calls.at(-1)).toEqual({ sql: MODEL_REDIRECT_REPOINT_SQL, params: ["opus-4-6", "claude-opus", "claude-opus-4"] });
    expect(MODEL_REDIRECT_REPOINT_SQL).toMatch(/status = 'redirect' AND data->>'redirect_to' = \$2/);
    expect(MODEL_REDIRECT_REPOINT_SQL).not.toMatch(/status\s*=\s*\$|SET\s+status/);
  });

  it("fails closed when the guarded statement matches no row", async () => {
    const { db } = fakeDb([alias("opus-4-6", "claude-opus"), target], () => []);
    const plans = await planRedirectRepoints(db, PAIR, new Set(), ACTIVE);
    await expect(applyRedirectRepoints(db, plans)).rejects.toThrow(/matched no row/);
  });

  it("the loader's dry run prints the re-point and writes nothing", async () => {
    const { db, calls } = fakeDb([alias("opus-4-6", "claude-opus"), target]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, [], false, (l) => lines.push(l), OPUS_4, PAIR)).toBe(0);
    expect(lines).toContain("would re-point redirect: opus-4-6: claude-opus -> claude-opus-4");
    expect(lines).toContain("redirects: 1 alias(es), 1 re-point, 0 unchanged, 0 refused");
    expect(calls.filter((c) => c.sql === MODEL_REDIRECT_REPOINT_SQL)).toHaveLength(0);
  });

  it("the loader writes nothing and exits 1 when a re-point is refused", async () => {
    const { db, calls } = fakeDb([alias("opus-4-6", "claude-sonnet"), target]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, [], true, (l) => lines.push(l), OPUS_4, PAIR)).toBe(1);
    expect(lines).toContain("REFUSED redirect: opus-4-6: alias redirects to claude-sonnet, expected claude-opus");
    expect(calls.filter((c) => c.sql === MODEL_REDIRECT_REPOINT_SQL)).toHaveLength(0);
  });
});
