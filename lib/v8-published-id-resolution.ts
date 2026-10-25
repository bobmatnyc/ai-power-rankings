/**
 * Map published v7.10 tool ids to today's canonical ids through redirects (#185).
 *
 * Why: the D90 merge and the D91 fold (migrations 0018/0019) retired tool rows
 *   as `tools.status = 'redirect'` with `tools.data.redirect_to` naming the
 *   canonical row's slug. The published v7.10 snapshot keeps the old ids, so a
 *   reproduction keyed on `tool_id` counts every retired tool as missing.
 * What: `resolvePublishedIds()` follows each distinct published id from its
 *   `tools` row through `redirect_to` slugs until a row that is not a
 *   redirect, and re-keys the published rows to that row's id. A cycle, an id
 *   with no row, and a redirect with no target or a target slug with no row
 *   are counted and their rows dropped from the comparison; two or more
 *   published ids reaching one canonical id are counted as a collision, and
 *   all of their rows and that canonical id are left out of the comparison
 *   (never merged). The caller fails the reproduction on any of these counts.
 * Test: `lib/v8-board-measurement-redirects.test.ts`
 */

import type { SnapshotRow } from "./ranking-snapshot-diff";

/** The status `applyMerge` and migration 0019 give a retired tool row. */
export const REDIRECT_STATUS = "redirect";

/** One `tools` row, any status, as the resolution needs it. */
export interface ToolIdentity {
  id: string;
  slug: string;
  status: string;
  /** `data->>'redirect_to'`: the canonical row's slug, or null. */
  redirectTo: string | null;
}

/** Counts only (D19): no id, slug or name. */
export interface RedirectCounts {
  /** Published ids that reached a different canonical id through one or more redirects. */
  mapped: number;
  /** Published ids with no row, or a redirect with no target or a target slug with no row. */
  unmapped: number;
  /** Published ids whose redirect chain loops. */
  cycles: number;
  /** Published ids that share their canonical id with another published id. */
  collidedIds: number;
  /** Canonical ids reached by more than one published id. */
  collisionTargets: number;
}

export interface PublishedIdResolution {
  /** Published rows re-keyed to canonical ids; unmapped, cyclic and collided rows left out. */
  rows: SnapshotRow[];
  /** Canonical ids of collisions: the caller leaves them out of the recomputed side too. */
  collidedCanonicalIds: ReadonlySet<string>;
  counts: RedirectCounts;
}

type Outcome = { kind: "canonical"; id: string; hops: number } | { kind: "unmapped" } | { kind: "cycle" };

/** Follow `id` to its canonical row. Terminates: each row is visited at most once. */
function resolveId(id: string, byId: Map<string, ToolIdentity>, bySlug: Map<string, ToolIdentity>): Outcome {
  let row = byId.get(id);
  if (!row) return { kind: "unmapped" };
  const seen = new Set<string>();
  let hops = 0;
  while (row.status === REDIRECT_STATUS) {
    if (seen.has(row.id)) return { kind: "cycle" };
    seen.add(row.id);
    const next: ToolIdentity | undefined = row.redirectTo ? bySlug.get(row.redirectTo) : undefined;
    if (!next) return { kind: "unmapped" };
    row = next;
    hops++;
  }
  return { kind: "canonical", id: row.id, hops };
}

/**
 * Re-key `rows` (a published snapshot) to canonical ids.
 *
 * Postcondition: every returned row's `tool_id` is the id of a non-redirect
 * row in `identities`, and no two distinct published ids share one;
 * `mapped + unmapped + cycles` plus the unchanged ids equals the distinct
 * published ids.
 */
export function resolvePublishedIds(rows: readonly SnapshotRow[], identities: readonly ToolIdentity[]): PublishedIdResolution {
  const byId = new Map(identities.map((t) => [t.id, t]));
  const bySlug = new Map(identities.map((t) => [t.slug, t]));
  const outcomes = new Map<string, Outcome>();
  for (const row of rows) {
    const id = String(row["tool_id"]);
    if (!outcomes.has(id)) outcomes.set(id, resolveId(id, byId, bySlug));
  }

  const sources = new Map<string, number>();
  for (const o of outcomes.values()) if (o.kind === "canonical") sources.set(o.id, (sources.get(o.id) ?? 0) + 1);
  const collided = new Set([...sources].filter(([, n]) => n > 1).map(([id]) => id));

  const list = [...outcomes.values()];
  const counts: RedirectCounts = {
    mapped: list.filter((o) => o.kind === "canonical" && o.hops > 0).length,
    unmapped: list.filter((o) => o.kind === "unmapped").length,
    cycles: list.filter((o) => o.kind === "cycle").length,
    collidedIds: list.filter((o) => o.kind === "canonical" && collided.has(o.id)).length,
    collisionTargets: collided.size,
  };
  const resolved = rows.flatMap((row) => {
    const o = outcomes.get(String(row["tool_id"]))!;
    return o.kind === "canonical" && !collided.has(o.id) ? [{ ...row, tool_id: o.id }] : [];
  });
  return { rows: resolved, collidedCanonicalIds: collided, counts };
}
