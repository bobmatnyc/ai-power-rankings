/**
 * Kind routing: which weight table scores a tool (#185 PR-2).
 *
 * Why: v8 scores a harness with the harness profile and a model with the
 *   model profile, while the frozen v7.10 set keeps one table for every tool.
 *   A tool routed to the wrong table gets a plausible but wrong score, so a
 *   routing gap must stop the run instead of falling back to another table.
 * What: `kindRouting()` builds a `KindWeightRouting` from one set's profiles.
 *   A `single` routing (the legacy set, one profile named `all`) returns that
 *   table for every tool and ignores `kind`. A `byKind` routing returns the
 *   profile named after the tool's `tools.kind` and throws
 *   `ScoringProfileError` for a null, missing or unknown kind, and for a known
 *   kind the set has no profile for. `profileRouting()` builds it from a
 *   validated config: `single` for a legacy set, `byKind` otherwise.
 *   `computeRankings()` only routes when a caller passes one: #185 PR-3, the
 *   per-list publish (`lib/rankings/publish-active.ts`), the v8 measurement and tests.
 * Test: `lib/scoring-kind-routing.test.ts`
 */

import { TOOL_KINDS } from "./db/schema";
import type { RankingWeightsV76 } from "./ranking-algorithm-v76";
import { ScoringProfileError, type ScoringProfilesConfig } from "./scoring-profiles";
import type { KindWeightRouting } from "./services/ranking-generation.service";

/** The one profile of a legacy (single-table) set. */
export const LEGACY_PROFILE = "all";

export type RoutingMode = "single" | "byKind";

const KNOWN: readonly string[] = TOOL_KINDS;

/**
 * Build a routing over `profiles` (profile name -> weights).
 *
 * Precondition: `single` has exactly the profile `all`. Postcondition: every
 * `route()` result is a copy of one entry of `profiles`; for `byKind` its
 * profile name equals the tool's kind.
 */
export function kindRouting(
  setId: string,
  profiles: Readonly<Record<string, RankingWeightsV76>>,
  mode: RoutingMode
): KindWeightRouting {
  const names = Object.keys(profiles);
  if (mode === "single" && (names.length !== 1 || names[0] !== LEGACY_PROFILE)) {
    throw new ScoringProfileError([`set "${setId}" routes one table and must have exactly the profile "${LEGACY_PROFILE}"`]);
  }
  const route = (kind: unknown) => {
    if (mode === "single") return { profile: LEGACY_PROFILE, weights: { ...profiles[LEGACY_PROFILE]! } };
    // #185: fail closed. No default kind, no fallback profile.
    if (typeof kind !== "string" || !KNOWN.includes(kind)) {
      throw new ScoringProfileError([`set "${setId}" cannot route a tool of kind ${JSON.stringify(kind ?? null)}`]);
    }
    const weights = Object.hasOwn(profiles, kind) ? profiles[kind] : undefined;
    if (!weights) throw new ScoringProfileError([`set "${setId}" has no profile for kind "${kind}"`]);
    return { profile: kind, weights: { ...weights } };
  };
  return { setId, route };
}

/** Routing for one set of a validated config: one table for a legacy set, per kind otherwise. */
export function profileRouting(config: ScoringProfilesConfig, setId: string): KindWeightRouting {
  const set = config.profileSets[setId];
  if (!set) throw new ScoringProfileError([`no profile set "${setId}"`]);
  const profiles = Object.fromEntries(Object.entries(set.profiles).map(([name, p]) => [name, p.weights]));
  return kindRouting(setId, profiles, set.status === "legacy" ? "single" : "byKind");
}
