/**
 * The ChatGPT Canvas merge: `chatgpt-canvas` into `chatgpt` (#488).
 *
 * Why: owner ruling (a) on #488 merges ChatGPT Canvas into ChatGPT. The D90 path
 *   (`--set chatgpt-canvas`, scripts/merge-duplicate-tools.ts) moves the links and metrics
 *   history and retires the old row as `status='redirect'` with `data.redirect_to` (D90, the
 *   same retirement D91 migration 0019 wrote). Canvas's ranking history and article mentions
 *   live in JSON columns that D90 never touched, so without this module the survivor's tool
 *   page could not show them.
 * What: `checkCanvasRows` guards the two rows. `planCanvasRepoint` is pure: per stored board
 *   (`rankings.data`), ranking snapshot (`ranking_versions.rankings_snapshot`) and article
 *   (`articles.tool_mentions`) it re-points Canvas's entries to ChatGPT. Conflict rule: when
 *   the same board, snapshot or article already holds a ChatGPT entry, ChatGPT's entry is
 *   kept and Canvas's is left as it is (a collision, reported, never written). A board entry
 *   that carries a Canvas `tool_id` under another tool's name, or a board with two Canvas
 *   entries, is unresolved and refuses the apply. `canvasDryRun` prints the plan (SELECT
 *   only); `canvasBackupRows` adds every row the plan can change to the backup; `canvasPatch`
 *   re-plans on locked rows inside the D90 apply transaction, refuses a backup that lacks a
 *   row it changes, writes, and re-reads.
 *   Not re-pointed: `article_rankings_changes` (an article delete subtracts each row's
 *   `score_change` from its `tool_id`, #480; Canvas's deltas never reached ChatGPT's score),
 *   and the legacy `news` table (no reader; `NewsRepository` reads `articles`). News tagging
 *   needs no rewrite: a redirect row's names resolve to its target (#187).
 * Test: `tests/unit/chatgpt-canvas-merge-488.test.ts`.
 */

import { toolMentionName } from "../lib/tool-mention-shape";
import { type BackupVerdict, MergeRefusedError } from "./duplicate-tool-merge-apply";
import type { Queryable } from "./duplicate-tool-merge";

export const CANVAS_OLD_SLUG = "chatgpt-canvas";
/** The survivor row the owner named on #488. */
export const CANVAS_SURVIVOR = { slug: "chatgpt", id: "e8865369-eb7c-45fc-81fc-6a2a4f056fed" } as const;
/** The key the backup file holds this merge's JSON rows under. */
export const CANVAS_BACKUP_KEY = "chatgpt_canvas";

type Data = Record<string, unknown>;

const isObj = (value: unknown): value is Data => !!value && typeof value === "object" && !Array.isArray(value);

export interface CanvasToolRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  kind: string;
  data: Data;
}

/** The forms a tool is stored under: row UUID, legacy `data.id`, slug, name. */
export interface ToolIdent {
  uuid: string;
  /** `data.id` as text, or null when the row has none. */
  dataId: string | null;
  /** The id the public API serves (`ToolsRepository`: `data.id || uuid`), in its stored type. */
  publicId: unknown;
  slug: string;
  name: string;
}

export function identOf(row: CanvasToolRow): ToolIdent {
  const raw = row.data?.["id"];
  return { uuid: row.id, dataId: raw ? String(raw) : null, publicId: raw ? raw : row.id, slug: row.slug, name: row.name };
}

export type CanvasCheck =
  | { ok: true; state: "merge" | "already-merged"; old: ToolIdent; survivor: ToolIdent; kind: string }
  | { ok: false; problems: string[] };

/**
 * Guards the two rows before any plan or write.
 *
 * Postcondition: `ok` only when both rows exist, the survivor has the #488 id and is active,
 *   both rows have one kind, their stored ids cannot be mistaken for each other, and Canvas is
 *   either active (`merge`) or already redirects to the survivor (`already-merged`).
 */
