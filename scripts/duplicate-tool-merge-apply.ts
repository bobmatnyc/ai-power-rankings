/**
 * Backup and apply for the D90 duplicate-tool merge.
 *
 * Why: D90 — "back up first, then dry run"; the apply must not run without a backup of
 *   every row it changes, taken recently from the same database.
 * What: `takeBackup` exports the affected `tools` rows and every `tool_links` /
 *   `tool_metrics_history` row on an old id, as `to_jsonb` rows (SELECT only).
 *   `checkBackup` accepts a backup only when it is this kind, from the same database
 *   fingerprint, under `MAX_BACKUP_AGE_MS` old, and holds every row the apply would
 *   change. `applyMerge` runs in one transaction: lock, re-plan, check, write, verify.
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts`.
 */

import {
  BACKUP_KIND,
  BACKUP_VERSION,
  type MergeDb,
  type MergePair,
  type MergePlan,
  type MergeState,
  MAX_BACKUP_AGE_MS,
  planMerge,
  type Queryable,
  RETIRED_STATUS,
  loadMergeState,
} from "./duplicate-tool-merge";

export interface MergeBackup {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  ruling: "D90";
  database_fingerprint: string;
  taken_at: string;
  pairs: MergePair[];
  tools: Record<string, unknown>[];
  tool_links: Record<string, unknown>[];
  tool_metrics_history: Record<string, unknown>[];
}

const rowsOf = async (q: Queryable, text: string, params: unknown[]) =>
  ((await q.query(text, params)).rows as { row: Record<string, unknown> }[]).map((r) => r.row);

/** SELECT-only export of every row the merge can change. */
export async function takeBackup(
  q: Queryable,
  pairs: readonly MergePair[],
  fingerprint: string,
  now: Date = new Date()
): Promise<MergeBackup> {
  const slugs = [...new Set(pairs.flatMap((p) => [p.oldSlug, p.newSlug]))];
  const tools = await rowsOf(q, `SELECT to_jsonb(t) AS row FROM public."tools" t WHERE t.slug = ANY($1::text[]) ORDER BY t.slug`, [slugs]);
  const oldSlugs = new Set(pairs.map((p) => p.oldSlug));
  const oldIds = tools.filter((t) => oldSlugs.has(String(t["slug"]))).map((t) => String(t["id"]));
  const toolLinks = await rowsOf(
    q,
    `SELECT to_jsonb(l) AS row FROM public."tool_links" l
     WHERE l.model_tool_id = ANY($1::uuid[]) OR l.harness_tool_id = ANY($1::uuid[]) ORDER BY l.id`,
    [oldIds]
  );
  const metrics = await rowsOf(
    q,
    `SELECT to_jsonb(m) AS row FROM public."tool_metrics_history" m WHERE m.tool_id = ANY($1::uuid[]) ORDER BY m.id`,
    [oldIds]
  );
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    ruling: "D90",
    database_fingerprint: fingerprint,
    taken_at: now.toISOString(),
    pairs: [...pairs],
    tools,
    tool_links: toolLinks,
    tool_metrics_history: metrics,
  };
}

