/**
 * The cached ranking read behind the tool page's profile block (#193, #185).
 *
 * Why: every tool page in every locale needs the same two ranking periods and
 * the active catalogue. Reading them per page view would be one JSONB read per
 * request; the page is ISR (`revalidate = 1800`), and this read is cached for
 * the same 30 minutes and shared by every tool page of one list. #185: after v8
 * activation a tool's rank, change and alternatives come from its own list's
 * board (D2e); the combined board is never read.
 * What: `getToolProfileRankingData(list)` returns that list's `is_current`
 * period, the list's latest period before it, and the active catalogue, through
 * one `unstable_cache` entry per list (tags `rankings` and `tools`, so the
 * existing invalidation also clears it). A tool in no list (`list` null) gets an
 * empty current period without a read, so its page shows "unranked". A failed
 * read resolves `null` and is not cached; the block then shows its
 * "unavailable" text and the page still renders. Read-only.
 * Test: `tests/unit/tool-profile-193.test.tsx` ("cached ranking read", "#185").
 */
import { unstable_cache } from "next/cache";
import { rankingsRepository, type RankingData } from "@/lib/db/repositories/rankings.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { RANKING_LISTS, type RankingList } from "@/lib/rankings/lists";
import { rankingEntries } from "./ranking-entry";
import { toProfileEntry, type ProfileRankingData, type ProfileSnapshot } from "./tool-profile";

/** Matches `revalidate` in `app/[lang]/tools/[slug]/page.tsx`. */
export const TOOL_PROFILE_REVALIDATE_SECONDS = 1800;

const toSnapshot = (row: RankingData): ProfileSnapshot => ({
  period: row.period,
  algorithmVersion: row.algorithm_version,
  entries: rankingEntries(row.data).map(toProfileEntry),
});

async function readRankingData(list: RankingList): Promise<ProfileRankingData> {
  const [currentRow, active] = await Promise.all([
    rankingsRepository.getCurrentRankings(list),
    new ToolsRepository().findByStatus("active"),
  ]);
  const previousRow = currentRow ? await rankingsRepository.getLatestBefore(currentRow.period, list) : null;
  return {
    current: currentRow ? toSnapshot(currentRow) : null,
    previous: previousRow ? toSnapshot(previousRow) : null,
    activeTools: active.map((tool) => ({ slug: tool.slug, name: tool.name, category: tool.category })),
  };
}

// #193: one shared cache entry per list, refreshed with the page's ISR window.
const readRankingDataCached = Object.fromEntries(
  RANKING_LISTS.map((list) => [
    list,
    unstable_cache(() => readRankingData(list), ["tool-profile-ranking-data", "v2", list], {
      revalidate: TOOL_PROFILE_REVALIDATE_SECONDS,
      // CACHE_TAGS.RANKINGS and .TOOLS in lib/cache/invalidation.service.ts, spelled
      // out because importing that module starts the memory cache's cleanup timer.
      tags: ["rankings", "tools"],
    }),
  ])
) as Record<RankingList, () => Promise<ProfileRankingData>>;

/** #185: a tool in no list has no board; the profile block shows it as unranked. */
const NO_LIST: ProfileRankingData = { current: null, previous: null, activeTools: [] };

/** The cached ranking data of `list`, or `null` when it could not be read. Never rejects. */
export async function getToolProfileRankingData(list: RankingList | null): Promise<ProfileRankingData | null> {
  if (!list) return NO_LIST;
  try {
    return await readRankingDataCached[list]();
  } catch (error) {
    console.error("Tool profile: ranking data unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}
