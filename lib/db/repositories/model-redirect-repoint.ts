/**
 * Model redirect re-point: moves named D90/D91 redirect aliases to their per-major row (#329).
 *
 * Why: D90 and D91 sent versioned model URLs to the family rows. Under D0c a family slug is the
 *   latest major, and each older available major has its own row, so the old versioned URLs must
 *   land on their own major (owner ruling D58). The change writes to hidden alias rows, so it is
 *   limited to an explicit list and guarded on the alias's and the target's current state.
 * What: `MODEL_REDIRECT_REPOINTS` is the hard-coded list of (alias, expected old target, new
 *   target); `data/url-table-191.json` holds the same targets for the 308s, and a test keeps the two
 *   equal. `planRedirectRepoints` reads the aliases and targets (one SELECT) and returns per pair
 *   `repoint`, `unchanged` (already at the new target) or `refused`; a target must be an active row
 *   in the lifecycle file. `applyRedirectRepoints` runs `MODEL_REDIRECT_REPOINT_SQL` per `repoint`
 *   plan in the caller's transaction, after the status step, and throws on a 0-row match, so the
 *   whole apply rolls back. Only `data.redirect_to` and two provenance keys change; status stays
 *   `redirect`.
 * Test: `tests/unit/model-redirect-repoint-329.test.ts`, `tests/unit/model-lifecycle-pglite-329.test.ts`,
 *   `tests/unit/url-table-191.test.ts`
 */

import type { ModelSeedQueryable } from "./model-seed-writer";

export interface RedirectRepoint {
  alias: string;
  from: string;
  to: string;
}

/**
 * D58: every D90/D91 alias of a model major that has its own row now. `from` is the target D90 or
 * D91 wrote; `to` is the active lifecycle row for the alias's tier and major.
 */
export const MODEL_REDIRECT_REPOINTS: readonly RedirectRepoint[] = [
  { alias: "opus-4-6", from: "claude-opus", to: "claude-opus-4" },
  { alias: "opus-4-5", from: "claude-opus", to: "claude-opus-4" },
  { alias: "sonnet-4-5", from: "claude-sonnet", to: "claude-sonnet-4" },
  { alias: "kimi-2-5", from: "kimi", to: "kimi-2" },
  { alias: "moonshot-kimi-2-5", from: "kimi", to: "kimi-2" },
  { alias: "deepseek-v3-2", from: "deepseek", to: "deepseek-base" },
];

// #329: read-only; reads the aliases and the new targets.
export const MODEL_REDIRECT_SELECT_SQL = `SELECT slug, kind, status, data->>'redirect_to' AS redirect_to
FROM tools WHERE slug = ANY($1::text[])`;

// #329: matches only a model row that is still a redirect to the expected old target.
// D58: and only when the new target is an active model row; the status step has already run in
// this transaction. Any other state matches nothing and the caller aborts.
export const MODEL_REDIRECT_REPOINT_SQL = `UPDATE tools SET
  data = data || jsonb_build_object('redirect_to', $3::text, 'redirect_repointed_from', $2::text,
    'redirect_repoint_reason', 'D58: one row per major version (#329)'),
  updated_at = now()
WHERE slug = $1 AND kind = 'model' AND status = 'redirect' AND data->>'redirect_to' = $2
  AND EXISTS (SELECT 1 FROM tools t WHERE t.slug = $3 AND t.kind = 'model' AND t.status = 'active')
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

/** The statuses the status step can move to `active` earlier in the same transaction. */
const STATUS_STEP_FROM = new Set(["inactive", "active", "deprecated"]);

/**
 * Why: the dry run must show each re-point, and refuse one whose alias or target is not in the
 *   expected state.
 * What: one SELECT, then a pure plan per pair. Refuses a missing alias, a non-model or
 *   non-redirect alias, an alias pointing anywhere but `from` or `to`, a new target the lifecycle
 *   does not set active (`lifecycleActive`), and a new target that is neither a model row the
 *   status step can set active nor in `pendingInserts` (rows the seed inserts in the same
 *   transaction). Writes nothing.
 * Test: `tests/unit/model-redirect-repoint-329.test.ts`
 */
export async function planRedirectRepoints(
  db: ModelSeedQueryable,
  pairs: readonly RedirectRepoint[],
  pendingInserts: ReadonlySet<string>,
  lifecycleActive: ReadonlySet<string>
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
    // D58: the target must be active after the status step, so the lifecycle must say active.
    if (!lifecycleActive.has(pair.to)) return { alias, outcome: "refused", reason: `new target ${pair.to} is not active in the lifecycle` };
    const target = bySlug.get(pair.to);
    const settable = target !== undefined && target.kind === "model" && STATUS_STEP_FROM.has(target.status);
    if (!settable && !(target === undefined && pendingInserts.has(pair.to))) {
      return { alias, outcome: "refused", reason: `new target ${pair.to} is not a model row the status step can set active` };
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
