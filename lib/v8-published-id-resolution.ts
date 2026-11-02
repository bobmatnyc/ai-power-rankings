/**
 * Map published v7.10 tool ids to today's canonical ids through redirects (#185).
 *
 * Why: the duplicate-tool merge and the fold (migrations 0018/0019) retired tool rows
 *   as `tools.status = 'redirect'` with `tools.data.redirect_to` naming the
 *   canonical row's slug. The published v7.10 snapshot keeps the old ids, so a
 *   reproduction keyed on `tool_id` counts every retired tool as missing.
 * What: `resolvePublishedIds()` follows each distinct published id from its
 *   `tools` row through `redirect_to` slugs until a row that is not a
 *   redirect, and re-keys the published rows to that row's id. A cycle, an id
 *   with no row, and a redirect with no target or a target slug with no row
 *   are counted and their rows dropped from the comparison. Two or more
 *   published ids reaching one canonical id are a collision: the survivor is the published id whose slug the canonical row's
 *   `data.carriedFrom` names (0019), else the canonical id itself when it was
 *   published (a merge target). The survivor's row stands for the canonical id,
 *   the others are counted as retired and removed, and every published rank
 *   below a retired row moves up by one per retired row above it. A collision
 *   with no survivor, or a survivor outside the group, is unexplained: its rows
 *   and canonical id are left out of the comparison. The caller fails the
 *   reproduction on any unmapped id, cycle or unexplained collision.
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
  /** #185: `data->>'carriedFrom'`, the slug of the row 0019 copied onto this family row. */
  carriedFrom?: string | null;
}

/** Counts only: no id, slug or name. */
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
  /** #185: collided published ids other than their group's survivor, removed before the comparison. */
  retired: number;
  /** #185: collisions with no survivor, or a survivor outside the group. */
  unexplainedCollisions: number;
}

export interface PublishedIdResolution {
  /** Published rows re-keyed to canonical ids, ranks renumbered past retired rows; unmapped, cyclic, retired and unexplained rows left out. */
  rows: SnapshotRow[];
  /** Canonical ids of unexplained collisions: the caller leaves them out of the recomputed side too. */
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
 * row in `identities`, and no two distinct published ids share one (a
 * collision keeps only its survivor's row);
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

  const groups = new Map<string, string[]>();
  for (const [published, o] of outcomes) if (o.kind === "canonical") groups.set(o.id, [...(groups.get(o.id) ?? []), published]);
  const collided = new Set([...groups].filter(([, ids]) => ids.length > 1).map(([id]) => id));
  // #185: each collision keeps its survivor's row; the other members retire.
  const survivors = new Map<string, string>();
  for (const canonical of collided) {
    const members = groups.get(canonical)!;
    const carried = byId.get(canonical)?.carriedFrom;
    const survivor = carried ? bySlug.get(carried)?.id : canonical;
    if (survivor && members.includes(survivor)) survivors.set(canonical, survivor);
  }
  const unexplained = new Set([...collided].filter((id) => !survivors.has(id)));
  const keep = (published: string, o: Outcome) =>
    o.kind === "canonical" && !unexplained.has(o.id) && (!collided.has(o.id) || survivors.get(o.id) === published);
  const retiredIds = new Set(
    [...outcomes].filter(([published, o]) => o.kind === "canonical" && survivors.has(o.id) && survivors.get(o.id) !== published).map(([id]) => id)
  );

  const list = [...outcomes.values()];
  const counts: RedirectCounts = {
    mapped: list.filter((o) => o.kind === "canonical" && o.hops > 0).length,
    unmapped: list.filter((o) => o.kind === "unmapped").length,
    cycles: list.filter((o) => o.kind === "cycle").length,
    collidedIds: list.filter((o) => o.kind === "canonical" && collided.has(o.id)).length,
    collisionTargets: collided.size,
    retired: retiredIds.size,
    unexplainedCollisions: unexplained.size,
  };
  const rankOf = (row: SnapshotRow) => Number(row["rank"] ?? row["position"]);
  const retiredRanks = rows.filter((row) => retiredIds.has(String(row["tool_id"]))).map(rankOf);
  const resolved = rows.flatMap((row) => {
    const published = String(row["tool_id"]);
    const o = outcomes.get(published)!;
    if (o.kind !== "canonical" || !keep(published, o)) return [];
    // #185: renumber: a rank moves up one place for each retired row ranked above it.
    const rank = rankOf(row) - retiredRanks.filter((r) => r < rankOf(row)).length;
    return [{ ...row, tool_id: o.id, rank }];
  });
  return { rows: resolved, collidedCanonicalIds: unexplained, counts };
}