export function checkCanvasRows(rows: readonly CanvasToolRow[]): CanvasCheck {
  const problems: string[] = [];
  const old = rows.find((r) => r.slug === CANVAS_OLD_SLUG);
  const survivor = rows.find((r) => r.slug === CANVAS_SURVIVOR.slug);
  if (!old) problems.push(`row ${CANVAS_OLD_SLUG} is missing`);
  if (!survivor) problems.push(`row ${CANVAS_SURVIVOR.slug} is missing`);
  if (!old || !survivor) return { ok: false, problems };
  if (survivor.id !== CANVAS_SURVIVOR.id) problems.push(`${CANVAS_SURVIVOR.slug} is not the row named on #488`);
  if (survivor.status !== "active") problems.push(`${CANVAS_SURVIVOR.slug} is ${survivor.status}, expected active`);
  if (old.kind !== survivor.kind) problems.push(`kinds differ (${old.kind} vs ${survivor.kind})`);
  const o = identOf(old);
  const s = identOf(survivor);
  if (o.dataId !== null && (o.dataId === s.dataId || o.dataId === s.uuid)) problems.push("the two rows share a stored id");
  if (o.name.trim().toLowerCase() === s.name.trim().toLowerCase()) problems.push("the two rows share a name");
  let state: "merge" | "already-merged" | null = null;
  if (old.status === "active") state = "merge";
  else if (old.status === "redirect" && old.data?.["redirect_to"] === CANVAS_SURVIVOR.slug) state = "already-merged";
  else problems.push(`${CANVAS_OLD_SLUG} is ${old.status} (redirect_to ${JSON.stringify(old.data?.["redirect_to"] ?? null)})`);
  if (problems.length > 0 || state === null) return { ok: false, problems };
  return { ok: true, state, old: o, survivor: s, kind: survivor.kind };
}

const TOOLS_SQL = `SELECT id::text AS id, slug, name, status, kind, data FROM public."tools"
  WHERE slug = ANY($1::text[]) ORDER BY slug`;

export async function loadCanvasTools(q: Queryable, lock = false): Promise<CanvasToolRow[]> {
  return (await q.query(TOOLS_SQL + (lock ? " FOR UPDATE" : ""), [[CANVAS_OLD_SLUG, CANVAS_SURVIVOR.slug]])).rows as CanvasToolRow[];
}

export type CanvasTable = "rankings" | "ranking_versions" | "articles";
export const CANVAS_TABLES: readonly CanvasTable[] = ["rankings", "ranking_versions", "articles"];

