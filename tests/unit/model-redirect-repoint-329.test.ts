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
import { loadModelSeeds } from "../../scripts/load-model-seeds";

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

describe("redirect re-point plan (#329)", () => {
  it("lists exactly the two Opus 4.x aliases, from claude-opus to claude-opus-4", () => {
    expect(MODEL_REDIRECT_REPOINTS).toEqual([
      { alias: "opus-4-6", from: "claude-opus", to: "claude-opus-4" },
      { alias: "opus-4-5", from: "claude-opus", to: "claude-opus-4" },
    ]);
  });

  it.each<[string, Row[], ReadonlySet<string>, RegExp | "repoint" | "unchanged"]>([
    ["an alias at the expected target with a live new target", [alias("opus-4-6", "claude-opus"), target], new Set(), "repoint"],
    ["a new target the seed inserts in the same transaction", [alias("opus-4-6", "claude-opus")], new Set(["claude-opus-4"]), "repoint"],
    ["an alias already at the new target", [alias("opus-4-6", "claude-opus-4"), target], new Set(), "unchanged"],
    ["a missing alias", [target], new Set(), /no tools row/],
    ["an alias that is not a redirect", [alias("opus-4-6", "claude-opus", { status: "active" }), target], new Set(), /not a model redirect/],
    ["an alias at an unexpected target", [alias("opus-4-6", "claude-sonnet"), target], new Set(), /expected claude-opus/],
    ["a new target that does not exist", [alias("opus-4-6", "claude-opus")], new Set(), /not a live model row/],
    ["a new target that is itself a redirect", [alias("opus-4-6", "claude-opus"), { ...target, status: "redirect" }], new Set(), /not a live model row/],
  ])("plans %s", async (_name, rows, pending, expected) => {
    const [plan] = await planRedirectRepoints(fakeDb(rows).db, PAIR, pending);
    if (typeof expected === "string") expect(plan!.outcome).toBe(expected);
    else expect(plan).toMatchObject({ outcome: "refused", reason: expect.stringMatching(expected) });
  });
});

describe("redirect re-point apply (#329)", () => {
  it("writes each re-point with the guarded statement", async () => {
    const { db, calls } = fakeDb([alias("opus-4-6", "claude-opus"), target]);
    const plans = await planRedirectRepoints(db, PAIR, new Set());
    expect(await applyRedirectRepoints(db, plans)).toBe(1);
    expect(calls.at(-1)).toEqual({ sql: MODEL_REDIRECT_REPOINT_SQL, params: ["opus-4-6", "claude-opus", "claude-opus-4"] });
    expect(MODEL_REDIRECT_REPOINT_SQL).toMatch(/status = 'redirect' AND data->>'redirect_to' = \$2/);
    expect(MODEL_REDIRECT_REPOINT_SQL).not.toMatch(/status\s*=\s*\$|SET\s+status/);
  });

  it("fails closed when the guarded statement matches no row", async () => {
    const { db } = fakeDb([alias("opus-4-6", "claude-opus"), target], () => []);
    const plans = await planRedirectRepoints(db, PAIR, new Set());
    await expect(applyRedirectRepoints(db, plans)).rejects.toThrow(/matched no row/);
  });

  it("the loader's dry run prints the re-point and writes nothing", async () => {
    const { db, calls } = fakeDb([alias("opus-4-6", "claude-opus"), target]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, [], false, (l) => lines.push(l), null, PAIR)).toBe(0);
    expect(lines).toContain("would re-point redirect: opus-4-6: claude-opus -> claude-opus-4");
    expect(lines).toContain("redirects: 1 alias(es), 1 re-point, 0 unchanged, 0 refused");
    expect(calls.filter((c) => c.sql === MODEL_REDIRECT_REPOINT_SQL)).toHaveLength(0);
  });

  it("the loader writes nothing and exits 1 when a re-point is refused", async () => {
    const { db, calls } = fakeDb([alias("opus-4-6", "claude-sonnet"), target]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, [], true, (l) => lines.push(l), null, PAIR)).toBe(1);
    expect(lines).toContain("REFUSED redirect: opus-4-6: alias redirects to claude-sonnet, expected claude-opus");
    expect(calls.filter((c) => c.sql === MODEL_REDIRECT_REPOINT_SQL)).toHaveLength(0);
  });
});
