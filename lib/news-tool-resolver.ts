/**
 * Attributes a news article to tools in the tool catalogue (#109).
 *
 * Why: the news routes used a hand-kept list of 15 coarse slugs
 * (`lib/tool-matcher.ts`, now deleted) and read a mention key the stored data
 * does not use, so articles got no tool or a slug that is not in the catalogue.
 * What: pure functions, no DB access. The catalogue is the only source of a
 * slug, so every tool returned here is a catalogue row. Matching is exact and
 * case-insensitive; there is no fuzzy or partial matching, because a wrong
 * attribution is worse than none.
 * Test: `tests/unit/news-tool-resolver-109.test.ts`.
 */

/** The catalogue fields the resolver reads. A row may carry more. */
export interface CatalogueTool {
  /** Tool id (the JSONB `id`, or the row UUID when the JSONB has none). */
  id: string;
  /** Row UUID, when it differs from `id`. */
  db_id?: string;
  slug: string;
  name: string;
}

/** Lookup tables built once from the catalogue rows. */
export interface ToolCatalogue<T extends CatalogueTool = CatalogueTool> {
  byId: Map<string, T>;
  /** Lower-cased, trimmed name and slug → tool. */
  byKey: Map<string, T>;
  /** Multi-word or non-letter catalogue names as case-sensitive title patterns, longest first. */
  titleTerms: Array<{ term: string; pattern: RegExp; tool: T }>;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/** True for a name that is one token of letters only ("Warp", not "v0" or "Bolt.new"). */
function isSingleWordName(name: string): boolean {
  return /^\p{L}+$/u.test(name);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds the lookup tables for `resolveArticleTools`.
 *
 * What: indexes each row by `id` and `db_id`, and by its name and slug
 * (case-insensitive). The first row wins a duplicate key. A row without a
 * string slug and name is skipped.
 */
export function buildToolCatalogue<T extends CatalogueTool>(tools: readonly T[]): ToolCatalogue<T> {
  const byId = new Map<string, T>();
  const byKey = new Map<string, T>();
  const terms = new Map<string, T>();

  for (const tool of tools) {
    if (typeof tool?.slug !== "string" || typeof tool?.name !== "string") continue;
    for (const id of [tool.id, tool.db_id]) {
      if (typeof id === "string" && id && !byId.has(id)) byId.set(id, tool);
    }
    for (const raw of [tool.name, tool.slug]) {
      const key = normalizeKey(raw);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, tool);
    }
    // #109: title terms are catalogue names only, as stored (case-sensitive).
    // A single all-letter name ("Continue", "Warp", "AI") is an ordinary word
    // in headlines, so it is attributed through mentions only.
    const name = tool.name.trim();
    if (name && !isSingleWordName(name) && !terms.has(name)) terms.set(name, tool);
  }

  // A term matches only as a whole word: no letter or digit may touch either
  // end, so "Claude Code" does not match "Claude Codex" and "v0" not "rev0".
  const titleTerms = [...terms.entries()]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([term, tool]) => ({
      term,
      pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "u"),
      tool,
    }));

  return { byId, byKey, titleTerms };
}

/** Reads the id and the name a stored mention carries, in any stored shape. */
function readMention(mention: unknown): { id?: string; name?: string } {
  if (typeof mention === "string") return { id: mention, name: mention };
  if (!mention || typeof mention !== "object") return {};
  const m = mention as Record<string, unknown>;
  const id = [m["toolId"], m["tool_id"]].find((v) => typeof v === "string") as string | undefined;
  const name = [m["name"], m["tool"]].find((v) => typeof v === "string") as string | undefined;
  return { id, name };
}

/** Catalogue tools named in a title, in order of first appearance. */
function matchTitle<T extends CatalogueTool>(title: string, catalogue: ToolCatalogue<T>): T[] {
  const hits: Array<{ start: number; end: number; tool: T }> = [];
  for (const { pattern, tool } of catalogue.titleTerms) {
    const match = pattern.exec(title);
    if (!match) continue;
    const start = match.index;
    const end = start + match[0].length;
    // Longest terms come first, so a shorter term inside a longer match
    // ("Claude" inside "Claude Code") is the same mention, not a second tool.
    if (hits.some((h) => start < h.end && end > h.start)) continue;
    hits.push({ start, end, tool });
  }
  return hits.sort((a, b) => a.start - b.start).map((h) => h.tool);
}

/**
 * The catalogue tools an article is about, primary tool first.
 *
 * What, in order:
 * 1. Each mention's `toolId` (or a string mention) that is a catalogue id.
 * 2. Otherwise the mention's name, equal to a catalogue name or slug
 *    (case-insensitive, trimmed).
 * 3. Only when no mention resolves: catalogue names (never slugs) found in the
 *    title as whole words, case-sensitive. A single all-letter name never matches.
 *
 * A mention that resolves to nothing is dropped. Duplicates are removed.
 * Returns `[]` when nothing resolves.
 * Test: `tests/unit/news-tool-resolver-109.test.ts`.
 */
export function resolveArticleTools<T extends CatalogueTool>(
  article: { title?: unknown; toolMentions?: unknown },
  catalogue: ToolCatalogue<T>
): T[] {
  const resolved: T[] = [];
  const add = (tool: T | undefined) => {
    if (tool && !resolved.includes(tool)) resolved.push(tool);
  };

  const mentions = Array.isArray(article.toolMentions) ? article.toolMentions : [];
  for (const mention of mentions) {
    const { id, name } = readMention(mention);
    const byId = id ? catalogue.byId.get(id) : undefined;
    add(byId ?? (name ? catalogue.byKey.get(normalizeKey(name)) : undefined));
  }

  if (resolved.length === 0 && typeof article.title === "string") {
    for (const tool of matchTitle(article.title, catalogue)) add(tool);
  }

  return resolved;
}