/** One stored JSON document that may name Canvas. `label` is public text (period/list, version, slug). */
export interface CanvasDoc {
  table: CanvasTable;
  id: string;
  label: string;
  doc: unknown;
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A case-insensitive POSIX regex that every JSON text naming Canvas matches: its name, slug,
 * row UUID, or its legacy `data.id` as a `tool_id` value. A superset; the plan decides per entry.
 */
export function canvasTextPattern(old: ToolIdent): string {
  const parts = [escapeRegex(old.name), escapeRegex(old.slug), escapeRegex(old.uuid)];
  if (old.dataId !== null) parts.push(`"tool_id": "?${escapeRegex(old.dataId)}"?[,}]`);
  return parts.join("|");
}

const DOC_SQL: Record<CanvasTable, string> = {
  rankings: `SELECT id::text AS id, period || ' ' || list AS label, data AS doc FROM public."rankings"
  WHERE data::text ~* $1 ORDER BY period, list, id`,
  ranking_versions: `SELECT id::text AS id, version AS label, rankings_snapshot AS doc FROM public."ranking_versions"
  WHERE rankings_snapshot::text ~* $1 ORDER BY created_at, id`,
  articles: `SELECT id::text AS id, slug AS label, tool_mentions AS doc FROM public."articles"
  WHERE tool_mentions::text ~* $1 ORDER BY slug, id`,
};

/** Reads every document that may name Canvas, table by table. `lock` adds FOR UPDATE (apply only). */
export async function loadCanvasDocs(q: Queryable, old: ToolIdent, lock = false): Promise<CanvasDoc[]> {
  const docs: CanvasDoc[] = [];
  for (const table of CANVAS_TABLES) {
    const rows = (await q.query(DOC_SQL[table] + (lock ? " FOR UPDATE" : ""), [canvasTextPattern(old)])).rows as Array<{
      id: string;
      label: string;
      doc: unknown;
    }>;
    for (const r of rows) docs.push({ table, id: r.id, label: r.label, doc: r.doc });
  }
  return docs;
}

type Match = "yes" | "no" | "mismatch";

/** Whether a board entry is `t`'s: slug or name hit, or an id hit with no other name. */
export function entryMatch(entry: Data, t: ToolIdent): Match {
  const rawName = entry["tool_name"];
  const name = typeof rawName === "string" ? rawName.trim().toLowerCase() : null;
  if (entry["tool_slug"] === t.slug || (name !== null && name === t.name.trim().toLowerCase())) return "yes";
  const id = entry["tool_id"];
  const idHit = id !== undefined && id !== null && (String(id) === t.uuid || (t.dataId !== null && String(id) === t.dataId));
  if (!idHit) return "no";
  return name === null ? "yes" : "mismatch";
}

/** Maps a stored Canvas id to the survivor's id of the same form. */
function mapId(value: unknown, old: ToolIdent, s: ToolIdent): unknown {
  const v = String(value);
  if (v === old.uuid) return s.uuid;
  if (v === old.slug) return s.slug;
  if (old.dataId !== null && v === old.dataId) return s.publicId;
  return value;
}

function repointEntry(entry: Data, old: ToolIdent, s: ToolIdent): Data {
  const next = { ...entry };
  if ("tool_id" in entry) next["tool_id"] = mapId(entry["tool_id"], old, s);
  if ("tool_slug" in entry) next["tool_slug"] = s.slug;
  if ("tool_name" in entry) next["tool_name"] = s.name;
  return next;
}

/** The entry list of a stored board/snapshot (array, `{rankings}` or `{data}`) and how to put it back. */
function boardList(doc: unknown): { list: unknown[]; put: (next: unknown[]) => unknown } | null {
  if (Array.isArray(doc)) return { list: doc, put: (next) => next };
  if (isObj(doc)) {
    const wrapper: Data = doc;
    for (const key of ["rankings", "data"] as const) {
      const value = wrapper[key];
      if (Array.isArray(value)) return { list: value, put: (next) => ({ ...wrapper, [key]: next }) };
    }
  }
  return null;
}

export interface DocAction {
  table: CanvasTable;
  id: string;
  label: string;
  action: "repoint" | "collision" | "unresolved";
  /** Canvas entries or mentions in the document. */
  entries: number;
  problem?: string;
  /** The rewritten document (repoint only). */
  next?: unknown;
}

type Planned = Omit<DocAction, "table" | "id" | "label">;

function planBoard(doc: unknown, old: ToolIdent, s: ToolIdent): Planned | null {
  const board = boardList(doc);
  if (!board) return null;
  const marks = board.list.map((e) => (isObj(e) ? entryMatch(e, old) : "no"));
  const entries = marks.filter((m) => m === "yes").length;
  const mismatched = marks.filter((m) => m === "mismatch").length;
  if (mismatched > 0) return { action: "unresolved", entries, problem: `${mismatched} entry(ies) carry a Canvas tool_id under another name` };
  if (entries === 0) return null;
  if (entries > 1) return { action: "unresolved", entries, problem: `${entries} Canvas entries on one board` };
  const survivorHere = board.list.some((e, i) => isObj(e) && marks[i] !== "yes" && entryMatch(e, s) === "yes");
  if (survivorHere) return { action: "collision", entries };
  return { action: "repoint", entries, next: board.put(board.list.map((e, i) => (marks[i] === "yes" ? repointEntry(e as Data, old, s) : e))) };
}

const keysOf = (t: ToolIdent) => new Set([t.name.trim().toLowerCase(), t.slug]);

function renameMention(mention: unknown, oldKeys: Set<string>, old: ToolIdent, s: ToolIdent): unknown {
  if (typeof mention === "string") return s.name;
  const next = { ...(mention as Data) };
  for (const key of ["tool", "name"]) {
    const v = next[key];
    if (typeof v === "string" && oldKeys.has(v.trim().toLowerCase())) next[key] = s.name;
  }
  if ("toolId" in next) next["toolId"] = mapId(next["toolId"], old, s);
  return next;
}

function planMentions(doc: unknown, old: ToolIdent, s: ToolIdent): Planned | null {
  if (!Array.isArray(doc)) return null;
  const oldKeys = keysOf(old);
  const newKeys = keysOf(s);
  const nameOf = (m: unknown) => toolMentionName(m)?.toLowerCase() ?? null;
  const isOld = doc.map((m) => {
    const n = nameOf(m);
    return n !== null && oldKeys.has(n);
  });
  const entries = isOld.filter(Boolean).length;
  if (entries === 0) return null;
  if (doc.some((m) => newKeys.has(nameOf(m) ?? ""))) return { action: "collision", entries };
  return { action: "repoint", entries, next: doc.map((m, i) => (isOld[i] ? renameMention(m, oldKeys, old, s) : m)) };
}

export interface TableTotals {
  scanned: number;
  repoint: number;
  entries: number;
  collision: number;
  unresolved: number;
}

export interface CanvasPlan {
  actions: DocAction[];
  totals: Record<CanvasTable, TableTotals>;
  unresolved: number;
}

/**
 * Plans the JSON re-point. Pure: no database access.
 *
 * Why: the dry run and the apply must act on one plan, so the conflict rule is applied once.
 * What: see the file header. A document that names Canvas nowhere plans nothing.
 * Test: `tests/unit/chatgpt-canvas-merge-488.test.ts` ("plan").
 */
export function planCanvasRepoint(docs: readonly CanvasDoc[], old: ToolIdent, s: ToolIdent): CanvasPlan {
  const zero = (): TableTotals => ({ scanned: 0, repoint: 0, entries: 0, collision: 0, unresolved: 0 });
  const totals: Record<CanvasTable, TableTotals> = { rankings: zero(), ranking_versions: zero(), articles: zero() };
  const actions: DocAction[] = [];
  for (const d of docs) {
    const t = totals[d.table];
    t.scanned++;
    const planned = d.table === "articles" ? planMentions(d.doc, old, s) : planBoard(d.doc, old, s);
    if (!planned) continue;
    actions.push({ table: d.table, id: d.id, label: d.label, ...planned });
    t[planned.action]++;
    if (planned.action === "repoint") t.entries += planned.entries;
  }
  return { actions, totals, unresolved: actions.filter((a) => a.action === "unresolved").length };
}

const UNIT: Record<CanvasTable, string> = { rankings: "board", ranking_versions: "snapshot", articles: "article" };

/** The report: public labels and counts only, never ids, scores or ranks. */
export function formatCanvasPlan(plan: CanvasPlan, verb: "would" | "will" = "would"): string[] {
  const lines: string[] = [];
  for (const table of CANVAS_TABLES) {
    const t = plan.totals[table];
    lines.push(
      `chatgpt-canvas: ${table}: ${verb} re-point ${t.entries} entry(ies) in ${t.repoint} ${UNIT[table]}(s); ` +
        `${t.collision} collision(s) keep ChatGPT's entry; ${t.unresolved} unresolved (${t.scanned} scanned)`
    );
    for (const a of plan.actions.filter((x) => x.table === table)) {
      if (a.action === "repoint" && table === "articles") continue; // counted above; collisions are listed
      const what =
        a.action === "repoint"
          ? `${verb} re-point ${a.entries} entry(ies) to ${CANVAS_SURVIVOR.slug}`
          : a.action === "collision"
            ? `collision: ${CANVAS_SURVIVOR.slug} already present, kept; ${a.entries} ${CANVAS_OLD_SLUG} entry(ies) left as is`
            : `UNRESOLVED: ${a.problem}`;
      lines.push(`  ${UNIT[table]} ${a.label}: ${what}`);
    }
  }
  const sum = (k: keyof TableTotals) => CANVAS_TABLES.reduce((n, t) => n + plan.totals[t][k], 0);
  lines.push(
    `totals: chatgpt-canvas json: ${sum("repoint")} document(s) re-pointed (${sum("entries")} entries), ` +
      `${sum("collision")} collision(s), ${plan.unresolved} unresolved`
  );
  return lines;
}

/** The Canvas part of the dry run: guard, then the JSON plan. SELECT only. */
export async function canvasDryRun(q: Queryable, log: (line: string) => void): Promise<{ ok: boolean }> {
  const check = checkCanvasRows(await loadCanvasTools(q));
  if (!check.ok) {
    for (const problem of check.problems) log(`chatgpt-canvas: UNRESOLVED: ${problem}`);
    return { ok: false };
  }
  log(`chatgpt-canvas: guards passed; state ${check.state}; kind ${check.kind}`);
  const plan = planCanvasRepoint(await loadCanvasDocs(q, check.old), check.old, check.survivor);
  for (const line of formatCanvasPlan(plan)) log(line);
  return { ok: plan.unresolved === 0 };
}

/**
 * Every JSON document the apply can change, for the backup file. SELECT only. Throws when
 * the Canvas row is missing, so no backup is written that could not cover the apply.
 */
export async function canvasBackupRows(q: Queryable): Promise<CanvasDoc[]> {
  const old = (await loadCanvasTools(q)).find((r) => r.slug === CANVAS_OLD_SLUG);
  if (!old) throw new Error(`backup: row ${CANVAS_OLD_SLUG} is missing; no backup written`);
  return loadCanvasDocs(q, identOf(old));
}

/** Refuses a backup that does not hold every document the plan re-points. */
export function canvasBackupVerdict(raw: string, plan: CanvasPlan): BackupVerdict {
  let held: unknown;
  try {
    held = (JSON.parse(raw) as Data)[CANVAS_BACKUP_KEY];
  } catch {
    return { ok: false, reason: "the backup file is not JSON" };
  }
  if (!Array.isArray(held)) return { ok: false, reason: `the backup lacks the ${CANVAS_BACKUP_KEY} documents` };
  const keys = new Set(held.filter(isObj).map((d) => `${String(d["table"])}|${String(d["id"])}`));
  for (const a of plan.actions.filter((x) => x.action === "repoint")) {
    if (!keys.has(`${a.table}|${a.id}`)) return { ok: false, reason: `the backup lacks the ${a.table} row ${a.label}` };
  }
  return { ok: true };
}

const WRITE_SQL: Record<CanvasTable, string> = {
  rankings: `UPDATE public."rankings" SET data = $2::jsonb, updated_at = now() WHERE id = $1::uuid`,
  ranking_versions: `UPDATE public."ranking_versions" SET rankings_snapshot = $2::jsonb WHERE id = $1::uuid`,
  articles: `UPDATE public."articles" SET tool_mentions = $2::jsonb, updated_at = now() WHERE id = $1::uuid`,
};

/**
 * The apply's JSON re-point, run by `applyMerge` inside its transaction before Canvas is retired.
 *
 * What: re-checks the guard on locked rows, re-plans on locked documents, refuses an unresolved
 *   plan or a backup that lacks a document (`MergeRefusedError`), writes each re-pointed
 *   document, then re-plans and throws unless only the planned collisions remain. Any throw
 *   rolls back the whole merge. Logs the plan it wrote.
 * Test: `tests/unit/chatgpt-canvas-merge-488.test.ts` ("runMerge").
 */
export function canvasPatch(raw: string, log: (line: string) => void = () => {}): (tx: Queryable) => Promise<void> {
  return async (tx) => {
    const check = checkCanvasRows(await loadCanvasTools(tx, true));
    if (!check.ok) throw new MergeRefusedError(`chatgpt-canvas guard: ${check.problems.join("; ")}`);
    const plan = planCanvasRepoint(await loadCanvasDocs(tx, check.old, true), check.old, check.survivor);
    if (plan.unresolved > 0) throw new MergeRefusedError(`chatgpt-canvas: ${plan.unresolved} document(s) unresolved`);
    const verdict = canvasBackupVerdict(raw, plan);
    if (!verdict.ok) throw new MergeRefusedError(verdict.reason);
    for (const a of plan.actions.filter((x) => x.action === "repoint")) {
      await tx.query(WRITE_SQL[a.table], [a.id, JSON.stringify(a.next)]);
    }
    const after = planCanvasRepoint(await loadCanvasDocs(tx, check.old), check.old, check.survivor);
    const planned = plan.actions.filter((a) => a.action === "collision").map((a) => `${a.table}|${a.id}`);
    const left = after.actions.map((a) => `${a.table}|${a.id}`);
    if (after.actions.some((a) => a.action !== "collision") || left.join(",") !== planned.join(",")) {
      throw new Error(`merge verification failed: ${after.actions.filter((a) => a.action !== "collision").length} Canvas document(s) left`);
    }
    for (const line of formatCanvasPlan(plan, "will")) log(line);
  };
}