export type BackupVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Decides whether a backup file licenses this apply.
 *
 * Why: "refuses to run without a fresh backup" — a stale or foreign backup cannot restore
 *   the rows this apply changes.
 * What: refuses unparseable JSON, another kind or version, another database fingerprint,
 *   a `taken_at` in the future or older than `maxAgeMs`, and any planned row id the
 *   backup does not hold.
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts` ("backup gate").
 */
export function checkBackup(
  raw: string,
  fingerprint: string,
  plan: MergePlan,
  now: Date = new Date(),
  maxAgeMs: number = MAX_BACKUP_AGE_MS
): BackupVerdict {
  let backup: Partial<MergeBackup>;
  try {
    backup = JSON.parse(raw) as Partial<MergeBackup>;
  } catch {
    return { ok: false, reason: "the backup file is not JSON" };
  }
  if (backup.kind !== BACKUP_KIND || backup.version !== BACKUP_VERSION) return { ok: false, reason: "the file is not a D90 merge backup" };
  if (backup.database_fingerprint !== fingerprint) return { ok: false, reason: "the backup is from another database" };
  const age = now.getTime() - Date.parse(String(backup.taken_at));
  if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) {
    return { ok: false, reason: `the backup is not fresh (must be under ${maxAgeMs / 3_600_000} h old)` };
  }
  const ids = (rows: unknown) => new Set((Array.isArray(rows) ? rows : []).map((r) => String((r as Record<string, unknown>)["id"])));
  const tools = ids(backup.tools);
  const links = ids(backup.tool_links);
  const metrics = ids(backup.tool_metrics_history);
  for (const p of plan.pairs) {
    if (p.retire && p.oldId && !tools.has(p.oldId)) return { ok: false, reason: `the backup lacks the ${p.oldSlug} row` };
    if (p.links.some((l) => !links.has(l.linkId))) return { ok: false, reason: `the backup lacks a tool_links row of ${p.oldSlug}` };
    if (p.metrics.some((m) => !metrics.has(m.rowId))) return { ok: false, reason: `the backup lacks a metrics row of ${p.oldSlug}` };
  }
  return { ok: true };
}

export class MergeRefusedError extends Error {}

/** Rows still on an old id, or old rows not retired, after the writes; empty when done. */
export function remainingWork(pairs: readonly MergePair[], state: MergeState): string[] {
  const old = new Map(state.tools.filter((t) => pairs.some((p) => p.oldSlug === t.slug)).map((t) => [t.id, t]));
  const left: string[] = [];
  for (const t of old.values()) if (t.status !== RETIRED_STATUS) left.push(`${t.slug} is ${t.status}`);
  const links = state.links.filter((l) => old.has(l.model_tool_id) || old.has(l.harness_tool_id)).length;
  const metrics = state.metrics.filter((m) => old.has(m.tool_id)).length;
  if (links > 0) left.push(`${links} tool_links row(s) on old ids`);
  if (metrics > 0) left.push(`${metrics} metrics row(s) on old ids`);
  return left;
}

/**
 * Applies the plan in one transaction, or nothing.
 *
 * Why: D90 apply — re-point, then retire, with no half-merged state and no re-run effect.
 * What: locks the affected rows, re-plans from them, and throws `MergeRefusedError`
 *   (rolling back) when a pair is unresolved or `readBackupVerdict` refuses. Writes in an
 *   order the unique indexes accept: drops and NULLs first, then moves and re-points,
 *   then retires (`WHERE status <> 'redirect'`, so a retired row is not touched again).
 *   Re-reads and throws if anything is left. Returns the plan it applied; a re-run
 *   returns a plan whose pairs are all `already-merged`.
 * Test: `tests/unit/duplicate-tool-merge-d90.test.ts`.
 */
export async function applyMerge(
  db: MergeDb,
  pairs: readonly MergePair[],
  readBackupVerdict: (plan: MergePlan) => BackupVerdict
): Promise<MergePlan> {
  return db.transaction(async (tx) => {
    const plan = planMerge(pairs, await loadMergeState(tx, pairs, true));
    if (plan.totals.unresolved > 0) throw new MergeRefusedError(`${plan.totals.unresolved} pair(s) unresolved`);
    const verdict = readBackupVerdict(plan);
    if (!verdict.ok) throw new MergeRefusedError(verdict.reason);

    const links = plan.pairs.flatMap((p) => p.links);
    const metrics = plan.pairs.flatMap((p) => p.metrics);
    for (const l of links.filter((l) => l.action !== "move")) {
      await tx.query(`DELETE FROM public."tool_links" WHERE id = $1::uuid`, [l.linkId]);
    }
    for (const m of metrics.filter((m) => m.action === "null")) {
      await tx.query(`UPDATE public."tool_metrics_history" SET tool_id = NULL, updated_at = now() WHERE id = $1::uuid`, [m.rowId]);
    }
    for (const l of links.filter((l) => l.action === "move")) {
      await tx.query(
        `UPDATE public."tool_links" SET model_tool_id = $2::uuid, harness_tool_id = $3::uuid, updated_at = now() WHERE id = $1::uuid`,
        [l.linkId, l.to.modelId, l.to.harnessId]
      );
    }
    for (const m of metrics.filter((m) => m.action === "repoint")) {
      await tx.query(`UPDATE public."tool_metrics_history" SET tool_id = $2::uuid, updated_at = now() WHERE id = $1::uuid`, [m.rowId, m.newToolId]);
    }
    for (const p of plan.pairs.filter((p) => p.retire && p.oldId)) {
      await tx.query(
        `UPDATE public."tools" SET status = '${RETIRED_STATUS}', updated_at = now(),
           data = data || jsonb_build_object('redirect_to', $2::text, 'redirect_reason', $3::text, 'previous_status', status)
         WHERE id = $1::uuid AND status <> '${RETIRED_STATUS}'`,
        [p.oldId, p.newSlug, `D90: merged into ${p.newSlug}`]
      );
    }

    const left = remainingWork(pairs, await loadMergeState(tx, pairs));
    if (left.length > 0) throw new Error(`merge verification failed: ${left.join("; ")}`);
    return plan;
  });
}
