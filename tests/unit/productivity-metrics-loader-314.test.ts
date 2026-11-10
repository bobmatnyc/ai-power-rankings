/**
 * #314: the productivity metrics loader on the real migration chain (PGlite), with 0027 and 0033.
 *
 * Why: D80 loads the reviewed figures into the nine 0027 rows and D69 ships that load with 0033.
 *   The claims are executor behaviour: the loader merges metrics, provenance and info without
 *   dropping keys or touching status, a re-run is a no-op, an invalid file or a refused row
 *   writes nothing, and after 0033 seven rows are active with metrics while gemini-app and
 *   mistral-vibe stay inactive with metrics.
 * What: chain 0000..0016 with the audit's tools, then 0017 and 0027 through `runMigrations
 *   --only`, then `runProductivityLoad` over the tracked `docs/refresh/productivity-metrics.json`
 *   (or a broken copy of it), then 0033. Whole-table snapshots prove "nothing written".
 * Test: `npx vitest run tests/unit/productivity-metrics-loader-314.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelSeedDb } from "../../lib/db/repositories/model-seed-writer";
import { RankingEngineV76 } from "../../lib/ranking-algorithm-v76";
import { PRODUCTIVITY_SLUGS } from "../../lib/db/repositories/productivity-metrics-seed";
import { runMigrations } from "../../scripts/apply-migrations";
import { runProductivityLoad } from "../../scripts/load-productivity-metrics";
import { chainDb, MIGRATION_FILES, REPO_ROOT, readMigration } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

// These tests run migrations and queries on PGlite, which can pass 5000 ms on a loaded machine.
vi.setConfig({ testTimeout: 60_000 });

const F17 = "0017_backfill_tool_kind.sql";
const F27 = "0027_create_productivity_rows.sql";
const F33 = "0033_activate_productivity_rows.sql";
const SEVEN = ["chatgpt", "genspark", "grok-app", "hermes-agent", "manus", "microsoft-copilot", "notion-ai"];
const EXCLUDED = ["gemini-app", "mistral-vibe"];
const NINE = [...PRODUCTIVITY_SLUGS];
const FILE_TEXT = readFileSync(path.join(REPO_ROOT, "docs/refresh/productivity-metrics.json"), "utf8");
type Json = Record<string, any>;
const FILE: Json = JSON.parse(FILE_TEXT);

let db: PGlite;

async function migrate(only: string) {
  const res = await runMigrations(
    { db: pgliteMigrationDb(db), files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
    { dryRun: false, only, showColumns: null, force: false }
  );
  expect(res.exitCode, only).toBe(0);
}

function asDb(pg: PGlite): ModelSeedDb {
  return {
    query: async (text, params) => ({ rows: (await pg.query(text, params)).rows }),
    transaction: (fn) => pg.transaction((tx) => fn({ query: async (text, params) => ({ rows: (await tx.query(text, params)).rows }) })),
  };
}

async function load(text: string, apply: boolean): Promise<{ code: number; log: string[] }> {
  const log: string[] = [];
  const code = await runProductivityLoad(asDb(db), text, { apply }, (l) => log.push(l));
  return { code, log };
}

/** Every tools row, keyed by slug: the "nothing written" snapshot. */
async function table(): Promise<Record<string, { status: string; data: Json; updated_at: unknown }>> {
  const r = await db.query<{ slug: string; status: string; data: Json; updated_at: unknown }>(
    `SELECT slug, status, data, updated_at FROM public."tools" ORDER BY slug`
  );
  return Object.fromEntries(r.rows.map(({ slug, ...rest }) => [slug, rest]));
}

/** The file's metric values for one tool, as data.metrics should hold them. */
function expectedMetrics(slug: string): Json {
  const out: Json = {};
  for (const [key, node] of Object.entries(FILE["tools"][slug]["metrics"] as Json)) {
    out[key] = "value" in node ? node.value : Object.fromEntries(Object.entries(node as Json).map(([k, v]) => [k, v.value]));
  }
  return out;
}

