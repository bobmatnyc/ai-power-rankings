/**
 * Scoring configs for the activation tests (#185 PR-3).
 *
 * Why: the publish tests need the v8.0-active config, one-change copies of it, and a
 *   config whose active set is the legacy v7.10 table (the refusal arm). Since the
 *   switch, the checked-in config is v8.0-active with no `other` profile
 *   (the v8.0 set drops it), so the v8.0-active config is the checked-in one, unchanged.
 * What: `v8ActiveRaw()` is a deep copy of the checked-in config; `v8ActiveConfig()`
 *   parses it. `legacyActiveConfig()` is the same copy with `activeProfileSet` set to
 *   v7.10. Each goes through the real `parseScoringProfiles()`, so the active-set rule
 *   still runs. Test data only: no production code path builds these configs.
 */
import checkedIn from "../../config/scoring-profiles.json";
import { parseScoringProfiles, type ScoringProfilesConfig } from "../../lib/scoring-profiles";

export function v8ActiveRaw(): Record<string, any> {
  return JSON.parse(JSON.stringify(checkedIn)) as Record<string, any>;
}

export function v8ActiveConfig(): ScoringProfilesConfig {
  return parseScoringProfiles(v8ActiveRaw());
}

/** The checked-in config with the legacy v7.10 set active, which the per-list publish refuses. */
export function legacyActiveConfig(): ScoringProfilesConfig {
  const raw = v8ActiveRaw();
  raw["activeProfileSet"] = "v7.10";
  return parseScoringProfiles(raw);
}
