/**
 * A v8.0-active scoring config for activation tests (#185 PR-3).
 *
 * Why: the checked-in config keeps `activeProfileSet` at v7.10, because the v8.0 set
 *   still holds the provisional `other` profile, which the active-set rule refuses
 *   until the owner rules on it. Activation must still be tested end to end.
 * What: the checked-in config with `activeProfileSet` set to v8.0 and the `other`
 *   profile left out, the same shape `tests/unit/scoring-profiles-active-set-186.test.ts`
 *   builds. It goes through the real `parseScoringProfiles()`, so the active-set rule
 *   still runs. Test data only: no production code path builds this config.
 */
import checkedIn from "../../config/scoring-profiles.json";
import { parseScoringProfiles, type ScoringProfilesConfig } from "../../lib/scoring-profiles";

export function v8ActiveRaw(): Record<string, any> {
  const config = JSON.parse(JSON.stringify(checkedIn)) as Record<string, any>;
  config["activeProfileSet"] = "v8.0";
  delete config["profileSets"]["v8.0"]["profiles"]["other"];
  return config;
}

export function v8ActiveConfig(): ScoringProfilesConfig {
  return parseScoringProfiles(v8ActiveRaw());
}
