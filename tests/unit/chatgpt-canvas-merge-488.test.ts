/**
 * #488: the ChatGPT Canvas merge (chatgpt-canvas into chatgpt, owner ruling (a)).
 *
 * Why: the merge rewrites Canvas's ranking history and article mentions in production JSON
 *   columns, so the plan, the conflict rule (ChatGPT's entry kept, Canvas's left and
 *   reported), the backup gate and the one-transaction apply must be proven before dispatch.
 * What: pure tests of `checkCanvasRows` and `planCanvasRepoint`; then `runMerge --set
 *   chatgpt-canvas` on the migration chain (PGlite) with metrics history, three boards, a
 *   ranking snapshot and four articles: dry run, backup, refusals, apply, re-run.
 * Test: `npx vitest run tests/unit/chatgpt-canvas-merge-488.test.ts`. No server, no network.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations, splitStatements } from "../../scripts/apply-migrations";
import {
  CANVAS_SURVIVOR,
  type CanvasDoc,
  type CanvasToolRow,
  checkCanvasRows,
  identOf,
  planCanvasRepoint,
} from "../../scripts/chatgpt-canvas-merge";
import { derivePairs, MERGE_SETS, type MergeDb } from "../../scripts/duplicate-tool-merge";
import { backupId, type MergeMode, parseArgs, runMerge } from "../../scripts/merge-duplicate-tools";
import { chainDb, MIGRATION_FILES, readMigration } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const NOW = new Date("2026-11-24T12:00:00Z");
const FINGERPRINT = "sha256:0123456789abcdef";
const CANVAS_UUID = "00000000-0000-4000-8000-000000000018";
const SET = MERGE_SETS["chatgpt-canvas"];

const tool = (over: Partial<CanvasToolRow>): CanvasToolRow => ({
  id: CANVAS_UUID,
  slug: "chatgpt-canvas",
  name: "ChatGPT Canvas",
  status: "active",
  kind: "productivity",
  data: { id: "18" },
  ...over,
});
const canvasRow = tool({});
const chatgptRow = tool({ id: CANVAS_SURVIVOR.id, slug: "chatgpt", name: "ChatGPT", data: {} });

describe("the #488 merge set", () => {
  it("derives chatgpt-canvas -> chatgpt from the URL table and has its own confirmation", () => {
    expect(derivePairs(SET.oldSlugs)).toEqual([{ oldSlug: "chatgpt-canvas", newSlug: "chatgpt" }]);
    expect(SET.confirm).toBe("merge-chatgpt-canvas");
    expect(new Set(Object.values(MERGE_SETS).map((s) => s.confirm)).size).toBe(Object.keys(MERGE_SETS).length);
  });

  it("parses --set chatgpt-canvas and refuses an unknown or prototype set name", () => {
    expect(parseArgs(["--set", "chatgpt-canvas", "--dry-run"]).set).toBe(SET);
    expect(parseArgs([]).set).toBe(MERGE_SETS.d90);
    expect(parseArgs(["--set", "constructor"]).errors).toEqual(["--set needs one of d90, codex, chatgpt-canvas"]);
  });
});

describe("checkCanvasRows (#488)", () => {
  it("passes an active pair as a merge and a redirected Canvas as already merged", () => {
    expect(checkCanvasRows([canvasRow, chatgptRow])).toMatchObject({ ok: true, state: "merge", kind: "productivity" });
    const retired = tool({ status: "redirect", data: { id: "18", redirect_to: "chatgpt" } });
    expect(checkCanvasRows([retired, chatgptRow])).toMatchObject({ ok: true, state: "already-merged" });
  });

  it.each([
    ["a missing survivor", [canvasRow], "row chatgpt is missing"],
    ["another chatgpt row", [canvasRow, { ...chatgptRow, id: "00000000-0000-4000-8000-000000000099" }], "chatgpt is not the row named on #488"],
    ["an inactive survivor", [canvasRow, { ...chatgptRow, status: "inactive" }], "chatgpt is inactive, expected active"],
    ["different kinds", [{ ...canvasRow, kind: "harness" }, chatgptRow], "kinds differ (harness vs productivity)"],
    ["a shared stored id", [canvasRow, { ...chatgptRow, data: { id: "18" } }], "the two rows share a stored id"],
    ["Canvas redirecting elsewhere", [tool({ status: "redirect", data: { redirect_to: "openai" } }), chatgptRow], 'chatgpt-canvas is redirect (redirect_to "openai")'],
  ])("refuses %s", (_label, rows, problem) => {
    const check = checkCanvasRows(rows as CanvasToolRow[]);
    expect(check.ok).toBe(false);
    expect(check.ok ? [] : check.problems).toContain(problem);
  });
});

describe("planCanvasRepoint: the conflict rule (#488)", () => {
  const old = identOf(canvasRow);
  const s = identOf(chatgptRow);
  const doc = (table: CanvasDoc["table"], label: string, value: unknown): CanvasDoc => ({ table, id: label, label, doc: value });

  it("re-points a board entry by name, slug or legacy id, keeping the stored shape and the id's form", () => {
    const plan = planCanvasRepoint(
      [
        doc("rankings", "a", [{ tool_id: "18", tool_name: "ChatGPT Canvas", position: 6 }, { tool_id: "1", tool_name: "Cursor" }]),
        doc("rankings", "b", { rankings: [{ tool_id: CANVAS_UUID, tool_slug: "chatgpt-canvas", rank: 3 }] }),
        doc("ranking_versions", "c", { data: [{ tool_id: "18", rank: 2 }] }),
      ],
      old,
      s
    );
    expect(plan.actions.map((a) => [a.label, a.action])).toEqual([["a", "repoint"], ["b", "repoint"], ["c", "repoint"]]);
    expect(plan.actions[0]!.next).toEqual([{ tool_id: CANVAS_SURVIVOR.id, tool_name: "ChatGPT", position: 6 }, { tool_id: "1", tool_name: "Cursor" }]);
    expect(plan.actions[1]!.next).toEqual({ rankings: [{ tool_id: CANVAS_SURVIVOR.id, tool_slug: "chatgpt", rank: 3 }] });
    expect(plan.actions[2]!.next).toEqual({ data: [{ tool_id: CANVAS_SURVIVOR.id, rank: 2 }] });
    expect(plan.totals.rankings).toMatchObject({ scanned: 2, repoint: 2, entries: 2, collision: 0, unresolved: 0 });
  });

  it("keeps ChatGPT's entry when the same board, snapshot or article holds both, and writes nothing there", () => {
    const board = [{ tool_slug: "chatgpt", tool_name: "ChatGPT", rank: 1 }, { tool_slug: "chatgpt-canvas", tool_name: "ChatGPT Canvas", rank: 3 }];
    const plan = planCanvasRepoint(
      [doc("rankings", "p", board), doc("ranking_versions", "v", { rankings: board }), doc("articles", "x", [{ tool: "ChatGPT" }, "ChatGPT Canvas"])],
      old,
      s
    );
    expect(plan.actions.map((a) => [a.table, a.action, a.next])).toEqual([
      ["rankings", "collision", undefined],
      ["ranking_versions", "collision", undefined],
      ["articles", "collision", undefined],
    ]);
    expect(plan.unresolved).toBe(0);
  });

  it("marks a Canvas id under another name, or two Canvas entries on one board, unresolved", () => {
    const plan = planCanvasRepoint(
      [
        doc("rankings", "m", [{ tool_id: "18", tool_name: "Some Other Tool" }]),
        doc("rankings", "d", [{ tool_slug: "chatgpt-canvas" }, { tool_name: "ChatGPT Canvas" }]),
      ],
      old,
      s
    );
    expect(plan.actions.map((a) => [a.action, a.problem])).toEqual([
      ["unresolved", "1 entry(ies) carry a Canvas tool_id under another name"],
      ["unresolved", "2 Canvas entries on one board"],
    ]);
    expect(plan.unresolved).toBe(2);
  });

  it("renames each stored mention shape and leaves raw_tool and other tools alone", () => {
    const plan = planCanvasRepoint(
      [
        doc("articles", "a", ["ChatGPT Canvas", "Cursor"]),
        doc("articles", "b", [{ tool: "chatgpt canvas", raw_tool: "ChatGPT Canvas", toolId: "chatgpt-canvas" }]),
        doc("articles", "c", [{ name: "ChatGPT Canvas", relevance: 0.5 }]),
        doc("articles", "d", [{ tool: "Cursor", raw_tool: "ChatGPT Canvas" }]),
      ],
      old,
      s
    );
    expect(plan.actions.map((a) => [a.label, a.next])).toEqual([
      ["a", ["ChatGPT", "Cursor"]],
      ["b", [{ tool: "ChatGPT", raw_tool: "ChatGPT Canvas", toolId: "chatgpt" }]],
      ["c", [{ name: "ChatGPT", relevance: 0.5 }]],
    ]);
    expect(plan.totals.articles).toMatchObject({ scanned: 4, repoint: 3, entries: 3 });
  });
});

/** A MergeDb over PGlite that records every statement. */
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

