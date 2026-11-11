/**
 * Maps the tool names an article analysis returns onto the tools catalogue (#187).
 *
 * Why: `ToolMapper` held a hand-kept alias list and a fuzzy matcher, and knew
 * nothing of rows added to or retired from the catalogue.
 * What: each mention is looked up in the catalogue the news routes use
 * (`buildToolCatalogue`: active rows, retired slugs resolved to their family
 * row, former names).
 * 1. #187: a name in `TOOL_ALIASES` (every alias of the old mapper, same targets)
 *    maps to the catalogue row whose name or slug is the alias target. A target
 *    with no active row leaves the mention unmapped, is listed in the report's
 *    `unresolvedAliases` and is warn-logged; the lookup never falls through to
 *    another row.
 * 2. Otherwise the name maps by exact, case-insensitive name or slug.
 * A hit takes the row's name. A miss keeps the name the model gave and is counted
 * as unmapped. The old mapper's fuzzy substring and word-overlap matching is not
 * kept (it is not a finite list; it sent "Google Gemini" to "Google Jules"). A
 * failed or empty catalogue read leaves every mention unmapped and logs one
 * warning; it never turns into a match.
 * Test: `tests/unit/tool-mention-catalogue-187.test.ts`,
 * `tests/unit/tool-mention-aliases-187.test.ts`.
 */
import { readNewsToolCatalogue, type NewsToolCatalogue } from "@/lib/news-tool-catalogue";
import { loggers } from "@/lib/logger";
import { TOOL_ALIASES } from "./tool-mention-aliases"; // #187

/** What one article's mapping did. Counts and names only. */
export interface ToolMappingReport {
  mapped: number;
  unmapped: number;
  /** The mention names that found no catalogue row (or all of them when the read failed). */
  unmappedNames: string[];
  /** Set when the catalogue read failed or returned no rows; null otherwise. */
  catalogueError: string | null;
  /** True when no mention reached a catalogue row: the article is recorded as unmapped. */
  articleUnmapped: boolean;
  /** #187: mentions that hit an alias whose target tool is not an active catalogue row (also in `unmappedNames`). */
  unresolvedAliases: Array<{ alias: string; target: string }>;
}

export type CatalogueLoader = () => Promise<NewsToolCatalogue>;

function key(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Maps `mentions` onto the catalogue and reports the outcome.
 *
 * Why: see the file header; the report feeds the run summary's unmapped count.
 * What: mapped mentions get `tool` = the catalogue row's name. #187: every
 * mention with a name also gets `raw_tool`, the model-emitted name trimmed
 * (an existing `raw_tool` is kept); every other field is untouched. Never throws: a read failure is returned in the report
 * and logged at warn level, with the mentions left as the model named them.
 * Test: `tests/unit/tool-mention-catalogue-187.test.ts`,
 * `tests/unit/tool-mention-raw-name-187.test.ts`.
 */
export async function mapToolMentionsToCatalogue<M extends { tool?: string; raw_tool?: string }>(
  mentions: readonly M[],
  loadCatalogue: CatalogueLoader = readNewsToolCatalogue
): Promise<{ mentions: Array<M & { raw_tool?: string }>; report: ToolMappingReport }> {
  let catalogue: NewsToolCatalogue | null = null;
  let catalogueError: string | null = null;
  try {
    catalogue = await loadCatalogue();
    if (catalogue.byKey.size === 0) {
      catalogueError = "tool catalogue returned no active rows";
      catalogue = null;
    }
  } catch (error) {
    catalogueError = error instanceof Error ? error.message : String(error);
  }
  if (catalogueError) {
    loggers.api.warn("[ToolMapping] Tool catalogue unavailable; article tool mentions left unmapped", {
      error: catalogueError,
      mentionCount: mentions.length,
    });
  }

  const unmappedNames: string[] = [];
  const unresolvedAliases: Array<{ alias: string; target: string }> = [];
  let mapped = 0;
  const out = mentions.map((mention): M & { raw_tool?: string } => {
    const name = typeof mention.tool === "string" ? mention.tool : "";
    // #187: keep the model-emitted name (#432 counts aliases); a re-mapped mention keeps its first raw name.
    const raw = typeof mention.raw_tool === "string" && mention.raw_tool.trim() ? mention.raw_tool.trim() : name.trim();
    const withRaw = raw ? { ...mention, raw_tool: raw } : mention;
    // #187: an alias wins, as in the old mapper, and its target must be an active row.
    const target = name && Object.hasOwn(TOOL_ALIASES, key(name)) ? TOOL_ALIASES[key(name)] : undefined;
    const row = !catalogue || !name ? undefined : catalogue.byKey.get(key(target ?? name));
    if (!row) {
      unmappedNames.push(name);
      if (catalogue && target) unresolvedAliases.push({ alias: key(name), target });
      return withRaw;
    }
    mapped++;
    return { ...withRaw, tool: row.name };
  });
  if (unresolvedAliases.length > 0) {
    loggers.api.warn("[ToolMapping] Alias target is not an active catalogue tool; mentions left unmapped", {
      unresolvedAliases,
    });
  }

  return {
    mentions: out,
    report: {
      mapped,
      unmapped: unmappedNames.length,
      unmappedNames,
      catalogueError,
      articleUnmapped: mapped === 0,
      unresolvedAliases,
    },
  };
}
