/**
 * Before/after table for a ranking-engine version change (#101).
 *
 * Why: v7.10 may only publish after the owner reviews a real-data table of
 *   v7.9 against v7.10 (ruling D15). This module builds that table from tool
 *   rows that are already in memory; it never reads or writes a database.
 * What: scores the same tools with the v7.9 engine (info-path fold off) and
 *   the v7.10 engine (the publish path's engine), ranks each board the way
 *   `computeRankings()` does, and returns one row per tool: movers first, then
 *   by absolute rank delta, then by new rank.
 * Test: `lib/ranking-version-compare.test.ts`
 */

import {
  ALGORITHM_V76_WEIGHTS,
  ALGORITHM_VERSION,
  RankingEngineV76,
  type ToolMetricsV76,
} from "./ranking-algorithm-v76";
import type { RankingSourceTool } from "./services/ranking-generation.service";

/** The engine behaviour the v7.10 change is compared against. */
export const BASELINE_VERSION = "v7.9";
export const CANDIDATE_VERSION = ALGORITHM_VERSION;

export interface ComparisonRow {
  tool: string;
  slug: string;
  oldRank: number;
  newRank: number;
  /** oldRank - newRank: positive means the tool moved up. */
  rankDelta: number;
  oldScore: number;
  newScore: number;
  scoreDelta: number;
}

interface Placement {
  rank: number;
  score: number;
}

/** Same input shape `computeRankings()` passes to the engine. */
function toEngineInput(tool: RankingSourceTool): ToolMetricsV76 {
  const data = (tool.data ?? {}) as Record<string, unknown>;
  return {
    tool_id: tool.id,
    name: tool.name,
    slug: tool.slug,
    category: tool.category,
    status: tool.status,
    info: data,
    metrics: (data["metrics"] as Record<string, unknown>) ?? {},
  } as ToolMetricsV76;
}

/** Score and rank one board; ties keep input order, as `computeRankings()` does. */
function rankBoard(
  tools: RankingSourceTool[],
  engine: RankingEngineV76,
  date: Date
): Map<string, Placement> {
  const scored = tools
    .map((tool) => ({ id: tool.id, score: engine.calculateToolScore(toEngineInput(tool), date).overallScore }))
    .sort((a, b) => b.score - a.score);
  return new Map(scored.map((s, i) => [s.id, { rank: i + 1, score: s.score }]));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Build the v7.9 → v7.10 table for `tools` at clock `date`.
 *
 * Postcondition: one row per input tool; rows with `rankDelta !== 0` come
 * first, ordered by `|rankDelta|` descending, then by `newRank`.
 */
export function buildComparisonTable(tools: RankingSourceTool[], date: Date): ComparisonRow[] {
  const baseline = new RankingEngineV76(ALGORITHM_V76_WEIGHTS, {}, { foldInfoGroups: false });
  const candidate = new RankingEngineV76(ALGORITHM_V76_WEIGHTS);
  const before = rankBoard(tools, baseline, date);
  const after = rankBoard(tools, candidate, date);

  const rows = tools.map((tool): ComparisonRow => {
    const old = before.get(tool.id)!;
    const now = after.get(tool.id)!;
    return {
      tool: tool.name,
      slug: tool.slug,
      oldRank: old.rank,
      newRank: now.rank,
      rankDelta: old.rank - now.rank,
      oldScore: old.score,
      newScore: now.score,
      scoreDelta: round3(now.score - old.score),
    };
  });

  return rows.sort((a, b) => {
    const moverA = a.rankDelta !== 0 ? 0 : 1;
    const moverB = b.rankDelta !== 0 ? 0 : 1;
    if (moverA !== moverB) return moverA - moverB;
    const byDelta = Math.abs(b.rankDelta) - Math.abs(a.rankDelta);
    return byDelta !== 0 ? byDelta : a.newRank - b.newRank;
  });
}

function signed(n: number, digits = 0): string {
  const text = n.toFixed(digits);
  return n > 0 ? `+${text}` : text;
}

/** Render rows as a Markdown table plus a one-line summary. */
export function formatComparisonTable(rows: ComparisonRow[]): string {
  const header = [
    `| Tool | Old rank (${BASELINE_VERSION}) | New rank (${CANDIDATE_VERSION}) | Delta | Old score | New score | Score delta |`,
    "|---|---|---|---|---|---|---|",
  ];
  const body = rows.map(
    (r) =>
      `| ${r.tool} | ${r.oldRank} | ${r.newRank} | ${signed(r.rankDelta)} | ${r.oldScore.toFixed(3)} | ${r.newScore.toFixed(3)} | ${signed(r.scoreDelta, 3)} |`
  );
  const movers = rows.filter((r) => r.rankDelta !== 0).length;
  return [...header, ...body, "", `${rows.length} tools, ${movers} change rank.`].join("\n");
}

// Anything URL-shaped, plus `key=value` pairs that look like credentials.
const SECRET_PATTERNS = [/[a-z][a-z0-9+.-]*:\/\/\S+/gi, /\b\w*(password|secret|token|key)\w*=\S+/gi];

/**
 * Strip connection strings and credential-like pairs from text bound for stdout.
 *
 * `literals` are exact strings to remove as well. #101: a driver error can name
 * the database host without a URL scheme, which the patterns above miss.
 */
export function redactSecrets(text: string, literals: readonly string[] = []): string {
  const patterned = SECRET_PATTERNS.reduce((out, pattern) => out.replace(pattern, "[redacted]"), text);
  return literals
    .filter((literal) => literal.length >= 4)
    .reduce((out, literal) => out.split(literal).join("[redacted]"), patterned);
}

/**
 * The parts of a connection string worth redacting verbatim: the whole string,
 * host, user and password. An unparseable string yields only itself.
 */
export function connectionStringLiterals(connectionString: string | undefined): string[] {
  if (!connectionString) return [];
  try {
    const url = new URL(connectionString);
    const parts = [url.hostname, decodeURIComponent(url.username), decodeURIComponent(url.password)];
    return [connectionString, ...parts.filter(Boolean)];
  } catch {
    return [connectionString];
  }
}
