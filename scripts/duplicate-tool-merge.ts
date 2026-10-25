/**
 * The D90 merge of duplicate tool rows: plan, backup and apply.
 *
 * Why: ruling D90 — seven old tool rows duplicate an active row that the signed #191 URL
 *   table already 308s them to, so both appear on the board. The ruling is "merge:
 *   re-point tool_links, then retire the old rows". Deleting an old row is not an option:
 *   `tool_links` cascades on delete. Two old rows (deepseek-r1, deepseek-v3-2; clawdbot,
 *   moltbot) share one target, so a blind re-point can hit the (model, harness) unique
 *   index on `tool_links` or the (tool_id, collected_date) one on `tool_metrics_history`.
 * What: `derivePairs` reads each old slug's target from `data/url-table-191.json`.
 *   `loadMergeState` reads the affected rows (SELECT only unless `lock`). `planMerge` is
 *   pure: per pair it lists the links to move, the links to drop (a collision keeps the
 *   row already on the target, else the one from the earlier pair; a re-point that would
 *   self-link is dropped), the metrics rows to re-point or set to NULL on collision, and
 *   the retire action (`status='redirect'` plus `data.redirect_to`, the Jules prior art;
 *   the ranking generator loads `status='active'` only). A pair is unresolved when a row
 *   is missing, the target is not active, the old row redirects elsewhere, or the kinds
 *   differ while links exist. `applyMerge` re-plans on locked rows inside one transaction,
 *   refuses an unresolved plan or a stale backup, writes, and verifies before commit.
 *   Lives under scripts/, not lib/: it names the metrics history table, which D20 keeps
 *   out of lib/ (`tests/unit/metrics-history-private-95.test.ts`).
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts`.
 */

import tableRows from "../data/url-table-191.json";

/** D90: the seven old slugs, in URL table order. Each target comes from the table. */
export const D90_OLD_SLUGS = [
  "bytedance-seedance-2-0",
  "clawdbot",
  "cowork-ai",
  "deepseek-r1",
  "deepseek-v3-2",
  "model-context-protocol-mcp-",
  "moltbot",
] as const;

export const RETIRED_STATUS = "redirect";
export const BACKUP_KIND = "duplicate-tool-merge-backup";
export const BACKUP_VERSION = 1;
/** A backup older than this does not license an apply. */
export const MAX_BACKUP_AGE_MS = 6 * 60 * 60 * 1000;

export interface MergePair {
  oldSlug: string;
  newSlug: string;
}

/** The query surface of PGlite, a pg Pool and a pg client. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
}

export interface MergeDb extends Queryable {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
}

interface TableRow {
  source: string;
  destination: string;
  action: string;
}

/**
 * Maps each old slug to its 308 target in the signed URL table (`/en/tools/<slug>` rows).
 * Throws when a slug has no row, so a pair is never invented.
 */
