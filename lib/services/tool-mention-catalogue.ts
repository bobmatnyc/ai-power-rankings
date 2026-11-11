/**
 * Maps the tool names an article analysis returns onto the tools catalogue (#187).
 *
 * Why: `ToolMapper` held a hand-kept alias list and a fuzzy matcher. It sent
 * "Claude" to "Claude Code" and "Google Gemini" to "Google Jules", and it knew
 * nothing of rows added to or retired from the catalogue.
 * What: each mention is looked up by exact, case-insensitive name or slug in the
 * catalogue the news routes use (`buildToolCatalogue`: active rows, retired
 * slugs resolved to their family row, former names). A hit takes the row's
 * name. A miss keeps the name the model gave and is counted as unmapped. No
 * fuzzy or default mapping exists. A failed or empty catalogue read leaves every
 * mention unmapped and logs one warning; it never turns into a match.
 * Test: `tests/unit/tool-mention-catalogue-187.test.ts`.
 */
import { readNewsToolCatalogue, type NewsToolCatalogue } from "@/lib/news-tool-catalogue";
import { loggers } from "@/lib/logger";

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
}

export type CatalogueLoader = () => Promise<NewsToolCatalogue>;

function key(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Maps `mentions` onto the catalogue and reports the outcome.
 *
 * Why: see the file header; the report feeds the run summary's unmapped count.
 * What: mapped mentions get `tool` = the catalogue row's name; every other
 * field is untouched. Never throws: a read failure is returned in the report
 * and logged at warn level, with the mentions left as the model named them.
 * Test: `tests/unit/tool-mention-catalogue-187.test.ts`.
 */
export async function mapToolMentionsToCatalogue<M extends { tool?: string }>(
  mentions: readonly M[],
  loadCatalogue: CatalogueLoader = readNewsToolCatalogue
): Promise<{ mentions: M[]; report: ToolMappingReport }> {
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
  let mapped = 0;
  const out = mentions.map((mention) => {
    const name = typeof mention.tool === "string" ? mention.tool : "";
    const row = catalogue && name ? catalogue.byKey.get(key(name)) : undefined;
    if (!row) {
      unmappedNames.push(name);
      return mention;
    }
    mapped++;
    return { ...mention, tool: row.name };
  });

  return {
    mentions: out,
    report: {
      mapped,
      unmapped: unmappedNames.length,
      unmappedNames,
      catalogueError,
      articleUnmapped: mapped === 0,
    },
  };
}
