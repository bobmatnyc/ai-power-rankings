/**
 * D90: the duplicate-tool merge on real Postgres (PGlite).
 *
 * Why: the merge's claims — the dry run writes nothing under a read-only session, two old
 *   rows merging into one target settle without a unique violation, the apply retires the
 *   old rows out of the generator's `status='active'` read, and a re-run is a no-op — are
 *   executor and constraint behaviour, so they run on the schema the migration files build.
 * What: builds the chain to 0017 with the audit's tools, seeds links and metrics rows on
 *   the old ids, and drives `runMerge` through each mode. A second database without the
 *   `openclaw` row proves a missing target fails the dry run and refuses the apply.
 * Test: `npx vitest run tests/unit/duplicate-tool-merge-d90.test.ts`. No server, no network.
 */

import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkBackup } from "../../scripts/duplicate-tool-merge-apply";
import { derivePairs, type MergeDb, planMerge, loadMergeState } from "../../scripts/duplicate-tool-merge";
import { runMigrations } from "../../scripts/apply-migrations";
import { type MergeMode, parseArgs, runMerge } from "../../scripts/merge-duplicate-tools";
import { chainDb, MIGRATION_FILES, readMigration } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const BACKFILL = "0017_backfill_tool_kind.sql";
const FINGERPRINT = "sha256:0123456789abcdef";
const NOW = new Date("2026-10-30T12:00:00Z");
const OLD = ["bytedance-seedance-2-0", "clawdbot", "cowork-ai", "deepseek-r1", "deepseek-v3-2", "model-context-protocol-mcp-", "moltbot"];

/** A MergeDb over PGlite that records every statement and every transaction it opens. */
function recording(db: PGlite, statements: string[]): MergeDb {
  return {
    query: (text, params) => {
      statements.push(text);
      return db.query(text, params);
    },
    transaction: (fn) => {
      statements.push("BEGIN");
      return db.transaction((tx) =>
        fn({
          query: (text, params) => {
            statements.push(text);
            return tx.query(text, params);
          },
        })
      );
    },
  };
}

async function id(db: PGlite, slug: string): Promise<string> {
  return (await db.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug])).rows[0]!.id;
}

async function link(db: PGlite, model: string, harness: string, relation: string) {
  await db.query(`INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation) VALUES ($1, $2, $3)`, [
    await id(db, model),
    await id(db, harness),
    relation,
  ]);
}

async function metric(db: PGlite, slug: string, day: string) {
  await db.query(
    `INSERT INTO public."tool_metrics_history" (tool_id, tool_slug, collected_date, period) VALUES ($1, $2, $3, '2026-10')`,
    [await id(db, slug), slug, day]
  );
}

/** Every row the merge can touch, as text, for before/after equality. */
async function snapshot(db: PGlite) {
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    tools: await q(`SELECT slug, status, data::text, updated_at::text FROM public."tools" ORDER BY slug`),
    links: await q(`SELECT id, model_tool_id, harness_tool_id, relation, updated_at::text FROM public."tool_links" ORDER BY id`),
    metrics: await q(`SELECT id, tool_id, collected_date::text, updated_at::text FROM public."tool_metrics_history" ORDER BY id`),
  };
}

async function linkPairs(db: PGlite): Promise<string[]> {
  const rows = await db.query<{ p: string }>(
    `SELECT m.slug || ' x ' || h.slug || ' ' || l.relation AS p FROM public."tool_links" l
     JOIN public."tools" m ON m.id = l.model_tool_id JOIN public."tools" h ON h.id = l.harness_tool_id ORDER BY 1`
  );
  return rows.rows.map((r) => r.p);
}

async function run(db: PGlite, mode: MergeMode, statements: string[] = []) {
  const log: string[] = [];
  const code = await runMerge({ db: recording(db, statements), fingerprint: FINGERPRINT, log: (l) => log.push(l), now: () => NOW }, mode);
  return { code, log, statements };
}

const dir = mkdtempSync(path.join(os.tmpdir(), "d90-merge-"));