beforeEach(async () => {
  db = await chainDb(F17);
  await migrate(F17);
  await migrate(F27);
}, 120_000);
afterEach(async () => {
  await db.close();
});

describe("#314 load-productivity-metrics: 0027 -> loader -> 0033", () => {
  it("dry run writes nothing; apply writes all nine without changing status; 0033 activates only the seven", async () => {
    const start = await table();
    const dry = await load(FILE_TEXT, false);
    expect(dry.code).toBe(0);
    expect(dry.log.filter((l) => l.startsWith("would update: "))).toHaveLength(9);
    expect(dry.log).toContain("totals: 9 tool(s), 9 update, 0 unchanged, 0 refused");
    expect(await table()).toEqual(start);

    const applied = await load(FILE_TEXT, true);
    expect(applied.code, applied.log.join("\n")).toBe(0);
    expect(applied.log).toContain("apply: committed, 9 tool row(s) written");
    const loaded = await table();
    for (const slug of NINE) {
      const { status, data } = loaded[slug]!;
      // #314: the loader never changes status; every row is still as 0027 left it.
      expect(status, slug).toBe("inactive");
      expect(data["metrics"], slug).toEqual(expectedMetrics(slug));
      expect(data["createdBy"], slug).toBe("migration 0027_create_productivity_rows");
      expect(data["info"]["website"], slug).toBe(start[slug]!.data["info"]["website"]);
      expect(data["info"]["description"], slug).toBe(FILE["tools"][slug]["info"]["description"]);
      expect(data["info"]["features"], slug).toEqual(FILE["tools"][slug]["info"]["features"]);
      // #314 (#241): the same fields at the top level of data, where the engine reads them.
      expect(data["description"], slug).toBe(FILE["tools"][slug]["info"]["description"]);
      expect(data["features"], slug).toEqual(FILE["tools"][slug]["info"]["features"]);
      expect(data["company"], slug).toBe(FILE["tools"][slug]["info"]["company"]);
    }
    expect(loaded["grok-app"]!.data["metrics_provenance"]["valuation"]).toMatchObject({ scope: "parent", confidence: "low", source_type: "third_party" });
    expect(loaded["hermes-agent"]!.data["metrics_provenance"]["github.stars"]).toMatchObject({ scope: "product", as_of: "2026-11-10" });
    expect(loaded["mistral-vibe"]!.data["metrics_provenance"]["funding"]).toMatchObject({ currency: "EUR", scope: "parent" });
    // A null in the file is "not stated": chatgpt's base_price is not written.
    expect(loaded["chatgpt"]!.data["info"]["business"]).toEqual({ pricing_model: "freemium", free_tier: true });
    // D84 #5: grok-app pricing is null in the file, so no pricing is written.
    expect(loaded["grok-app"]!.data["info"]["business"]).toBeUndefined();
    const others = Object.keys(loaded).filter((s) => !NINE.includes(s as never));
    expect(others.map((s) => loaded[s])).toEqual(others.map((s) => start[s]));

    await migrate(F33);
    const after = await table();
    for (const slug of SEVEN) {
      expect(after[slug]!.status, slug).toBe("active");
      expect(after[slug]!.data["metrics"], slug).toEqual(expectedMetrics(slug));
    }
    for (const slug of EXCLUDED) {
      expect(after[slug]!.status, slug).toBe("inactive");
      expect(Object.keys(after[slug]!.data["metrics"]).length, slug).toBeGreaterThan(0);
    }
  });

  it("the engine reads the top-level fields: a loaded row scores higher innovation than the same row without them", async () => {
    expect((await load(FILE_TEXT, true)).code).toBe(0);
    const { data } = (await table())["chatgpt"]!;
    const { description: _d, features: _f, company: _c, ...infoOnly } = data;
    const innovation = (d: Json) =>
      new RankingEngineV76().calculateToolScore(
        { tool_id: "t", name: "ChatGPT", slug: "chatgpt", category: "productivity", status: "active", info: d, metrics: d["metrics"] } as never,
        new Date("2026-11-10")
      ).factorScores.innovation;
    expect(innovation(data)).toBeGreaterThan(innovation(infoOnly));
  });

  it("is a no-op on a re-run", async () => {
    expect((await load(FILE_TEXT, true)).code).toBe(0);
    const once = await table();
    const again = await load(FILE_TEXT, true);
    expect(again.code).toBe(0);
    expect(again.log).toContain("totals: 9 tool(s), 0 update, 9 unchanged, 0 refused");
    expect(await table()).toEqual(once);
  });

  const broken: Array<[string, (doc: Json) => string]> = [
    ["text that is not JSON", () => FILE_TEXT.slice(0, 200)],
    ["a metric with a string value", (d) => ((d["tools"]["manus"]["metrics"]["monthly_arr"]["value"] = "100M"), JSON.stringify(d))],
    ["a metric without source_url", (d) => (delete d["tools"]["chatgpt"]["metrics"]["users"]["source_url"], JSON.stringify(d))],
    ["an as_of that is not YYYY-MM-DD", (d) => ((d["tools"]["genspark"]["metrics"]["funding"]["as_of"] = "2026-06"), JSON.stringify(d))],
    ["a scope outside product|parent", (d) => ((d["tools"]["notion-ai"]["metrics"]["users"]["scope"] = "company"), JSON.stringify(d))],
    ["a metric key the engine does not read", (d) => ((d["tools"]["manus"]["metrics"]["revenue"] = d["tools"]["manus"]["metrics"]["monthly_arr"]), JSON.stringify(d))],
    ["a non-allowlisted slug", (d) => ((d["tools"]["cursor"] = d["tools"]["manus"]), JSON.stringify(d))],
  ];
  it.each(broken)("aborts with exit 1 and writes nothing on %s", async (_name, breakIt) => {
    const start = await table();
    for (const apply of [false, true]) {
      const res = await load(breakIt(JSON.parse(FILE_TEXT)), apply);
      expect(res.code).toBe(1);
      expect(res.log[0]).toMatch(/^ERROR: metrics validation failed, nothing written: /);
    }
    expect(await table()).toEqual(start);
  });

  it("names the non-allowlisted slug in the refusal", async () => {
    const doc = JSON.parse(FILE_TEXT);
    doc["tools"]["cursor"] = doc["tools"]["manus"];
    const res = await load(JSON.stringify(doc), true);
    expect(res.log[0]).toContain("tools.cursor: slug is not one of the nine productivity slugs");
  });

  // #314: the error arm. Removing the loader's `if (refused > 0)` apply branch makes this fail:
  // the eight eligible rows would be written while manus is refused.
  it("writes nothing to any row when one row is refused (no 0027 marker, wrong kind)", async () => {
    await db.query(`UPDATE public."tools" SET data = data - 'createdBy' WHERE slug = 'manus'`);
    await db.query(`UPDATE public."tools" SET kind = 'harness' WHERE slug = 'notion-ai'`);
    const start = await table();
    const res = await load(FILE_TEXT, true);
    expect(res.code).toBe(1);
    expect(res.log).toContain("REFUSED: manus: row does not carry the 0027 marker (data.createdBy); it was not created by 0027");
    expect(res.log).toContain("REFUSED: notion-ai: slug is held by a harness row, not productivity");
    expect(res.log).toContain("apply: nothing written because a row was refused");
    expect(await table()).toEqual(start);
  });

  it("0033 activates exactly the file's include_in_0033 tools", () => {
    const included = Object.entries(FILE["tools"] as Json).filter(([, t]) => t["include_in_0033"] === true).map(([s]) => s).sort();
    expect(included).toEqual(SEVEN);
    const array = /slugs constant text\[\] := ARRAY\[([^\]]*)\]/.exec(readMigration(F33))?.[1] ?? "";
    expect([...array.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual(SEVEN);
  });
});
