/**
 * Model redirect re-point: moves named D91 redirect aliases to a per-major row (#329).
 *
 * Why: D91 folded the Opus 4.x rows into `claude-opus`. Under D0c `claude-opus` is the latest
 *   major (Opus 5) and Opus 4 has its own row, `claude-opus-4`, so the old Opus 4.x URLs must land
 *   there. The change is a write to hidden alias rows, so it is limited to an explicit list and
 *   guarded on the alias's current state.
 * What: `MODEL_REDIRECT_REPOINTS` is the hard-coded list of (alias, expected old target, new
 *   target). `planRedirectRepoints` reads the aliases and targets (one SELECT) and returns per pair
 *   `repoint`, `unchanged` (already at the new target) or `refused`. `applyRedirectRepoints` runs
 *   `MODEL_REDIRECT_REPOINT_SQL` per `repoint` plan in the caller's transaction and throws on a
 *   0-row match, so the whole apply rolls back. Only `data.redirect_to` and two provenance keys
 *   change; status stays `redirect`.
 * Test: `tests/unit/model-redirect-repoint-329.test.ts`, `tests/unit/model-lifecycle-pglite-329.test.ts`
 */

import type { ModelSeedQueryable } from "./model-seed-writer";

export interface RedirectRepoint {
  alias: string;
  from: string;
  to: string;
}

/** #329 (PM call on D0c): the Opus 4.x aliases move from the family row to the Opus 4 row. */
export const MODEL_REDIRECT_REPOINTS: readonly RedirectRepoint[] = [
  { alias: "opus-4-6", from: "claude-opus", to: "claude-opus-4" },
  { alias: "opus-4-5", from: "claude-opus", to: "claude-opus-4" },
];

// #329: read-only; reads the aliases and the new targets.
export const MODEL_REDIRECT_SELECT_SQL = `SELECT slug, kind, status, data->>'redirect_to' AS redirect_to
FROM tools WHERE slug = ANY($1::text[])`;

// #329: matches only a model row that is still a redirect to the expected old target, and only
// when the new target is a live model row. Any other state matches nothing and the caller aborts.
export const MODEL_REDIRECT_REPOINT_SQL = `UPDATE tools SET
  data = data || jsonb_build_object('redirect_to', $3::text, 'redirect_repointed_from', $2::text,
    'redirect_repoint_reason', 'D0c: one row per major version (#329)'),
  updated_at = now()
WHERE slug = $1 AND kind = 'model' AND status = 'redirect' AND data->>'redirect_to' = $2
  AND EXISTS (SELECT 1 FROM tools t WHERE t.slug = $3 AND t.kind = 'model' AND t.status <> 'redirect')
RETURNING slug`;

export type RedirectRepointPlan =
  | { alias: string; outcome: "repoint"; from: string; to: string; params: unknown[] }
  | { alias: string; outcome: "unchanged" }
  | { alias: string; outcome: "refused"; reason: string };

interface ExistingRow {
  slug: string;
  kind: string;
  status: string;
  redirect_to: string | null;
}

/**
 * Why: the dry run must show each re-point, and refuse one whose alias is not in the expected state.
 * What: one SELECT, then a pure plan per pair. Refuses a missing alias, a non-model or non-redirect
 *   alias, an alias pointing anywhere but `from` or `to`, and a new target that is neither a live
 *   model row nor in `pendingInserts` (rows the seed inserts in the same transaction). Writes nothing.
 * Test: `tests/unit/model-redirect-repoint-329.test.ts`
 */
export async function planRedirectRepoints(
  db: ModelSeedQueryable,
  pairs: readonly RedirectRepoint[],
  pendingInserts: ReadonlySet<string>
): Promise<RedirectRepointPlan[]> {
  if (pairs.length === 0) return [];
  const slugs = [...new Set(pairs.flatMap((p) => [p.alias, p.to]))];
  const { rows } = await db.query(MODEL_REDIRECT_SELECT_SQL, [slugs]);
  const bySlug = new Map((rows as ExistingRow[]).map((r) => [r.slug, r]));
  return pairs.map((pair): RedirectRepointPlan => {
    const { alias } = pair;
    const row = bySlug.get(alias);
    if (!row) return { alias, outcome: "refused", reason: "no tools row with this slug" };
    if (row.kind !== "model" || row.status !== "redirect") {
      return { alias, outcome: "refused", reason: `alias is a ${row.kind} row with status ${row.status}, not a model redirect` };
    }
    if (row.redirect_to === pair.to) return { alias, outcome: "unchanged" };
    if (row.redirect_to !== pair.from) {
      return { alias, outcome: "refused", reason: `alias redirects to ${row.redirect_to ?? "(none)"}, expected ${pair.from}` };
    }
    const target = bySlug.get(pair.to);
    const targetLive = target !== undefined && target.kind === "model" && target.status !== "redirect";
    if (!targetLive && !(target === undefined && pendingInserts.has(pair.to))) {
      return { alias, outcome: "refused", reason: `new target ${pair.to} is not a live model row` };
    }
    return { alias, outcome: "repoint", from: pair.from, to: pair.to, params: [alias, pair.from, pair.to] };
  });
}

/** Writes every `repoint` plan through `tx`; throws on a 0-row match so the caller rolls back. */
export async function applyRedirectRepoints(tx: ModelSeedQueryable, plans: readonly RedirectRepointPlan[]): Promise<number> {
  let written = 0;
  for (const plan of plans) {
    if (plan.outcome !== "repoint") continue;
    const { rows } = await tx.query(MODEL_REDIRECT_REPOINT_SQL, plan.params);
    if (rows.length !== 1) throw new Error(`${plan.alias}: redirect re-point matched no row; the alias or its target changed since planning`);
    written++;
  }
  return written;
}
