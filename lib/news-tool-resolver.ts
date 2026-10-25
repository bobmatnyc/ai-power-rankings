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
 * #187: only active rows are returned; a redirect row's names resolve to the
 * active row it redirects to; each returned row carries its `kind`, and
 * `articleToolTags` gives an article one tag per kind (a model and a harness).
 * Test: `tests/unit/news-tool-resolver-109.test.ts`,
 * `tests/unit/news-kind-matcher-187.test.ts`.
 */

/** The catalogue fields the resolver reads. A row may carry more. */
export interface CatalogueTool {
  /** Tool id (the JSONB `id`, or the row UUID when the JSONB has none). */
  id: string;
  /** Row UUID, when it differs from `id`. */
  db_id?: string;
  slug: string;
  name: string;
  /** #187: `tools.kind` (model, harness, productivity, other). */
  kind: string;
  /** #187: `tools.status`; only "active" rows are tag targets. */
  status: string;
  /** #187: on a status "redirect" row, the slug it redirects to (`data.redirect_to`). */
  redirect_to?: unknown;
}

/** #187: longest redirect chain followed before a row is dropped (guards a cycle). */
const MAX_REDIRECT_HOPS = 5;

/**
 * The active row a catalogue row stands for, or undefined.
 *
 * What: an active row stands for itself. A "redirect" row follows `redirect_to`
 * by slug, at most `MAX_REDIRECT_HOPS` times, and stands for the first active row
 * it reaches. Every other status (inactive, pending_review, deprecated, a
 * redirect to a missing or non-active row) stands for nothing.
 */
