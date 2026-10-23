import { cachedJsonResponse, uncachedJsonResponse } from "@/lib/api-cache";
import { CHANGELOG_ENTRIES } from "@/lib/data/changelog-entries";
import { loggers } from "@/lib/logger";

/** How many versions (counting "Unreleased" as one) the endpoint returns. */
const RECENT_VERSIONS = 3;

/**
 * Platform changelog for the changelog modal: the most recent versions'
 * entries, newest version first.
 *
 * Why: The route read CHANGELOG.md from disk. The deploy did not ship that
 * file, so production answered `200 []` and logged at info level (#231).
 * What: Serves entries from the build-time module
 * `data/changelog-entries.generated.json`, so no file read happens at
 * runtime. The body carries `_sources` and `_degraded`. With no entries it
 * answers 503 `no-store` and `_degraded: true`, never a `200 []`.
 * Test: `tests/unit/changelog-route-231.test.ts`.
 */
export async function GET() {
  // #231: entries come from the generated module, not a runtime fs read.
  const entries = CHANGELOG_ENTRIES;

  if (entries.length === 0) {
    // #231: an empty module is a build defect; make it visible, never `200 []`.
    loggers.api.error("Changelog API: generated changelog module has no entries");
    return uncachedJsonResponse(
      {
        error: "Changelog temporarily unavailable",
        items: [],
        _sources: { changelog: { status: "unavailable", count: 0 } },
        _degraded: true,
        _timestamp: new Date().toISOString(),
      },
      503
    );
  }

  const versions = [...new Set(entries.map((entry) => entry.version))].slice(0, RECENT_VERSIONS);
  const items = entries
    .filter((entry) => versions.includes(entry.version))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      date: entry.date,
      category: "Platform",
      type: entry.changeType,
      version: entry.version,
    }));

  return cachedJsonResponse(
    {
      items,
      _sources: { changelog: { status: "ok", count: items.length } },
      _degraded: false,
      _timestamp: new Date().toISOString(),
    },
    "/api/changelog",
    200,
    { maxAge: 60, sMaxAge: 60 }
  );
}
