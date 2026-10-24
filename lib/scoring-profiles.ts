/**
 * Scoring profile loader and validator (#185).
 *
 * Why: v8 moves factor weights out of a hardcoded constant into
 *   `config/scoring-profiles.json`, one weight table per profile. A config
 *   error must stop a run, never fall back to defaults or renormalise, because
 *   a silently wrong table would change the published rankings.
 * What: `parseScoringProfilesText()` / `parseScoringProfiles()` validate the
 *   whole file and throw `ScoringProfileError` listing every problem.
 *   `profileWeights()` returns one profile's weights in the engine's factor
 *   order. Nothing in the publish path calls this module (PR-2 is still
 *   inert); the v8 measurement script and `lib/scoring-kind-routing.ts` are
 *   its callers. An optional `provisional` string marks a profile that awaits
 *   a ruling; it is metadata and never changes a weight.
 *   Rules: every profile has exactly the eight engine factors, each weight a
 *   finite number in [0, 1] on a 0.0001 grid, and the weights sum exactly to
 *   the profile's `declaredTotal` (compared in basis points, so float drift
 *   cannot pass or fail a sum). Only a `legacy` set, which must be `frozen`,
 *   may declare a total other than 1.00.
 * Test: `lib/scoring-profiles.test.ts`
 */

import { readFileSync } from "node:fs";

import checkedInProfiles from "@/config/scoring-profiles.json";

import type { RankingWeightsV76 } from "./ranking-algorithm-v76";

/** The engine's factors, in `ALGORITHM_V76_WEIGHTS` order. */
export const FACTOR_KEYS = [
  "agenticCapability",
  "innovation",
  "technicalPerformance",
  "developerAdoption",
  "marketTraction",
  "businessSentiment",
  "developmentVelocity",
  "platformResilience",
] as const satisfies readonly (keyof RankingWeightsV76)[];

export type ProfileSetStatus = "legacy" | "active" | "staged";

export interface ScoringProfile {
  declaredTotal: number;
  weights: RankingWeightsV76;
  /** #185: present while the profile awaits the ruling it names (e.g. the model profile, D4d). */
  provisional?: string;
}

export interface ProfileSet {
  label: string;
  status: ProfileSetStatus;
  frozen: boolean;
  description?: string;
  profiles: Record<string, ScoringProfile>;
}

export interface ScoringProfilesConfig {
  schemaVersion: 1;
  activeProfileSet: string;
  profileSets: Record<string, ProfileSet>;
}

/** A config that fails validation; `problems` lists every rule it breaks. */
export class ScoringProfileError extends Error {
  constructor(public readonly problems: string[]) {
    super(`invalid scoring profiles: ${problems.join("; ")}`);
    this.name = "ScoringProfileError";
  }
}

const STATUSES: readonly ProfileSetStatus[] = ["legacy", "active", "staged"];
const BASIS_POINTS = 10_000;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// A weight in basis points, or null when it is not on the 0.0001 grid.
function toBasisPoints(value: number): number | null {
  const scaled = value * BASIS_POINTS;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : null;
}

function validateProfile(where: string, raw: unknown, legacy: boolean, problems: string[]): ScoringProfile | null {
  if (!isObject(raw)) {
    problems.push(`${where} is not an object`);
    return null;
  }
  const declared = raw["declaredTotal"];
  const declaredBp = typeof declared === "number" && Number.isFinite(declared) && declared > 0 ? toBasisPoints(declared) : null;
  if (declaredBp === null) {
    problems.push(`${where}.declaredTotal must be a positive number on a 0.0001 grid`);
  } else if (!legacy && declaredBp !== BASIS_POINTS) {
    problems.push(`${where}.declaredTotal is ${String(declared)}; only a legacy set may declare a total other than 1`);
  }

  const weights = raw["weights"];
  if (!isObject(weights)) {
    problems.push(`${where}.weights is not an object`);
    return null;
  }
  const unknown = Object.keys(weights).filter((key) => !(FACTOR_KEYS as readonly string[]).includes(key));
  if (unknown.length > 0) problems.push(`${where}.weights has unknown factor(s): ${unknown.join(", ")}`);

  let sumBp = 0;
  let valid = unknown.length === 0;
  for (const key of FACTOR_KEYS) {
    const value = weights[key];
    if (value === undefined) {
      problems.push(`${where}.weights is missing ${key}`);
      valid = false;
      continue;
    }
    const bp = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? toBasisPoints(value) : null;
    if (bp === null) {
      problems.push(`${where}.weights.${key} must be a number in [0, 1] on a 0.0001 grid`);
      valid = false;
      continue;
    }
    sumBp += bp;
  }
  if (valid && declaredBp !== null && sumBp !== declaredBp) {
    problems.push(`${where}.weights sum to ${sumBp / BASIS_POINTS}, not the declared ${declaredBp / BASIS_POINTS}`);
    valid = false;
  }
  if (!valid || declaredBp === null) return null;

  // Engine factor order, so the weighted sum adds in the same order as ALGORITHM_V76_WEIGHTS.
  const ordered = Object.fromEntries(FACTOR_KEYS.map((key) => [key, weights[key] as number])) as unknown as RankingWeightsV76;
  const provisional = raw["provisional"];
  if (provisional !== undefined && (typeof provisional !== "string" || provisional.trim() === "")) {
    problems.push(`${where}.provisional must be a non-empty string naming the pending ruling`);
    return null;
  }
  return { declaredTotal: declared as number, weights: ordered, ...(provisional ? { provisional } : {}) };
}

