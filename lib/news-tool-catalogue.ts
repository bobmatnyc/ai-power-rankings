/**
 * Loads the tool catalogue the news routes attribute articles against (#109).
 *
 * Why: both news routes need the whole catalogue once per request; reading the
 * tools table for every request repeats the same query the CDN window already
 * covers.
 * What: `ToolsRepository.findNewsCatalogueRows()`, indexed by `buildToolCatalogue`, kept in
 * module memory for `CATALOGUE_TTL_MS`. A failed read throws and is never
 * cached; the caller decides what a failure means.
 * Test: `tests/unit/news-route-tools-109.test.ts`.
 */
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import { buildToolCatalogue, type ToolCatalogue } from "@/lib/news-tool-resolver";

// #187: rows carry the `kind` and `status` columns, not the JSONB copies.
type CatalogueRow = Awaited<ReturnType<ToolsRepository["findNewsCatalogueRows"]>>[number];
export type NewsToolCatalogue = ToolCatalogue<CatalogueRow>;

/** Matches the news routes' `s-maxage=300` CDN window. */
const CATALOGUE_TTL_MS = 5 * 60 * 1000;

let cached: { loadedAt: number; catalogue: NewsToolCatalogue } | null = null;

/**
 * The catalogue read straight from the tools table, with no memory cache.
 *
 * Why: the tool page's related news (#193) keeps its own tagged cache and must
 * attribute articles exactly as `/api/news` does, so both build it here.
 * What: every catalogue row, indexed by `buildToolCatalogue`, which keeps active
 * rows and redirects only (#187). Throws when the read fails, so a failure is
 * never an empty catalogue.
 */
export async function readNewsToolCatalogue(): Promise<NewsToolCatalogue> {
  return buildToolCatalogue(await new ToolsRepository().findNewsCatalogueRows());
}

/** The catalogue, from memory when younger than the TTL. Throws when the read fails. */
export async function getNewsToolCatalogue(now: number = Date.now()): Promise<NewsToolCatalogue> {
  if (cached && now - cached.loadedAt < CATALOGUE_TTL_MS) return cached.catalogue;
  // #193: the same uncached read the tool page's related news uses.
  const catalogue = await readNewsToolCatalogue();
  cached = { loadedAt: now, catalogue };
  return catalogue;
}

/**
 * The catalogue, or `null` when the read fails.
 *
 * Why: attribution decorates a news response; a failed tools read must not
 * turn the page into an error (#109 ruling).
 * What: on failure logs one warning naming `route` and returns `null`, so the
 * route serves its normal response with no attribution.
 * Test: `tests/unit/news-route-tools-109.test.ts`.
 */
export async function loadNewsToolCatalogueOrNull(route: string): Promise<NewsToolCatalogue | null> {
  try {
    return await getNewsToolCatalogue();
  } catch (error) {
    loggers.api.warn("News tool attribution skipped: tool catalogue read failed", {
      route,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
