/**
 * The cached ranking read behind the tool page's profile block (#193).
 *
 * Why: every tool page in every locale needs the same two ranking periods and
 * the active catalogue. Reading them per page view would be one JSONB read per
 * request; the page is ISR (`revalidate = 1800`), and this read is cached for
 * the same 30 minutes and shared by every tool page.
 * What: `getToolProfileRankingData()` returns the `is_current` period, the
 * latest period before it, and the active catalogue, through `unstable_cache`
 * (tags `rankings` and `tools`, so the existing invalidation also clears it).
 * A failed read resolves `null` and is not cached; the block then shows its
 * "unavailable" text and the page still renders. Read-only.
 * Test: `tests/unit/tool-profile-193.test.tsx` ("cached ranking read").
 */
import { unstable_cache } from "next/cache";
import { rankingsRepository, type RankingData } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { rankingEntries } from "./ranking-entry";
import { toProfileEntry, type ProfileRankingData, type ProfileSnapshot } from "./tool-profile";

/** Matches `revalidate` in `app/[lang]/tools/[slug]/page.tsx`. */
export const TOOL_PROFILE_REVALIDATE_SECONDS = 1800;

const toSnapshot = (row: RankingData): ProfileSnapshot => ({
  period: row.period,
  algorithmVersion: row.algorithm_version,
  entries: rankingEntries(row.data).map(toProfileEntry),
});

async function readRankingData(): Promise<ProfileRankingData> {
  const [currentRow, active] = await Promise.all([
    rankingsRepository.getCurrentRankings(),
    new ToolsRepository().findByStatus("active"),
  ]);
  const previousRow = currentRow ? await rankingsRepository.getLatestBefore(currentRow.period) : null;
  return {
    current: currentRow ? toSnapshot(currentRow) : null,
    previous: previousRow ? toSnapshot(previousRow) : null,
    activeTools: active.map((tool) => ({ slug: tool.slug, name: tool.name, category: tool.category })),
  };
}

// #193: one shared cache entry for every tool page, refreshed with the page's ISR window.
const readRankingDataCached = unstable_cache(readRankingData, ["tool-profile-ranking-data", "v1"], {
  revalidate: TOOL_PROFILE_REVALIDATE_SECONDS,
  // CACHE_TAGS.RANKINGS and .TOOLS in lib/cache/invalidation.service.ts, spelled
  // out because importing that module starts the memory cache's cleanup timer.
  tags: ["rankings", "tools"],
});

/** The cached ranking data, or `null` when it could not be read. Never rejects. */
export async function getToolProfileRankingData(): Promise<ProfileRankingData | null> {
  try {
    return await readRankingDataCached();
  } catch (error) {
    console.error("Tool profile: ranking data unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