function activeTarget<T extends CatalogueTool>(tool: T, bySlug: Map<string, T>): T | undefined {
  let current: T | undefined = tool;
  for (let hop = 0; current && hop <= MAX_REDIRECT_HOPS; hop++) {
    if (current.status === "active") return current;
    if (current.status !== "redirect" || typeof current.redirect_to !== "string") return undefined;
    current = bySlug.get(current.redirect_to);
  }
  return undefined;
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
 * #187: every key maps to an ACTIVE row. A redirect row's keys map to the
 * active row it redirects to (D91: opus-4-6 -> claude-opus); any other
 * non-active row is not indexed. Active rows are indexed before redirect rows,
 * so an active row keeps a key a redirect row also carries.
 */
export function buildToolCatalogue<T extends CatalogueTool>(tools: readonly T[]): ToolCatalogue<T> {
  const byId = new Map<string, T>();
  const byKey = new Map<string, T>();
  const terms = new Map<string, T>();

  const named = tools.filter((t) => typeof t?.slug === "string" && typeof t?.name === "string");
  const bySlug = new Map<string, T>();
  for (const tool of named) if (!bySlug.has(tool.slug)) bySlug.set(tool.slug, tool);
  // #187: active rows first, then the redirect rows that reach one; nothing else.
  const entries = [
    ...named.filter((t) => t.status === "active").map((t) => ({ tool: t, target: t })),
    ...named
      .filter((t) => t.status === "redirect")
      .map((t) => ({ tool: t, target: activeTarget(t, bySlug) }))
      .filter((e): e is { tool: T; target: T } => e.target !== undefined),
  ];

  for (const { tool, target } of entries) {
    for (const id of [tool.id, tool.db_id]) {
      if (typeof id === "string" && id && !byId.has(id)) byId.set(id, target);
    }
    for (const raw of [tool.name, tool.slug]) {
      const key = normalizeKey(raw);
      if (!key) continue;
      if (!byKey.has(key)) byKey.set(key, target);
    }
    // #109: title terms are catalogue names only, as stored (case-sensitive).
    // A single all-letter name ("Continue", "Warp", "AI") is an ordinary word
    // in headlines, so it is attributed through mentions only.
    const name = tool.name.trim();
    if (name && !isSingleWordName(name) && !terms.has(name)) terms.set(name, target);
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
 * Every catalogue tool an article names, in mention order. The primary tool
 * is `primaryArticleTool`, not this list's first item (see #109).
 *
 * What, in order:
 * 1. Each mention's `toolId` (or a string mention) that is a catalogue id.
 * 2. Otherwise the mention's name, equal to a catalogue name or slug
 *    (case-insensitive, trimmed).
 * 3. Catalogue names (never slugs) found in the title as whole words,
 *    case-sensitive, of a kind no mention resolved to (#187; before #187, only
 *    when no mention resolved at all). A single all-letter name never matches.
 *
 * A mention that resolves to nothing is dropped. Duplicates are removed.
 * Returns `[]` when nothing resolves.
 * Test: `tests/unit/news-tool-resolver-109.test.ts`,
 * `tests/unit/news-kind-matcher-187.test.ts`.
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
  for (const mention of mentions) add(resolveMention(readMention(mention), catalogue));

  // #187: the title fills each kind the mentions left empty, so an article
  // whose mentions name only its harness still gets the model in its title.
  const mentionedKinds = new Set(resolved.map((t) => t.kind));
  if (typeof article.title === "string") {
    for (const tool of matchTitle(article.title, catalogue)) {
      if (!mentionedKinds.has(tool.kind)) add(tool);
    }
  }

  return resolved;
}

/**
 * The article's tags: at most one catalogue tool per kind, primary first (#187).
 *
 * Why: an article about a harness running a model ("Claude Code now runs
 * Claude Opus 4.6") is about both; one primary tool dropped the model.
 * What:
 * 1. No primary tool (`primaryArticleTool` is null) means no tags, so the #109
 *    rule holds: an article whose top mention is not in the catalogue is
 *    tagged to nothing.
 * 2. The primary tool tags its own kind.
 * 3. Each other kind is tagged by its highest-relevance resolved mention
 *    (stored order breaks a tie); a kind no mention resolves to is tagged by
 *    its first catalogue name in the title, by the title rule above.
 *
 * Every tag is an active row and carries `kind`. Kind "other" rows are tagged
 * like any other kind; issue #187 does not exclude them.
 * Test: `tests/unit/news-kind-matcher-187.test.ts`.
 */
export function articleToolTags<T extends CatalogueTool>(
  article: { title?: unknown; toolMentions?: unknown },
  catalogue: ToolCatalogue<T>
): T[] {
  const primary = primaryArticleTool(article, catalogue);
  if (!primary) return [];

  const tags: T[] = [primary];
  const add = (tool: T | undefined) => {
    if (tool && !tags.some((t) => t.kind === tool.kind)) tags.push(tool);
  };

  const stored = Array.isArray(article.toolMentions) ? article.toolMentions : [];
  stored
    .map((m, order) => ({ tool: resolveMention(readMention(m), catalogue), relevance: readRelevance(m), order }))
    .sort((a, b) => b.relevance - a.relevance || a.order - b.order)
    .forEach(({ tool }) => add(tool));

  if (typeof article.title === "string") {
    for (const tool of matchTitle(article.title, catalogue)) add(tool);
  }
  return tags;
}

/** A mention's `toolId` as a catalogue id, else its name as a catalogue name or slug. */
function resolveMention<T extends CatalogueTool>(
  { id, name }: { id?: string; name?: string },
  catalogue: ToolCatalogue<T>
): T | undefined {
  const byId = id ? catalogue.byId.get(id) : undefined;
  return byId ?? (name ? catalogue.byKey.get(normalizeKey(name)) : undefined);
}

/** A mention's stored `relevance`; a missing or non-finite value ranks below every number. */
function readRelevance(mention: unknown): number {
  const value = mention && typeof mention === "object" ? (mention as Record<string, unknown>)["relevance"] : undefined;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

/**
 * The one catalogue tool an article is about, or `null` (#109).
 *
 * Why: the first RESOLVED mention in stored order was taken as the primary
 * tool, so when the article's subject is not in the catalogue a passing
 * competitor mention (relevance 0.3) became its tool.
 * What: every consumer of "the article's tool" (`/api/news` `tool_slug`,
 * `/api/news/[slug]` `tool`, the tool page's Related news) calls this, so they
 * cannot disagree.
 * 1. Mentions with neither an id nor a name are ignored.
 * 2. With no mentions left: the first catalogue name in the title, as in
 *    `resolveArticleTools`.
 * 3. Otherwise only the mentions with the highest relevance compete; the first
 *    of them in stored order that resolves wins. When none of them resolves the
 *    result is `null`, even if a weaker mention resolves. A mention without a
 *    numeric relevance ranks below every mention that has one, so rows without
 *    scores keep the stored-order rule.
 *
 * Test: `tests/unit/news-primary-tool-109.test.ts`.
 */
export function primaryArticleTool<T extends CatalogueTool>(
  article: { title?: unknown; toolMentions?: unknown },
  catalogue: ToolCatalogue<T>
): T | null {
  const stored = Array.isArray(article.toolMentions) ? article.toolMentions : [];
  const mentions = stored
    .map((m) => ({ ...readMention(m), relevance: readRelevance(m) }))
    .filter((m) => m.id || m.name);

  if (mentions.length === 0) {
    return typeof article.title === "string" ? (matchTitle(article.title, catalogue)[0] ?? null) : null;
  }

  const top = Math.max(...mentions.map((m) => m.relevance));
  for (const mention of mentions) {
    if (mention.relevance !== top) continue;
    const tool = resolveMention(mention, catalogue);
    if (tool) return tool;
  }
  return null;
}
