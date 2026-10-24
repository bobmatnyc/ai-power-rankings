/**
 * Loads the tool catalogue the news routes attribute articles against (#109).
 *
 * Why: both news routes need the whole catalogue once per request; reading the
 * tools table for every request repeats the same query the CDN window already
 * covers.
 * What: `ToolsRepository.findAll()`, indexed by `buildToolCatalogue`, kept in
 * module memory for `CATALOGUE_TTL_MS`. A failed read throws and is never
 * cached; the caller decides what a failure means.
 * Test: `tests/unit/news-route-tools-109.test.ts`.
 */
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import { buildToolCatalogue, type ToolCatalogue } from "@/lib/news-tool-resolver";

type CatalogueRow = Awaited<ReturnType<ToolsRepository["findAll"]>>[number];
export type NewsToolCatalogue = ToolCatalogue<CatalogueRow>;

/** Matches the news routes' `s-maxage=300` CDN window. */
const CATALOGUE_TTL_MS = 5 * 60 * 1000;

let cached: { loadedAt: number; catalogue: NewsToolCatalogue } | null = null;

/** The catalogue, from memory when younger than the TTL. Throws when the read fails. */
export async function getNewsToolCatalogue(now: number = Date.now()): Promise<NewsToolCatalogue> {
  if (cached && now - cached.loadedAt < CATALOGUE_TTL_MS) return cached.catalogue;
  const catalogue = buildToolCatalogue(await new ToolsRepository().findAll());
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