async function snapshot(db: PGlite) {
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    tools: await q(`SELECT slug, status, data::text FROM public."tools" WHERE slug IN ('chatgpt', 'chatgpt-canvas') ORDER BY slug`),
    metrics: await q(`SELECT id, tool_id, collected_date::text FROM public."tool_metrics_history" ORDER BY id`),
    rankings: await q(`SELECT period, list, data::text FROM public."rankings" ORDER BY period, list`),
    versions: await q(`SELECT version, rankings_snapshot::text FROM public."ranking_versions" ORDER BY version`),
    articles: await q(`SELECT slug, tool_mentions::text FROM public."articles" ORDER BY slug`),
  };
}

// Production holds ranking_versions from a migration that is not in the repository (0002..0011).
const RANKING_VERSIONS_DDL = `CREATE TABLE IF NOT EXISTS public."ranking_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" varchar(50) NOT NULL UNIQUE,
  "rankings_snapshot" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
)`;

describe("runMerge --set chatgpt-canvas on the migration chain (#488)", () => {
  let db: PGlite;
  let chatgptId = "";
  let canvasId = "";
  const dir = mkdtempSync(path.join(os.tmpdir(), "canvas-merge-488-"));
  const run = async (mode: MergeMode, statements: string[] = []) => {
    const log: string[] = [];
    const code = await runMerge({ db: recording(db, statements), fingerprint: FINGERPRINT, log: (l) => log.push(l), now: () => NOW }, mode, SET);
    return { code, log, statements };
  };
  const board = (period: string, list: string, data: unknown, current = false) =>
    db.query(`INSERT INTO public."rankings" (period, algorithm_version, is_current, list, data) VALUES ($1, '8.1', $2, $3, $4::jsonb)`, [
      period,
      current,
      list,
      JSON.stringify(data),
    ]);
  const article = (slug: string, mentions: unknown[]) =>
    db.query(`INSERT INTO public."articles" (slug, title, content, ingestion_type, tool_mentions) VALUES ($1, $1, 'x', 'url', $2::jsonb)`, [
      slug,
      JSON.stringify(mentions),
    ]);

  beforeAll(async () => {
    const backfill = "0017_backfill_tool_kind.sql";
    db = await chainDb(backfill);
    const files = { list: () => [...MIGRATION_FILES], read: readMigration };
    expect((await runMigrations({ db: pgliteMigrationDb(db), files, log: () => {} }, { dryRun: false, only: backfill, showColumns: null, force: false })).exitCode).toBe(0);
    for (const file of MIGRATION_FILES.filter((f) => f.startsWith("0020") || f.startsWith("0021"))) {
      for (const statement of splitStatements(readMigration(file))) await db.exec(statement);
    }
    await db.exec(RANKING_VERSIONS_DDL);
    // As production after 0028 (#314): both rows are productivity; Canvas carries legacy data.id 18.
    await db.query(
      `INSERT INTO public."tools" (id, slug, name, category, status, kind, data) VALUES ($1, 'chatgpt', 'ChatGPT', 'productivity', 'active', 'productivity', '{"name": "ChatGPT"}'::jsonb)`,
      [CANVAS_SURVIVOR.id]
    );
    await db.query(`UPDATE public."tools" SET kind = 'productivity', subcategory = NULL, data = data || '{"id": "18"}'::jsonb WHERE slug = 'chatgpt-canvas'`);
    chatgptId = CANVAS_SURVIVOR.id;
    canvasId = (await db.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = 'chatgpt-canvas'`)).rows[0]!.id;
    for (const [id, slug, day] of [
      [canvasId, "chatgpt-canvas", "2026-10-01"],
      [canvasId, "chatgpt-canvas", "2026-11-01"],
      [chatgptId, "chatgpt", "2026-11-01"],
    ]) {
      await db.query(`INSERT INTO public."tool_metrics_history" (tool_id, tool_slug, collected_date, period) VALUES ($1, $2, $3, '2026-11')`, [id, slug, day]);
    }
    await board("2025-06", "combined", [{ tool_id: "18", tool_name: "ChatGPT Canvas", position: 6, score: 58.98 }, { tool_id: "1", tool_name: "Claude Code", position: 1 }]);
    await board("2025-07", "combined", { rankings: [{ tool_id: "18", position: 4 }] });
    await board("2026-10", "harness", [{ tool_slug: "cursor", tool_name: "Cursor", rank: 1 }]);
    await board(
      "2026-11",
      "productivity",
      [
        { tool_id: chatgptId, tool_slug: "chatgpt", tool_name: "ChatGPT", rank: 1 },
        { tool_id: canvasId, tool_slug: "chatgpt-canvas", tool_name: "ChatGPT Canvas", rank: 3 },
      ],
      true
    );
    await db.query(`INSERT INTO public."ranking_versions" (version, rankings_snapshot) VALUES ('1.0.0', $1::jsonb)`, [
      JSON.stringify({ data: [{ tool_id: "18", tool_name: "ChatGPT Canvas", rank: 6 }] }),
    ]);
    await article("a1", [{ tool: "ChatGPT Canvas", relevance: 0.9 }]);
    await article("a2", ["ChatGPT Canvas", "Cursor"]);
    await article("a3", [{ tool: "ChatGPT" }, { tool: "ChatGPT Canvas" }]);
    await article("a4", [{ tool: "Cursor" }]);
  }, 120_000);

  afterAll(async () => {
    await db.close();
  });

  it("dry run issues SELECTs only under a read-only session, prints what would move, and changes nothing", async () => {
    const before = await snapshot(db);
    await db.exec("SET default_transaction_read_only = on");
    const { code, log, statements } = await run({ mode: "dry-run" });
    await db.exec("SET default_transaction_read_only = off");
    expect(code).toBe(0);
    for (const s of statements) expect(s.trim()).toMatch(/^SELECT\b/);
    expect(await snapshot(db)).toEqual(before);
    expect(log).toEqual(
      expect.arrayContaining([
        "pair 1/1: chatgpt-canvas -> chatgpt [merge]",
        "  metrics history: would re-point 1, set tool_id NULL on 1 (date collision)",
        "  retire: would set chatgpt-canvas status active -> redirect, data.redirect_to chatgpt",
        "chatgpt-canvas: guards passed; state merge; kind productivity",
        "chatgpt-canvas: rankings: would re-point 2 entry(ies) in 2 board(s); 1 collision(s) keep ChatGPT's entry; 0 unresolved (3 scanned)",
        "  board 2025-06 combined: would re-point 1 entry(ies) to chatgpt",
        "  board 2025-07 combined: would re-point 1 entry(ies) to chatgpt",
        "  board 2026-11 productivity: collision: chatgpt already present, kept; 1 chatgpt-canvas entry(ies) left as is",
        "chatgpt-canvas: ranking_versions: would re-point 1 entry(ies) in 1 snapshot(s); 0 collision(s) keep ChatGPT's entry; 0 unresolved (1 scanned)",
        "chatgpt-canvas: articles: would re-point 2 entry(ies) in 2 article(s); 1 collision(s) keep ChatGPT's entry; 0 unresolved (3 scanned)",
        "  article a3: collision: chatgpt already present, kept; 1 chatgpt-canvas entry(ies) left as is",
        "totals: chatgpt-canvas json: 5 document(s) re-pointed (5 entries), 2 collision(s), 0 unresolved",
      ])
    );
    expect(log.at(-1)).toBe("dry run: nothing written (pass --apply <backup-file> to write)");
    expect(log.join("\n")).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no row ids
  });

  it("backup is SELECT-only, holds the JSON documents, and prints a backup id from the file's bytes", async () => {
    const file = path.join(dir, "backup.json");
    const { code, log, statements } = await run({ mode: "backup", file });
    expect(code).toBe(0);
    for (const s of statements) expect(s.trim()).toMatch(/^SELECT\b/);
    const text = readFileSync(file, "utf8");
    expect(log).toEqual([
      `backup: wrote ${file}: 2 tools, 0 tool_links, 2 tool_metrics_history row(s), 3 rankings, 1 ranking_versions, 3 articles document(s)`,
      `backup: id ${backupId(text)}`,
    ]);
    expect(backupId(text)).toMatch(/^backup-[0-9a-f]{16}$/);
    expect(JSON.parse(text).ruling).toBe("#488");
  });

  it("apply refuses a backup that lacks a document it would rewrite, and an unresolved board, writing nothing", async () => {
    const file = path.join(dir, "backup-gate.json");
    expect((await run({ mode: "backup", file })).code).toBe(0);
    const backup = JSON.parse(readFileSync(file, "utf8"));
    const before = await snapshot(db);

    const short = path.join(dir, "short.json");
    writeFileSync(short, JSON.stringify({ ...backup, chatgpt_canvas: backup.chatgpt_canvas.filter((d: { label: string }) => d.label !== "2025-06 combined") }));
    const lacking = await run({ mode: "apply", backupFile: short });
    expect(lacking.code).toBe(1);
    expect(lacking.log.at(-1)).toBe("--apply: refused, nothing written: the backup lacks the rankings row 2025-06 combined");
    expect(await snapshot(db)).toEqual(before);

    await board("2024-01", "combined", [{ tool_id: "18", tool_name: "Some Other Tool" }]);
    const guarded = await snapshot(db);
    const dry = await run({ mode: "dry-run" });
    expect(dry.code).toBe(1);
    expect(dry.log).toContain("  board 2024-01 combined: UNRESOLVED: 1 entry(ies) carry a Canvas tool_id under another name");
    const fresh = path.join(dir, "backup-unresolved.json");
    expect((await run({ mode: "backup", file: fresh })).code).toBe(0);
    const refused = await run({ mode: "apply", backupFile: fresh });
    expect(refused.code).toBe(1);
    expect(refused.log.at(-1)).toBe("--apply: refused, nothing written: chatgpt-canvas: 1 document(s) unresolved");
    expect(await snapshot(db)).toEqual(guarded);
    await db.query(`DELETE FROM public."rankings" WHERE period = '2024-01'`);
  });

  it("apply re-points history and mentions, keeps collisions, retires Canvas in one transaction; a re-run is a no-op", async () => {
    const file = path.join(dir, "backup-apply.json");
    expect((await run({ mode: "backup", file })).code).toBe(0);
    const { code, log, statements } = await run({ mode: "apply", backupFile: file });
    expect(code).toBe(0);
    expect(log[0]).toBe(`--apply: backup id ${backupId(readFileSync(file, "utf8"))}`);
    expect(log).toContain("totals: chatgpt-canvas json: 5 document(s) re-pointed (5 entries), 2 collision(s), 0 unresolved");
    expect(log.at(-1)).toBe("--apply: committed (merged)");
    expect(statements.filter((s) => s === "BEGIN")).toHaveLength(1);

    const json = async (sql: string) => (await db.query<{ v: unknown }>(sql)).rows.map((r) => r.v);
    expect(await json(`SELECT data AS v FROM public."rankings" WHERE period = '2025-06'`)).toEqual([
      [{ tool_id: chatgptId, tool_name: "ChatGPT", position: 6, score: 58.98 }, { tool_id: "1", tool_name: "Claude Code", position: 1 }],
    ]);
    expect(await json(`SELECT data AS v FROM public."rankings" WHERE period = '2025-07'`)).toEqual([{ rankings: [{ tool_id: chatgptId, position: 4 }] }]);
    // The collision board keeps both entries as stored.
    expect(await json(`SELECT data AS v FROM public."rankings" WHERE period = '2026-11'`)).toEqual([
      [
        { tool_id: chatgptId, tool_slug: "chatgpt", tool_name: "ChatGPT", rank: 1 },
        { tool_id: canvasId, tool_slug: "chatgpt-canvas", tool_name: "ChatGPT Canvas", rank: 3 },
      ],
    ]);
    expect(await json(`SELECT rankings_snapshot AS v FROM public."ranking_versions"`)).toEqual([{ data: [{ tool_id: chatgptId, tool_name: "ChatGPT", rank: 6 }] }]);
    expect(await json(`SELECT tool_mentions AS v FROM public."articles" ORDER BY slug`)).toEqual([
      [{ tool: "ChatGPT", relevance: 0.9 }],
      ["ChatGPT", "Cursor"],
      [{ tool: "ChatGPT" }, { tool: "ChatGPT Canvas" }],
      [{ tool: "Cursor" }],
    ]);
    const canvas = (await db.query<{ status: string; data: Record<string, unknown> }>(`SELECT status, data FROM public."tools" WHERE slug = 'chatgpt-canvas'`)).rows[0]!;
    expect(canvas.status).toBe("redirect");
    expect(canvas.data).toMatchObject({ redirect_to: "chatgpt", redirect_reason: "#488: merged into chatgpt", previous_status: "active" });
    const metrics = (await db.query<{ tool_id: string | null; d: string }>(`SELECT tool_id, collected_date::text AS d FROM public."tool_metrics_history" ORDER BY d, tool_id NULLS FIRST`)).rows;
    expect(metrics).toEqual([
      { tool_id: chatgptId, d: "2026-10-01" },
      { tool_id: null, d: "2026-11-01" },
      { tool_id: chatgptId, d: "2026-11-01" },
    ]);

    const settled = await snapshot(db);
    const again = await run({ mode: "backup", file: path.join(dir, "backup-again.json") });
    expect(again.code).toBe(0);
    const rerun = await run({ mode: "apply", backupFile: path.join(dir, "backup-again.json") });
    expect(rerun.code).toBe(0);
    expect(rerun.log.at(-1)).toBe("--apply: committed (no-op, already merged)");
    expect(await snapshot(db)).toEqual(settled);
    const dry = await run({ mode: "dry-run" });
    expect(dry.code).toBe(0);
    expect(dry.log).toContain("chatgpt-canvas: guards passed; state already-merged; kind productivity");
    expect(dry.log).toContain("totals: chatgpt-canvas json: 0 document(s) re-pointed (0 entries), 2 collision(s), 0 unresolved");
  });
});
