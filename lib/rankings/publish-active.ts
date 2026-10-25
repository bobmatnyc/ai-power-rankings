/**
 * The publish path after v8 activation: per-list boards under the active profile set (#185).
 *
 * Why: #185 PR-3 ends the combined board as a published output. The monthly cron and
 *   the CLI must publish one board per list (#186), each scored by its kind's profile
 *   (v8), and a profile problem must stop the run before anything is written: a wrong
 *   weight table would publish plausible but wrong ranks.
 * What: `resolvePublishScoring()` turns a validated config into the per-list scoring
 *   of the set `activeProfileSet` names. It refuses a legacy (one-table) set, a set
 *   without a profile for every list, and a set with a profile for no list (#185). `publishActiveRankings()` loads the checked-in
 *   config, resolves the scoring, then calls `regenerateRankings()` with the per-list
 *   layout. It never calls the combined layout. `activeProfileSet` in
 *   `config/scoring-profiles.json` is the one config point that selects the set; the
 *   loader also applies the active-set rule (`activeSetProblems()`), so a refused set
 *   throws here too, before any read or write.
 * Test: `tests/unit/publish-active-185.test.ts`, `lib/scoring-profiles.activation-185.test.ts`.
 */

import { invalidateRankingsCache } from "@/lib/cache/invalidation.service";
import { RANKING_LISTS } from "@/lib/rankings/lists";
import { profileRouting } from "@/lib/scoring-kind-routing";
import {
  loadCheckedInScoringProfiles,
  ScoringProfileError,
  type ScoringProfilesConfig,
} from "@/lib/scoring-profiles";
import {
  type PerListScoring,
  type RankingGenerationResult,
  type RegenerateRankingsOptions,
  regenerateRankings,
} from "@/lib/services/ranking-generation.service";

/**
 * The per-list scoring of the active profile set.
 *
 * Precondition: `config` passed `parseScoringProfiles()`. Postcondition: the routing
 * is the active set's `byKind` routing, its profiles are exactly the lists in
 * `RANKING_LISTS`, and `algorithmVersion` is the set id without a leading "v".
 * Throws `ScoringProfileError` otherwise.
 */
export function resolvePublishScoring(config: ScoringProfilesConfig): PerListScoring {
  const setId = config.activeProfileSet;
  const set = config.profileSets[setId];
  if (!set) throw new ScoringProfileError([`activeProfileSet "${setId}" names no profile set`]);
  // #185: the legacy set has one table for every tool; per-list boards are scored by kind (v8).
  if (set.status === "legacy") {
    throw new ScoringProfileError([
      `activeProfileSet "${setId}" is the legacy one-table set; the per-list publish needs a per-kind (v8) set`,
    ]);
  }
  const missing = RANKING_LISTS.filter((list) => !Object.hasOwn(set.profiles, list));
  if (missing.length > 0) {
    throw new ScoringProfileError([`active set "${setId}" has no profile for list(s): ${missing.join(", ")}`]);
  }
  // #185: the active set's profiles and RANKING_LISTS must match; a profile with no list
  // (the dropped `other`, owner ruling v8 Q3) would be scored for a board no reader serves.
  const unlisted = Object.keys(set.profiles).filter((name) => !(RANKING_LISTS as readonly string[]).includes(name));
  if (unlisted.length > 0) {
    throw new ScoringProfileError([`active set "${setId}" has profile(s) for no list: ${unlisted.join(", ")}`]);
  }
  return { setId, algorithmVersion: setId.replace(/^v/, ""), routing: profileRouting(config, setId) };
}

export type PublishActiveOptions = Omit<RegenerateRankingsOptions, "layout" | "mode" | "scoring"> & {
  /** Test seam: the profile config to publish with. Defaults to the checked-in file. */
  loadProfiles?: () => ScoringProfilesConfig;
};

/**
 * Publish one current board per list, scored by the active profile set (#185).
 *
 * The config is loaded and resolved before `regenerateRankings()` runs, so a refused
 * or invalid set throws with no read and no write. A failed write rolls back inside
 * `saveListSnapshots()` and is rethrown; there is no fallback to the combined layout.
 * Only after a committed publish it calls `invalidateRankingsCache()`.
 */
export async function publishActiveRankings(options: PublishActiveOptions = {}): Promise<RankingGenerationResult> {
  const { loadProfiles = loadCheckedInScoringProfiles, ...rest } = options;
  const scoring = resolvePublishScoring(loadProfiles());
  // #185: the publish path writes the per-list boards only; the combined rows stay as they are (D55).
  const result = await regenerateRankings({ ...rest, mode: "publish", layout: "per-list", scoring });
  // #185: a committed publish revalidates the rankings pages and routes (tag `rankings`,
  // the home, rankings and tools layouts) and clears their in-memory entries, so no cached
  // pre-publish body (an empty board or a 404) outlives it. A revalidation error is logged
  // inside and never undoes or fails the publish that already committed.
  await invalidateRankingsCache();
  return result;
}
