/**
 * Tool-anchored discovery queries for the news search providers.
 *
 * Why: #476 — the generic OR query and the weekday topic queries (including a
 * funding slot) returned broad AI-industry news, most of which named no tracked
 * tool and was rejected downstream. Anchoring each query on a few tracked tool
 * names, and rotating which tools daily, keeps every query on-topic and sweeps
 * the whole catalogue over a cycle without adding API calls.
 * What: Loads active tool names from the `tools` table (static fallback on any
 * failure), groups them into fixed-size chunks, and picks the chunks for a
 * given day so consecutive days walk the whole list.
 * Test: `tests/unit/discovery-queries-476.test.ts`.
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

/** Whole days since the Unix epoch (UTC), the rotation counter. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/**
 * Builds `count` tool-anchored queries for `date`.
 *
 * Each query is `"A" OR "B" OR "C" OR "D"` plus a short news qualifier. Day d
 * uses groups d*count .. d*count+count-1 (mod group count), so all groups are
 * covered within ceil(groups / count) days.
 */
export function buildToolAnchoredQueries(
  toolNames: readonly string[],
  date: Date,
  count: number
): string[] {
  const names = toolNames.length > 0 ? toolNames : FALLBACK_TOOL_NAMES;
  const groups: string[][] = [];
  for (let i = 0; i < names.length; i += TOOLS_PER_QUERY) {
    groups.push(names.slice(i, i + TOOLS_PER_QUERY) as string[]);
  }
  const start = dayNumber(date) * count;
  const queries: string[] = [];
  for (let k = 0; k < count; k++) {
    const group = groups[(start + k) % groups.length];
    queries.push(`${group.map((n) => `"${n}"`).join(" OR ")} AI coding news`);
  }
  return queries;
}
