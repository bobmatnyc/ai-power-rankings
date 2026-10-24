/**
 * The tool page's profile block, computed from stored data only (#193).
 *
 * Why: the tool page body is client-rendered, so its server HTML held only
 * "Loading". The profile block renders on the server in four fixed sections:
 * verdict, score and rank, change since last month, and alternatives. No text
 * is generated; every value is picked from the catalogue row or a stored
 * ranking snapshot.
 * What: `pickVerdict()` chooses the verdict text; `buildToolProfile()` turns a
 * catalogue tool plus the cached ranking data into the four sections' values.
 * Pure; no I/O. The cached read lives in `tool-profile-data.ts`.
 * Test: `tests/unit/tool-profile-193.test.tsx`.
 */
import { entryRank, entryScore, matchesTool, type RawRankingEntry } from "./ranking-entry";

export const MAX_ALTERNATIVES = 3;

/** A snapshot row reduced to what the block reads. Plain JSON, so it can be cached. */
export interface ProfileEntry {
  tool_id?: string;
  tool_slug?: string;
  tool_name?: string;
  rank: number;
  score: number;
}

/** One ranking period. */
export interface ProfileSnapshot {
  period: string;
  algorithmVersion: string;
  entries: ProfileEntry[];
}

/** An active catalogue tool, as alternatives read it. */
export interface ProfileCatalogueTool {
  slug: string;
  name: string;
  category: string;
}

/**
 * The cached input: the `is_current` period, the latest period before it,
 * and the active catalogue. `current` is null when no period is current.
 */
export interface ProfileRankingData {
  current: ProfileSnapshot | null;
  previous: ProfileSnapshot | null;
  activeTools: ProfileCatalogueTool[];
}

/** The catalogue tool the page renders, in any status. */
export interface ProfileTool {
  id: string;
  slug: string;
  name: string;
  category: string;
  info?: unknown;
}

export type ToolStanding =
  | { kind: "unavailable" }
  | { kind: "unranked" }
  | { kind: "ranked"; rank: number; score: number; period: string; total: number };

export type ToolChange =
  | { kind: "unavailable" }
  | { kind: "unranked" }
  | { kind: "no-history"; period: string }
  | { kind: "new"; period: string; previousPeriod: string }
  | {
      kind: "moved";
      period: string;
      previousPeriod: string;
      rank: number;
      previousRank: number;
      /** Places gained: positive moved up, negative moved down. */
      rankDelta: number;
      /** Null when the two periods used different algorithm versions. */
      scoreDelta: number | null;
      algorithmVersion: string;
      previousAlgorithmVersion: string;
    };

export interface ToolAlternative {
  slug: string;
  name: string;
  rank: number;
  score: number;
}

export interface ToolProfile {
  /** Null means no stored text: the block shows its fallback sentence. */
  verdict: string | null;
  standing: ToolStanding;
  change: ToolChange;
  /** Null when the ranking data could not be read. */
  alternatives: ToolAlternative[] | null;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const field = (value: unknown, key: string): unknown =>
  value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;

/** The first non-empty of `info.product.tagline`, `info.product.description`, `info.summary`; else null. */
export function pickVerdict(info: unknown): string | null {
  const product = field(info, "product");
  return text(field(product, "tagline")) || text(field(product, "description")) || text(field(info, "summary")) || null;
}

/** Reduces a stored snapshot row to a `ProfileEntry`. */
export function toProfileEntry(entry: RawRankingEntry): ProfileEntry {
  const pick = (key: string) => (typeof entry[key] === "string" ? (entry[key] as string) : undefined);
  return {
    tool_id: pick("tool_id"),
    tool_slug: pick("tool_slug"),
    tool_name: pick("tool_name"),
    rank: entryRank(entry),
    score: entryScore(entry),
  };
}

const findEntry = (snapshot: ProfileSnapshot, tool: ProfileTool): ProfileEntry | undefined =>
  snapshot.entries.find((entry) => matchesTool(entry, tool));

/** One decimal, as the client header shows scores; avoids float noise such as 0.30000000000000004. */
const round1 = (value: number): number => Math.round(value * 10) / 10;

function changeFor(tool: ProfileTool, data: ProfileRankingData, current: ProfileEntry | undefined): ToolChange {
  if (!data.current || !current) return { kind: "unranked" };
  const period = data.current.period;
  if (!data.previous) return { kind: "no-history", period };
  const previous = findEntry(data.previous, tool);
  if (!previous || !previous.rank) return { kind: "new", period, previousPeriod: data.previous.period };
  // #193: rank always compares; scores only within one algorithm version.
  const sameVersion = data.current.algorithmVersion === data.previous.algorithmVersion;
  return {
    kind: "moved",
    period,
    previousPeriod: data.previous.period,
    rank: current.rank,
    previousRank: previous.rank,
    rankDelta: previous.rank - current.rank,
    scoreDelta: sameVersion ? round1(current.score - previous.score) : null,
    algorithmVersion: data.current.algorithmVersion,
    previousAlgorithmVersion: data.previous.algorithmVersion,
  };
}

/**
 * Up to three active tools in `tool.category`, highest score first.
 *
 * Postcondition: no result is the tool itself or a non-active catalogue tool;
 * every result has a score in the current period; the length is at most
 * `MAX_ALTERNATIVES`; ties order by rank, then slug.
 */
function alternativesFor(tool: ProfileTool, data: ProfileRankingData): ToolAlternative[] {
  if (!data.current) return [];
  const peers = new Map(
    data.activeTools.filter((t) => t.category === tool.category && t.slug !== tool.slug).map((t) => [t.slug, t])
  );
  const seen = new Set<string>();
  const result: ToolAlternative[] = [];
  for (const entry of data.current.entries) {
    const peer = entry.tool_slug ? peers.get(entry.tool_slug) : undefined;
    if (!peer || seen.has(peer.slug) || entry.score <= 0 || !entry.rank) continue;
    if (matchesTool(entry, tool)) continue;
    seen.add(peer.slug);
    result.push({ slug: peer.slug, name: peer.name, rank: entry.rank, score: entry.score });
  }
  return result
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.slug.localeCompare(b.slug))
    .slice(0, MAX_ALTERNATIVES);
}

/** The four sections' values for `tool`; `data` null means the ranking read failed. */
export function buildToolProfile(tool: ProfileTool, data: ProfileRankingData | null): ToolProfile {
  const verdict = pickVerdict(tool.info);
  if (!data) {
    return { verdict, standing: { kind: "unavailable" }, change: { kind: "unavailable" }, alternatives: null };
  }
  const current = data.current ? findEntry(data.current, tool) : undefined;
  const standing: ToolStanding =
    data.current && current && current.rank
      ? {
          kind: "ranked",
          rank: current.rank,
          score: current.score,
          period: data.current.period,
          total: data.current.entries.length,
        }
      : { kind: "unranked" };
  return {
    verdict,
    standing,
    change: standing.kind === "ranked" ? changeFor(tool, data, current) : { kind: "unranked" },
    alternatives: alternativesFor(tool, data),
  };
}