function validateSet(id: string, raw: unknown, problems: string[]): ProfileSet | null {
  const where = `profileSets.${id}`;
  if (!isObject(raw)) {
    problems.push(`${where} is not an object`);
    return null;
  }
  const status = raw["status"];
  if (typeof status !== "string" || !(STATUSES as readonly string[]).includes(status)) {
    problems.push(`${where}.status must be one of ${STATUSES.join(", ")}`);
  }
  if (raw["label"] !== id) problems.push(`${where}.label must equal its key "${id}"`);
  if (typeof raw["frozen"] !== "boolean") problems.push(`${where}.frozen must be a boolean`);
  const legacy = status === "legacy";
  if (legacy && raw["frozen"] !== true) problems.push(`${where} is legacy and must be frozen`);

  const rawProfiles = raw["profiles"];
  if (!isObject(rawProfiles) || Object.keys(rawProfiles).length === 0) {
    problems.push(`${where}.profiles must name at least one profile`);
    return null;
  }
  const before = problems.length;
  const profiles: Record<string, ScoringProfile> = {};
  for (const [name, profile] of Object.entries(rawProfiles)) {
    const parsed = validateProfile(`${where}.profiles.${name}`, profile, legacy, problems);
    if (parsed) profiles[name] = parsed;
  }
  if (problems.length > before) return null;
  return {
    label: id,
    status: status as ProfileSetStatus,
    frozen: raw["frozen"] as boolean,
    ...(typeof raw["description"] === "string" ? { description: raw["description"] } : {}),
    profiles,
  };
}

/**
 * Validate an already-parsed config object.
 *
 * Postcondition: every returned profile's weights sum, in basis points, to its
 * `declaredTotal`, and `activeProfileSet` names a returned set. Throws
 * `ScoringProfileError` otherwise; never returns a partial config.
 */
export function parseScoringProfiles(raw: unknown): ScoringProfilesConfig {
  const problems: string[] = [];
  if (!isObject(raw)) throw new ScoringProfileError(["the config is not a JSON object"]);
  if (raw["schemaVersion"] !== 1) problems.push("schemaVersion must be 1");

  const rawSets = raw["profileSets"];
  const sets: Record<string, ProfileSet> = {};
  if (!isObject(rawSets) || Object.keys(rawSets).length === 0) {
    problems.push("profileSets must name at least one set");
  } else {
    for (const [id, set] of Object.entries(rawSets)) {
      const parsed = validateSet(id, set, problems);
      if (parsed) sets[id] = parsed;
    }
  }
  const active = raw["activeProfileSet"];
  if (typeof active !== "string" || !isObject(rawSets) || !(active in rawSets)) {
    problems.push("activeProfileSet must name a set in profileSets");
  }
  if (problems.length > 0) throw new ScoringProfileError(problems);
  return { schemaVersion: 1, activeProfileSet: active as string, profileSets: sets };
}

/** Parse and validate config text; a JSON syntax error is a `ScoringProfileError` too. */
export function parseScoringProfilesText(text: string): ScoringProfilesConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ScoringProfileError([`the config does not parse as JSON (${error instanceof Error ? error.name : "error"})`]);
  }
  return parseScoringProfiles(raw);
}

/** Read and validate a config file. */
export function loadScoringProfiles(path: string): ScoringProfilesConfig {
  return parseScoringProfilesText(readFileSync(path, "utf8"));
}

/** Validate the checked-in `config/scoring-profiles.json`. */
export function loadCheckedInScoringProfiles(): ScoringProfilesConfig {
  return parseScoringProfiles(checkedInProfiles);
}

/** One profile's weights. Throws when the set or profile does not exist. */
export function profileWeights(config: ScoringProfilesConfig, setId: string, profile: string): RankingWeightsV76 {
  const weights = config.profileSets[setId]?.profiles[profile]?.weights;
  if (!weights) throw new ScoringProfileError([`no profile "${profile}" in set "${setId}"`]);
  return { ...weights };
}
