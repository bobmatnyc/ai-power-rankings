/**
 * Tool-anchored discovery queries for the news search providers.
 *
 * Why: #476 — the generic OR query and the weekday topic queries (including a
 * funding slot) returned broad AI-industry news, most of which named no tracked
 * tool and was rejected downstream. Anchoring each query on a few tracked tool
 * names, and rotating which tools daily, keeps every query on-topic and sweeps
 * the whole catalogue over a cycle without adding API calls.
 * What: Loads active tool names from the `tools` table (static fallback on any
 * failure), replaces each ambiguous name with tool-specific phrases, packs the
 * tools into groups of up to 4 within provider query limits, and picks the
 * groups for a given day so consecutive days walk the whole list.
 * Test: `tests/unit/discovery-queries-476.test.ts`,
 * `tests/unit/discovery-queries-precision-476.test.ts`.
 */

import { eq } from "drizzle-orm";
import { loggers } from "@/lib/logger";

/**
 * #476: provider lookback for the scheduled daily run. A 14-day window let
 * relevance ranking fill the result pages with week-old stories the previous
 * runs had already seen; 3 days keeps the daily pull to new content while
 * covering a missed cron day. Backfills and manual runs keep the 14-day
 * default; the freshness gate never drops below 14 (see the gate in
 * automated-ingestion.service.ts).
 */
export const DAILY_PROVIDER_WINDOW_DAYS = 3;

/** #476: tool names per query; 3-4 keeps a query focused and under provider length limits. */
export const TOOLS_PER_QUERY = 4;

/**
 * #476: used when the `tools` read fails or returns nothing, so a DB outage
 * degrades query breadth instead of failing the discovery run.
 */
export const FALLBACK_TOOL_NAMES: readonly string[] = [
  "GitHub Copilot",
  "Cursor",
  "Claude Code",
  "Windsurf",
  "Devin",
  "Replit Agent",
  "Amazon Q Developer",
  "OpenAI Codex",
];

/**
 * Reads the names of active tracked tools, sorted for a stable rotation order.
 * Returns FALLBACK_TOOL_NAMES on any error or an empty result; never throws.
 */