describe("D90 pairs", () => {
  it("derives the seven pairs from the signed URL table", () => {
    expect(derivePairs().map((p) => `${p.oldSlug}->${p.newSlug}`)).toEqual([
      "bytedance-seedance-2-0->seedance-2-0",
      "clawdbot->openclaw",
      "cowork-ai->cowork",
      "deepseek-r1->deepseek",
      "deepseek-v3-2->deepseek",
      "model-context-protocol-mcp-->model-context-protocol",
      "moltbot->openclaw",
    ]);
    expect(() => derivePairs(["no-such-tool"])).toThrow(/no \/en\/tools 308 row/);
  });

  it("parses one mode; --backup and --apply need a path", () => {
    expect(parseArgs([]).mode).toEqual({ mode: "dry-run" });
    expect(parseArgs(["--apply", "b.json"]).mode).toEqual({ mode: "apply", backupFile: "b.json" });
    expect(parseArgs(["--apply"]).errors).toEqual(["--apply needs a file path"]);
    expect(parseArgs(["--backup", "b.json", "--dry-run"]).errors).toEqual(["pass one mode only"]);
  });
});

describe("D90 merge on the migration chain", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await chainDb(BACKFILL);
    const backfill = await runMigrations(
      { db: pgliteMigrationDb(db), files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
      { dryRun: false, only: BACKFILL, showColumns: null, force: false }
    );
    expect(backfill.exitCode).toBe(0);
    await link(db, "deepseek", "kiro", "supports"); // already on the target
    await link(db, "deepseek-r1", "kiro", "native"); // collides with the target's row
    await link(db, "deepseek-r1", "goose", "supports"); // moves
    await link(db, "deepseek-v3-2", "goose", "supports"); // two-to-one clash with the row above
    await link(db, "deepseek-v3-2", "cursor", "supports"); // moves
    await link(db, "opus-4-6", "clawdbot", "native"); // moves to openclaw
    await link(db, "opus-4-6", "moltbot", "native"); // two-to-one clash on the harness side
    await metric(db, "deepseek-r1", "2026-10-01");
    await metric(db, "deepseek-v3-2", "2026-10-01"); // same day as the row above
    await metric(db, "deepseek", "2026-10-02");
    await metric(db, "deepseek-r1", "2026-10-02"); // same day as the target's row
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it("dry run issues SELECTs only, passes under a read-only session and changes nothing", async () => {
    const before = await snapshot(db);
    await db.exec("SET default_transaction_read_only = on");
    const { code, log, statements } = await run(db, { mode: "dry-run" });
    await db.exec("SET default_transaction_read_only = off");
    expect(code).toBe(0);
    expect(statements.length).toBeGreaterThan(0);
    for (const s of statements) expect(s.trim()).toMatch(/^SELECT\b/);
    expect(await snapshot(db)).toEqual(before);
    expect(log).toContain("  link: would drop deepseek-v3-2 x goose (supports): deepseek x goose already exists, kept");
    expect(log).toContain("  link: would drop opus-4-6 x moltbot (native): opus-4-6 x openclaw already exists, kept");
    expect(log).toContain(
      "  link: would drop deepseek-r1 x kiro (native): deepseek x kiro already exists, kept; relation differs, kept row is supports"
    );
    expect(log.at(-2)).toBe(
      "totals: 7 pair(s), 0 unresolved; links moved 3, dropped 3; metrics re-pointed 1, nulled 2; rows retired 7"
    );
    expect(log.join("\n")).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no ids in the output
  });

  it("backup is SELECT-only, holds every affected row, and never overwrites", async () => {
    const file = path.join(dir, "backup.json");
    const { code, log, statements } = await run(db, { mode: "backup", file });
    expect(code).toBe(0);
    for (const s of statements) expect(s.trim()).toMatch(/^SELECT\b/);
    expect(log).toEqual([`backup: wrote ${file}: 12 tools, 6 tool_links, 3 tool_metrics_history row(s)`]);
    await expect(run(db, { mode: "backup", file })).rejects.toThrow(/EEXIST/);
  });

  it("apply refuses a stale or missing backup and writes nothing", async () => {
    const before = await snapshot(db);
    const stale = path.join(dir, "stale.json");
    const backup = JSON.parse(readFileSync(path.join(dir, "backup.json"), "utf8"));
    writeFileSync(stale, JSON.stringify({ ...backup, taken_at: "2026-10-29T00:00:00Z" }));
    const refused = await run(db, { mode: "apply", backupFile: stale });
    expect(refused.code).toBe(1);
    expect(refused.log.at(-1)).toMatch(/^--apply: refused, nothing written: the backup is not fresh/);
    expect((await run(db, { mode: "apply", backupFile: path.join(dir, "absent.json") })).code).toBe(1);
    expect(await snapshot(db)).toEqual(before);
  });

  it("apply refuses a backup that lacks the tool_links or metrics rows it would change", async () => {
    const before = await snapshot(db);
    const backup = JSON.parse(readFileSync(path.join(dir, "backup.json"), "utf8"));
    const noLinks = path.join(dir, "no-links.json");
    const noMetrics = path.join(dir, "no-metrics.json");
    writeFileSync(noLinks, JSON.stringify({ ...backup, tool_links: [] }));
    writeFileSync(noMetrics, JSON.stringify({ ...backup, tool_metrics_history: [] }));
    const links = await run(db, { mode: "apply", backupFile: noLinks });
    expect(links.code).toBe(1);
    expect(links.log.at(-1)).toBe("--apply: refused, nothing written: the backup lacks a tool_links row of clawdbot");
    const metrics = await run(db, { mode: "apply", backupFile: noMetrics });
    expect(metrics.code).toBe(1);
    expect(metrics.log.at(-1)).toBe("--apply: refused, nothing written: the backup lacks a metrics row of deepseek-r1");
    expect(await snapshot(db)).toEqual(before);
  });

  it("a failed read-back before commit rolls back every write", async () => {
    const before = await snapshot(db);
    // Fault: the retire UPDATEs report success but never run, so the read-back finds old rows still active.
    const faulty: MergeDb = {
      query: (text, params) => db.query(text, params),
      transaction: (fn) =>
        db.transaction((tx) =>
          fn({ query: (text, params) => (/^\s*UPDATE public\."tools"/.test(text) ? Promise.resolve({ rows: [] }) : tx.query(text, params)) })
        ),
    };
    const log: string[] = [];
    const code = await runMerge(
      { db: faulty, fingerprint: FINGERPRINT, log: (l) => log.push(l), now: () => NOW },
      { mode: "apply", backupFile: path.join(dir, "backup.json") }
    );
    expect(code).toBe(1);
    expect(log.at(-1)).toMatch(/^--apply: rolled back, nothing written: merge verification failed: bytedance-seedance-2-0 is active/);
    expect(await snapshot(db)).toEqual(before);
  });

  it("apply moves the links, settles the clash and retires the old rows in one transaction", async () => {
    const { code, log, statements } = await run(db, { mode: "apply", backupFile: path.join(dir, "backup.json") });
    expect(code).toBe(0);
    expect(log.at(-1)).toBe("--apply: committed (merged)");
    expect(statements.filter((s) => s === "BEGIN")).toHaveLength(1);
    // The plan inside the transaction is built from locked rows: tools, links and metrics.
    const load = statements.slice(statements.indexOf("BEGIN") + 1, statements.indexOf("BEGIN") + 4);
    expect(load.map((s) => s.match(/FOR UPDATE( OF l)?$/)?.[0] ?? s.slice(0, 40))).toEqual(["FOR UPDATE", "FOR UPDATE OF l", "FOR UPDATE"]);
    expect(await linkPairs(db)).toEqual([
      "deepseek x cursor supports",
      "deepseek x goose supports",
      "deepseek x kiro supports",
      "opus-4-6 x openclaw native",
    ]);
    const old = await db.query<{ slug: string; status: string; to: string }>(
      `SELECT slug, status, data->>'redirect_to' AS "to" FROM public."tools" WHERE slug = ANY($1::text[]) ORDER BY slug`,
      [OLD]
    );
    expect(old.rows.every((r) => r.status === "redirect")).toBe(true);
    expect(Object.fromEntries(old.rows.map((r) => [r.slug, r.to]))).toMatchObject({ "deepseek-r1": "deepseek", moltbot: "openclaw" });
    // The ranking generator's read (`status = 'active'`) no longer returns an old row.
    const active = await db.query<{ slug: string }>(`SELECT slug FROM public."tools" WHERE status = 'active'`);
    expect(active.rows.map((r) => r.slug).filter((slug) => OLD.includes(slug))).toEqual([]);
    const metrics = await db.query<{ slug: string | null; n: number }>(
      `SELECT t.slug, count(*)::int AS n FROM public."tool_metrics_history" m LEFT JOIN public."tools" t ON t.id = m.tool_id GROUP BY 1 ORDER BY 1`
    );
    expect(metrics.rows).toEqual([
      { slug: "deepseek", n: 2 },
      { slug: null, n: 2 },
    ]);
  });

  it("a re-run is a no-op, and the dry run then reports every pair already merged", async () => {
    const before = await snapshot(db);
    const again = await run(db, { mode: "apply", backupFile: path.join(dir, "backup.json") });
    expect(again.code).toBe(0);
    expect(again.log.at(-1)).toBe("--apply: committed (no-op, already merged)");
    expect(await snapshot(db)).toEqual(before);
    const dry = await run(db, { mode: "dry-run" });
    expect(dry.code).toBe(0);
    expect(dry.log.filter((l) => l.endsWith("[already-merged]"))).toHaveLength(7);
  });

  // D58: after the per-major re-point the old row redirects to deepseek-base, not to the pair's
  // applied target, so a re-run must refuse the pair and write nothing, even with work pending.
  it("a re-run after the D58 re-point refuses the re-pointed pair and writes nothing", async () => {
    await db.query(`UPDATE public."tools" SET data = data || '{"redirect_to": "deepseek-base"}'::jsonb WHERE slug = 'deepseek-v3-2'`);
    await link(db, "deepseek-v3-2", "kiro", "native"); // a link on the retired id: work the merge would do
    const file = path.join(dir, "after-d58.json");
    expect((await run(db, { mode: "backup", file })).code).toBe(0);
    const before = await snapshot(db);
    const dry = await run(db, { mode: "dry-run" });
    expect(dry.code).toBe(1);
    expect(dry.log.map((l) => l.trim())).toContain("UNRESOLVED: old row deepseek-v3-2 already redirects to deepseek-base");
    const apply = await run(db, { mode: "apply", backupFile: file });
    expect(apply.code).toBe(1);
    expect(apply.log.at(-1)).toMatch(/^--apply: refused, nothing written: /);
    expect(await snapshot(db)).toEqual(before);
  });
});

