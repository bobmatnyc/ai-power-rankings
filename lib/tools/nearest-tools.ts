/**
 * Nearest catalogue tools for a slug that matched no tool (#193).
 *
 * Why: a mistyped tool URL (`/en/tools/cursr`) answers 404; the 404 page
 * offers the tools the visitor most likely meant instead of a dead end.
 * What: `nearestTools()` ranks active catalogue tools by edit distance between
 * the normalised slug and each tool's slug and name, keeps those close enough
 * to be a plausible typo or a substring, and returns at most
 * `MAX_TOOL_SUGGESTIONS`. Pure; no I/O.
 * Test: `tests/unit/tool-not-found-193.test.tsx` ("nearestTools").
 */

/** A catalogue row as the 404 page reads it. */
export interface SuggestibleTool {
  slug: string;
  name: string;
  status: string;
}

/** A tool the 404 page links to. */
export interface ToolSuggestion {
  slug: string;
  name: string;
}

export const MAX_TOOL_SUGGESTIONS = 5;

/** A candidate whose score (distance / longer length) is above this is not suggested. */
const MAX_SCORE = 0.4;

/** Bounds the O(n·m) distance work for a long URL segment. */
const MAX_QUERY_LENGTH = 64;

/** Lower-case ASCII words joined by `-`: "GitHub Copilot" → "github-copilot". */
export function normaliseToolKey(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** 0 for an exact key, rising with distance; a substring of 4+ characters scores half. */
function score(query: string, key: string): number {
  const ratio = levenshtein(query, key) / Math.max(query.length, key.length);
  const shorter = query.length < key.length ? query : key;
  const contained = shorter.length >= 4 && (key.includes(query) || query.includes(key));
  return contained ? ratio / 2 : ratio;
}

/**
 * Up to `limit` active tools nearest to `slug`, closest first.
 *
 * Postcondition: every result is an active tool from `tools`, slugs are
 * unique, the length is at most `limit`, and an empty or unmatched slug gives
 * `[]`. Ties order by slug.
 */
export function nearestTools(
  slug: string,
  tools: readonly SuggestibleTool[],
  limit: number = MAX_TOOL_SUGGESTIONS
): ToolSuggestion[] {
  const query = normaliseToolKey(slug).slice(0, MAX_QUERY_LENGTH);
  if (!query || limit <= 0) return [];

  const best = new Map<string, { tool: ToolSuggestion; score: number }>();
  for (const tool of tools) {
    if (tool.status !== "active" || typeof tool.slug !== "string" || !tool.slug) continue;
    const keys = [normaliseToolKey(tool.slug), normaliseToolKey(String(tool.name ?? ""))].filter(Boolean);
    const toolScore = Math.min(...keys.map((key) => score(query, key)));
    if (toolScore > MAX_SCORE) continue;
    const seen = best.get(tool.slug);
    if (!seen || toolScore < seen.score) {
      best.set(tool.slug, { tool: { slug: tool.slug, name: String(tool.name ?? tool.slug) }, score: toolScore });
    }
  }

  return [...best.values()]
    .sort((a, b) => a.score - b.score || a.tool.slug.localeCompare(b.tool.slug))
    .slice(0, limit)
    .map(({ tool }) => tool);
}