export function derivePairs(
  oldSlugs: readonly string[] = D90_OLD_SLUGS,
  rows: readonly TableRow[] = tableRows as TableRow[]
): MergePair[] {
  return oldSlugs.map((oldSlug) => {
    const row = rows.find((r) => r.action === "308" && r.source === `/en/tools/${oldSlug}`);
    const newSlug = row?.destination.match(/^\/en\/tools\/([^/?#]+)$/)?.[1];
    if (!newSlug) throw new Error(`no /en/tools 308 row in the URL table for ${oldSlug}`);
    return { oldSlug, newSlug };
  });
}

export interface ToolRow {
  id: string;
  slug: string;
  status: string;
  kind: string;
  data: Record<string, unknown>;
}

export interface LinkRow {
  id: string;
  model_tool_id: string;
  harness_tool_id: string;
  relation: string;
  model_slug: string;
  harness_slug: string;
}

export interface MetricRow {
  id: string;
  tool_id: string;
  collected_date: string;
}

export interface MergeState {
  tools: ToolRow[];
  links: LinkRow[];
  metrics: MetricRow[];
}

const TOOLS_SQL = `SELECT id::text AS id, slug, status, kind, data FROM public."tools"
  WHERE slug = ANY($1::text[]) ORDER BY slug`;
const LINKS_SQL = `SELECT l.id::text AS id, l.model_tool_id::text AS model_tool_id,
  l.harness_tool_id::text AS harness_tool_id, l.relation, m.slug AS model_slug, h.slug AS harness_slug
  FROM public."tool_links" l
  JOIN public."tools" m ON m.id = l.model_tool_id
  JOIN public."tools" h ON h.id = l.harness_tool_id
  WHERE l.model_tool_id = ANY($1::uuid[]) OR l.harness_tool_id = ANY($1::uuid[])
  ORDER BY l.created_at, l.id`;
const METRICS_SQL = `SELECT id::text AS id, tool_id::text AS tool_id, collected_date::text AS collected_date
  FROM public."tool_metrics_history" WHERE tool_id = ANY($1::uuid[]) ORDER BY collected_date, id`;

function allSlugs(pairs: readonly MergePair[]): string[] {
  return [...new Set(pairs.flatMap((p) => [p.oldSlug, p.newSlug]))];
}

/**
 * Reads every row the merge can touch or collide with: the old and new tools, and the
 * links and metrics rows on any of their ids. `lock` adds FOR UPDATE (apply only).
 */
export async function loadMergeState(q: Queryable, pairs: readonly MergePair[], lock = false): Promise<MergeState> {
  const suffix = lock ? " FOR UPDATE" : "";
  const tools = (await q.query(TOOLS_SQL + suffix, [allSlugs(pairs)])).rows as ToolRow[];
  const ids = tools.map((t) => t.id);
  const links = (await q.query(LINKS_SQL + (lock ? " FOR UPDATE OF l" : ""), [ids])).rows as LinkRow[];
  const metrics = (await q.query(METRICS_SQL + suffix, [ids])).rows as MetricRow[];
  return { tools, links, metrics };
}

export type LinkActionKind = "move" | "drop-collision" | "drop-self-link";

export interface LinkAction {
  linkId: string;
  action: LinkActionKind;
  relation: string;
  from: { model: string; harness: string };
  to: { model: string; harness: string; modelId: string; harnessId: string };
  /** On a collision, the relation of the row that is kept. */
  keptRelation?: string;
}

export interface MetricAction {
  rowId: string;
  action: "repoint" | "null";
  collectedDate: string;
  newToolId: string;
}

export interface PairPlan extends MergePair {
  oldStatus: string | null;
  newStatus: string | null;
  oldId: string | null;
  state: "merge" | "already-merged" | "unresolved";
  problems: string[];
  links: LinkAction[];
  metrics: MetricAction[];
  retire: boolean;
}

export interface MergeTotals {
  pairs: number;
  unresolved: number;
  linksMoved: number;
  linksDropped: number;
  metricsRepointed: number;
  metricsNulled: number;
  retired: number;
}

export interface MergePlan {
  pairs: PairPlan[];
  totals: MergeTotals;
}

function redirectTarget(row: ToolRow): unknown {
  return row.data?.["redirect_to"];
}

function pairProblems(pair: MergePair, oldRow: ToolRow | undefined, newRow: ToolRow | undefined, oldSlugs: Set<string>): string[] {
  const problems: string[] = [];
  if (!oldRow) problems.push(`old row ${pair.oldSlug} is missing`);
  if (!newRow) problems.push(`target row ${pair.newSlug} is missing`);
  else if (newRow.status !== "active") problems.push(`target row ${pair.newSlug} is ${newRow.status}, not active`);
  if (oldSlugs.has(pair.newSlug)) problems.push(`target ${pair.newSlug} is itself an old slug`);
  if (oldRow?.status === RETIRED_STATUS && redirectTarget(oldRow) !== pair.newSlug) {
    problems.push(`old row ${pair.oldSlug} already redirects to ${String(redirectTarget(oldRow))}`);
  }
  return problems;
}

const key = (a: string, b: string) => `${a}|${b}`;

/**
 * Plans the merge from loaded rows. Pure: no database access.
 *
 * Why: the dry run and the apply must act on one plan, so collisions are settled once.
 * What: see the file header. Links and metrics rows are handled in pair order, then in
 *   load order, so "first pair wins" is deterministic. A pair whose old row is retired
 *   to its target and holds no rows is `already-merged` and plans nothing.
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts`.
 */
export function planMerge(pairs: readonly MergePair[], state: MergeState): MergePlan {
  const bySlug = new Map(state.tools.map((t) => [t.slug, t]));
  const oldSlugs = new Set(pairs.map((p) => p.oldSlug));
  // A link's far end is often outside the loaded tools; its slug comes with the link row.
  const slugById = new Map<string, string>(state.tools.map((t) => [t.id, t.slug]));
  for (const l of state.links) {
    slugById.set(l.model_tool_id, l.model_slug);
    slugById.set(l.harness_tool_id, l.harness_slug);
  }
  const plans: PairPlan[] = pairs.map((pair) => {
    const oldRow = bySlug.get(pair.oldSlug);
    const newRow = bySlug.get(pair.newSlug);
    return {
      ...pair,
      oldStatus: oldRow?.status ?? null,
      newStatus: newRow?.status ?? null,
      oldId: oldRow?.id ?? null,
      state: "merge",
      problems: pairProblems(pair, oldRow, newRow, oldSlugs),
      links: [],
      metrics: [],
      retire: false,
    };
  });

  // Old id -> [pair index, target id], for every pair whose two rows exist.
  const target = new Map<string, [number, string]>();
  plans.forEach((p, i) => {
    const newRow = bySlug.get(p.newSlug);
    if (p.oldId && newRow) target.set(p.oldId, [i, newRow.id]);
  });
  const mapId = (id: string) => target.get(id)?.[1] ?? id;
  const pairOf = (...ids: string[]) => Math.min(...ids.map((id) => target.get(id)?.[0] ?? Infinity));

  const kept = new Map<string, string>(); // (model|harness) -> relation, after the merge
  const touched: LinkRow[] = [];
  for (const link of state.links) {
    if (target.has(link.model_tool_id) || target.has(link.harness_tool_id)) touched.push(link);
    else kept.set(key(link.model_tool_id, link.harness_tool_id), link.relation);
  }
  touched.sort((a, b) => pairOf(a.model_tool_id, a.harness_tool_id) - pairOf(b.model_tool_id, b.harness_tool_id));
  for (const link of touched) {
    const modelId = mapId(link.model_tool_id);
    const harnessId = mapId(link.harness_tool_id);
    const to = { model: slugById.get(modelId) ?? "?", harness: slugById.get(harnessId) ?? "?", modelId, harnessId };
    const base = { linkId: link.id, relation: link.relation, from: { model: link.model_slug, harness: link.harness_slug }, to };
    const plan = plans[pairOf(link.model_tool_id, link.harness_tool_id)]!;
    const k = key(modelId, harnessId);
    if (modelId === harnessId) plan.links.push({ ...base, action: "drop-self-link" });
    else if (kept.has(k)) plan.links.push({ ...base, action: "drop-collision", keptRelation: kept.get(k)! });
    else {
      kept.set(k, link.relation);
      plan.links.push({ ...base, action: "move" });
    }
  }

  const keptDays = new Set<string>();
  const movedMetrics: MetricRow[] = [];
  for (const row of state.metrics) {
    if (target.has(row.tool_id)) movedMetrics.push(row);
    else keptDays.add(key(row.tool_id, row.collected_date));
  }
  movedMetrics.sort((a, b) => pairOf(a.tool_id) - pairOf(b.tool_id));
  for (const row of movedMetrics) {
    const newToolId = mapId(row.tool_id);
    const k = key(newToolId, row.collected_date);
    const collides = keptDays.has(k);
    keptDays.add(k);
    plans[pairOf(row.tool_id)]!.metrics.push({ rowId: row.id, action: collides ? "null" : "repoint", collectedDate: row.collected_date, newToolId });
  }

  for (const p of plans) {
    const oldRow = bySlug.get(p.oldSlug);
    const newRow = bySlug.get(p.newSlug);
    if (oldRow && newRow && oldRow.kind !== newRow.kind && p.links.length > 0) {
      p.problems.push(`kinds differ (${oldRow.kind} vs ${newRow.kind}) and the old row has links`);
    }
    p.retire = oldRow !== undefined && oldRow.status !== RETIRED_STATUS;
    if (p.problems.length > 0) p.state = "unresolved";
    else if (!p.retire && p.links.length === 0 && p.metrics.length === 0) p.state = "already-merged";
  }

  const count = (pred: (p: PairPlan) => number) => plans.reduce((n, p) => n + pred(p), 0);
  const ok = plans.filter((p) => p.state !== "unresolved");
  return {
    pairs: plans,
    totals: {
      pairs: plans.length,
      unresolved: plans.length - ok.length,
      linksMoved: count((p) => p.links.filter((l) => l.action === "move").length),
      linksDropped: count((p) => p.links.filter((l) => l.action !== "move").length),
      metricsRepointed: count((p) => p.metrics.filter((m) => m.action === "repoint").length),
      metricsNulled: count((p) => p.metrics.filter((m) => m.action === "null").length),
      retired: count((p) => (p.retire ? 1 : 0)),
    },
  };
}

/** The dry-run report: slugs and counts only, never ids, scores or ranks. */
export function formatPlan(plan: MergePlan, verb: "would" | "will" = "would"): string[] {
  const lines: string[] = [];
  plan.pairs.forEach((p, i) => {
    lines.push(`pair ${i + 1}/${plan.pairs.length}: ${p.oldSlug} -> ${p.newSlug} [${p.state}]`);
    lines.push(`  status: old ${p.oldStatus ?? "MISSING"}, target ${p.newStatus ?? "MISSING"}`);
    for (const problem of p.problems) lines.push(`  UNRESOLVED: ${problem}`);
    for (const l of p.links) {
      const label = `${l.from.model} x ${l.from.harness} (${l.relation})`;
      if (l.action === "move") lines.push(`  link: ${verb} move ${label} to ${l.to.model} x ${l.to.harness}`);
      else if (l.action === "drop-self-link") lines.push(`  link: ${verb} drop ${label}: re-point would self-link`);
      else {
        const note = l.keptRelation === l.relation ? "" : `; relation differs, kept row is ${l.keptRelation}`;
        lines.push(`  link: ${verb} drop ${label}: ${l.to.model} x ${l.to.harness} already exists, kept${note}`);
      }
    }
    const repoint = p.metrics.filter((m) => m.action === "repoint").length;
    lines.push(`  metrics history: ${verb} re-point ${repoint}, set tool_id NULL on ${p.metrics.length - repoint} (date collision)`);
    lines.push(
      p.retire
        ? `  retire: ${verb} set ${p.oldSlug} status ${p.oldStatus} -> ${RETIRED_STATUS}, data.redirect_to ${p.newSlug}`
        : `  retire: none (${p.oldStatus === RETIRED_STATUS ? "already retired" : "no old row"})`
    );
  });
  const t = plan.totals;
  lines.push(
    `totals: ${t.pairs} pair(s), ${t.unresolved} unresolved; links moved ${t.linksMoved}, dropped ${t.linksDropped}; ` +
      `metrics re-pointed ${t.metricsRepointed}, nulled ${t.metricsNulled}; rows retired ${t.retired}`
  );
  return lines;
}