describe("D90 merge with a target row missing", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await chainDb(BACKFILL, ["openclaw"]);
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it("the dry run names the unresolved pairs and exits 1; the apply refuses and writes nothing", async () => {
    const dry = await run(db, { mode: "dry-run" });
    expect(dry.code).toBe(1);
    expect(dry.log.filter((l) => l === "  UNRESOLVED: target row openclaw is missing")).toHaveLength(2);
    expect(dry.log.at(-2)).toMatch(/^totals: 7 pair\(s\), 2 unresolved;/);

    const file = path.join(dir, "missing-target.json");
    expect((await run(db, { mode: "backup", file })).code).toBe(0);
    const before = await snapshot(db);
    const apply = await run(db, { mode: "apply", backupFile: file });
    expect(apply.code).toBe(1);
    expect(apply.log.at(-1)).toBe("--apply: refused, nothing written: 2 pair(s) unresolved");
    expect(await snapshot(db)).toEqual(before);
  });

  it("the backup gate refuses another database, another kind and a row the backup lacks", async () => {
    const pairs = derivePairs();
    const plan = planMerge(pairs, await loadMergeState(db, pairs));
    const backup = JSON.parse(readFileSync(path.join(dir, "missing-target.json"), "utf8"));
    expect(checkBackup(JSON.stringify(backup), FINGERPRINT, plan, NOW)).toEqual({ ok: true });
    expect(checkBackup(JSON.stringify(backup), "sha256:ffffffffffffffff", plan, NOW)).toEqual({ ok: false, reason: "the backup is from another database" });
    expect(checkBackup("{}", FINGERPRINT, plan, NOW).ok).toBe(false);
    expect(checkBackup(JSON.stringify({ ...backup, tools: [] }), FINGERPRINT, plan, NOW)).toEqual({
      ok: false,
      reason: "the backup lacks the bytedance-seedance-2-0 row",
    });
    expect(existsSync(path.join(dir, "missing-target.json"))).toBe(true);
  });
});