export async function loadTrackedToolNames(): Promise<string[]> {
  try {
    const { getDb } = await import("@/lib/db/connection");
    const { tools } = await import("@/lib/db/schema");
    const db = getDb();
    if (!db) throw new Error("database not configured");
    const rows = await db.select({ name: tools.name }).from(tools).where(eq(tools.status, "active"));
    const names = [...new Set(rows.map((r) => r.name.trim()).filter((n) => n.length > 0))].sort();
    if (names.length === 0) throw new Error("no active tools");
    return names;
  } catch (error) {
    loggers.api.warn("[DiscoveryQueries] tools read failed, using static fallback list", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [...FALLBACK_TOOL_NAMES];
  }
}

/**
 * #476: per-query limits. Tavily `/search` rejects a query over 400 characters;
 * Brave caps `q` at 400 characters and 50 words. Both providers get the same
 * queries, so a query must satisfy both.
 */
export const MAX_QUERY_CHARS = 400;
export const MAX_QUERY_WORDS = 50;

/** Qualifier appended to every tool-anchored query. */
export const QUERY_SUFFIX = "AI coding news";

/**
 * #476: tracked tools whose name is a common word, a person's or place's name,
 * or a sport. Bare in an OR chain, `"Cursor"`, `"Devin"` or `"Windsurf"` matched
 * sports, robotics, markets and gadget stories on 2026-11-25 (relevance 0-6).
 * Each maps to the phrases news uses for the tool itself. Keys are lowercase.
 */
export const AMBIGUOUS_TOOL_TERMS: Readonly<Record<string, readonly string[]>> = {
  aider: ["Aider AI", "aider.chat"],
  amp: ["Sourcegraph Amp", "Amp Code"],
  augment: ["Augment Code"],
  bolt: ["Bolt.new"],
  cline: ["Cline AI", "Cline agent"],
  codex: ["OpenAI Codex", "Codex CLI"],
  cody: ["Sourcegraph Cody"],
  continue: ["Continue.dev"],
  copilot: ["GitHub Copilot"],
  cursor: ["Cursor AI", "Cursor IDE", "Anysphere"],
  devin: ["Devin AI", "Cognition AI"],
  factory: ["Factory AI"],
  gemini: ["Gemini Code Assist", "Gemini CLI"],
  goose: ["Goose AI", "Goose agent"],
  jules: ["Google Jules"],
  junie: ["JetBrains Junie"],
  kiro: ["Kiro IDE", "Kiro AI"],
  lovable: ["Lovable AI", "Lovable.dev"],
  sourcery: ["Sourcery AI"],
  trae: ["Trae IDE", "Trae AI"],
  v0: ["v0.dev", "Vercel v0"],
  warp: ["Warp terminal", "Warp AI"],
  windsurf: ["Windsurf IDE", "Windsurf AI", "Windsurf editor"],
  zed: ["Zed editor", "Zed Industries"],
};

/**
 * #476: single-word tracked names that are coined words, so a bare quoted
 * name matches only the tool. Exempt from the generic qualifier below.
 */
export const DISTINCTIVE_SINGLE_WORD_NAMES: ReadonlySet<string> = new Set([
  "anysphere",
  "codeium",
  "coderabbit",
  "openhands",
  "qodo",
  "replit",
  "supermaven",
  "tabnine",
]);

/** Curated phrases for `name` (case-insensitive), or undefined. Own keys only. */
function curatedTerms(name: string): readonly string[] | undefined {
  const key = name.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(AMBIGUOUS_TOOL_TERMS, key) ? AMBIGUOUS_TOOL_TERMS[key] : undefined;
}

/**
 * True when `name` must not appear bare in a query: it is in
 * AMBIGUOUS_TOOL_TERMS, or it is one plain alphabetic word (`Crush`, `Tempo`)
 * not listed in DISTINCTIVE_SINGLE_WORD_NAMES.
 */
export function isAmbiguousToolName(name: string): boolean {
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  if (curatedTerms(key)) return true;
  if (DISTINCTIVE_SINGLE_WORD_NAMES.has(key)) return false;
  // #476: one capitalised word with no digit, dot or inner capital reads as an
  // ordinary word; a new catalogue entry like this gets "<Name> AI".
  return /^[A-Z]?[a-z]+$/.test(trimmed);
}

/**
 * The quoted phrases a query uses for one tool: the curated phrases for a
 * known ambiguous name, `"<Name> AI"` for any other ambiguous name, otherwise
 * the name itself. Double quotes in the name are stripped.
 */
export function searchTermsFor(name: string): string[] {
  const clean = name.replace(/"/g, "").trim();
  const curated = curatedTerms(clean);
  if (curated) return [...curated];
  if (isAmbiguousToolName(clean)) return [`${clean} AI`];
  return [clean];
}

function renderQuery(terms: readonly string[]): string {
  return `${terms.map((t) => `"${t}"`).join(" OR ")} ${QUERY_SUFFIX}`;
}

function withinLimits(query: string): boolean {
  return query.length <= MAX_QUERY_CHARS && query.split(/\s+/).length <= MAX_QUERY_WORDS;
}

/**
 * #476: packs tools into query groups in list order. A group takes up to
 * TOOLS_PER_QUERY tools and closes early when the next tool's phrases would
 * push the rendered query past MAX_QUERY_CHARS or MAX_QUERY_WORDS. Every tool
 * lands in exactly one group, so the rotation still covers the catalogue.
 */
function buildQueryGroups(names: readonly string[]): string[][] {
  const groups: string[][] = [];
  let terms: string[] = [];
  let tools = 0;
  for (const name of names) {
    const next = searchTermsFor(name).filter((t) => t.length > 0 && !terms.includes(t));
    if (next.length === 0) continue;
    if (tools > 0 && (tools >= TOOLS_PER_QUERY || !withinLimits(renderQuery([...terms, ...next])))) {
      groups.push(terms);
      terms = [];
      tools = 0;
    }
    terms.push(...next);
    tools++;
  }
  if (terms.length > 0) groups.push(terms);
  return groups;
}

/** Whole days since the Unix epoch (UTC), the rotation counter. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/**
 * Builds `count` tool-anchored queries for `date`.
 *
 * Why: #476 — anchor every query on tracked tools, and (2026-11-25 follow-up)
 * name ambiguous tools by the phrases news uses for the tool, never bare.
 * What: each query is `"A" OR "B" ... AI coding news` over one group from
 * buildQueryGroups. Day d uses groups d*count .. d*count+count-1 (mod group
 * count), so all groups are covered within ceil(groups / count) days. Output
 * depends only on `toolNames`, the UTC day of `date` and `count`.
 * Test: `tests/unit/discovery-queries-476.test.ts`,
 * `tests/unit/discovery-queries-precision-476.test.ts`.
 */
export function buildToolAnchoredQueries(
  toolNames: readonly string[],
  date: Date,
  count: number
): string[] {
  const names = toolNames.length > 0 ? toolNames : FALLBACK_TOOL_NAMES;
  // #476: phrases per tool replace bare names; packing respects provider limits.
  let groups = buildQueryGroups(names);
  if (groups.length === 0) groups = buildQueryGroups(FALLBACK_TOOL_NAMES);
  const start = dayNumber(date) * count;
  const queries: string[] = [];
  for (let k = 0; k < count; k++) {
    queries.push(renderQuery(groups[(start + k) % groups.length]));
  }
  return queries;
}

