"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
import { HomeContent } from "./home-content";
import { NewsUpdateCard } from "@/components/news/news-update-card";
import { selectMovers } from "@/lib/rankings/select-movers";
import { HomeMovers, type MoversText } from "./home-movers";

interface RankingData {
  rank: number;
  previousRank?: number;
  rankChange?: number;
  changeReason?: string;
  tool: {
    id: string;
    slug?: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
    logo?: string;  // Local PNG path (preferred over favicon API)
    description?: string;
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
  };
}

interface RecentTool {
  id: string;
  slug?: string;
  name: string;
  category: string;
  description?: string;
}

interface ToolForStats {
  category: string;
  baseline_score?: number;
  score?: number;
  scores?: {
    overall?: number;
  };
}

interface ClientRankingsProps {
  loadingText: string;
  lang: string;
  initialRankings?: RankingData[];
  moversText: MoversText; // See #192
  moversSnapshotDate?: string; // See #192: ISO date of the ranking snapshot
}

/**
 * Memoized component for individual ranking cards to prevent unnecessary re-renders.
 *
 * WHY: Each ranking card re-renders when parent state changes, even if the card's
 * data hasn't changed. This causes 30+ component re-renders on each state update.
 *
 * DESIGN DECISION: Using React.memo with areEqual comparison to only re-render
 * when the specific tool data changes, reducing render cycles by ~80%.
 */
const RankingCard = memo(
  ({
    tool,
    lang,
    showScore = true,
  }: {
    tool: RankingData;
    lang: string;
    showScore?: boolean;
  }) => {
    return (
      <Link
        key={tool.tool.id}
        href={`/${lang}/tools/${tool.tool.slug || tool.tool.id}`}
        className="relative h-full block"
      >
        <div className="absolute -top-2 -right-2 z-10">
          <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
            #{tool.rank /* See #192: rank deltas moved to the movers strip */}
          </span>
        </div>
        <div className="h-full">
          <div className="bg-card border rounded-lg p-4 h-full hover:shadow-lg transition-shadow cursor-pointer">
            <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
            <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
            {showScore && tool.scores.overall > 0 && (
              <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
            )}
            {tool.tool.description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{tool.tool.description}</p>
            )}
          </div>
        </div>
      </Link>
    );
  },
  // Custom comparison function to prevent unnecessary re-renders
  (prevProps, nextProps) => {
    return (
      prevProps.tool.tool.id === nextProps.tool.tool.id &&
      prevProps.tool.rank === nextProps.tool.rank &&
      prevProps.tool.rankChange === nextProps.tool.rankChange &&
      prevProps.tool.scores.overall === nextProps.tool.scores.overall &&
      prevProps.showScore === nextProps.showScore
    );
  }
);

RankingCard.displayName = "RankingCard";

/**
 * Optimized stats component to prevent layout shifts and reduce re-renders.
 *
 * WHY: Stats update frequently causing layout shifts and repaints. Each stat
 * update triggers a repaint of the entire stats section.
 *
 * DESIGN DECISION: Isolate stats in a memoized component with fixed dimensions
 * to prevent layout shifts and minimize repaints to only changed values.
 */
const StatsSection = memo(
  ({
    loading,
    totalTools,
    categoriesCount,
    avgScore,
    lastUpdateDate,
  }: {
    loading: boolean;
    totalTools: number;
    categoriesCount: number;
    avgScore: number;
    lastUpdateDate: string;
  }) => {
    return (
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 stats-grid"
        style={{ minHeight: "120px" }}
      >
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-primary mb-1">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-9 w-12 mx-auto rounded" />
            ) : totalTools > 0 ? (
              totalTools
            ) : (
              "42"
            )}
          </div>
          <div className="text-sm text-muted-foreground">Total Tools</div>
        </div>
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-secondary mb-1">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-9 w-8 mx-auto rounded" />
            ) : categoriesCount > 0 ? (
              categoriesCount
            ) : (
              "8"
            )}
          </div>
          <div className="text-sm text-muted-foreground">Categories</div>
        </div>
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-accent mb-1">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-9 w-16 mx-auto rounded" />
            ) : avgScore > 0 ? (
              avgScore.toFixed(1)
            ) : (
              "72.5"
            )}
          </div>
          <div className="text-sm text-muted-foreground">Avg Score</div>
        </div>
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-foreground mb-1">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-9 w-20 mx-auto rounded" />
            ) : lastUpdateDate && !lastUpdateDate.includes("2025") ? (
              lastUpdateDate
            ) : (
              "This Week"
            )}
          </div>
          <div className="text-sm text-muted-foreground">Last Update</div>
        </div>
      </div>
    );
  }
);

StatsSection.displayName = "StatsSection";

function ClientRankings({
  loadingText,
  lang,
  initialRankings = [],
  moversText,
  moversSnapshotDate,
}: ClientRankingsProps) {
  // See #192: the page reads the snapshot on the server; there is no client rankings fetch,
  // so no rows (a failed read) render the empty state, never fallback rows.
  const topRankings = useMemo(() => initialRankings.slice(0, 3), [initialRankings]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<RankingData[]>([]);
  const [recentUpdatesLoading, setRecentUpdatesLoading] = useState(true);
  const [totalTools, setTotalTools] = useState(0);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);

  // Use transition API to mark updates as non-urgent
  const [, startTransition] = useTransition();

  /**
   * Fetch recently updated tools from the API.
   *
   * WHY: The "Recently Updated" section was incorrectly using rankings.slice(6, 10),
   * which failed when rankings had fewer items. This fetches actual recently updated
   * tools based on their updatedAt timestamp.
   */
  const fetchRecentUpdates = useCallback(async (): Promise<void> => {
    try {
      setRecentUpdatesLoading(true);
      const response = await fetch('/api/tools/recent-updates');

      if (response.ok) {
        const data = await response.json();
        const recentTools = data.tools || [];

        // Transform API response to RankingData format
        const transformedTools: RankingData[] = recentTools.map((tool: RecentTool, index: number) => ({
          rank: index + 1, // Not a real rank, just for display purposes
          tool: {
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
            category: tool.category,
            status: 'active',
            description: tool.description,
          },
          scores: {
            overall: 0, // Not applicable for recently updated
            agentic_capability: 0,
            innovation: 0,
          },
          metrics: {},
        }));

        startTransition(() => {
          setRecentlyUpdated(transformedTools);
        });
      } else {
        console.warn('Failed to fetch recent updates:', response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch recent updates:', error);
    } finally {
      setRecentUpdatesLoading(false);
    }
  }, []);

  /**
   * Fetch tools statistics from the API for accurate counts and averages
   */
  const fetchToolsStatistics = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/tools");
      if (response.ok) {
        const data = await response.json();
        const tools = data.tools || [];

        // Calculate total tools
        const totalCount = tools.length;

        // Calculate unique categories
        const uniqueCategories = new Set(tools.map((t: ToolForStats) => t.category).filter(Boolean));
        const categoriesNum = uniqueCategories.size;

        // Calculate average baseline score
        // First try baseline_score, then score field, then look for scores.overall
        const scoresArray = tools
          .map((t: ToolForStats) => t.baseline_score || t.score || t.scores?.overall)
          .filter((s: unknown): s is number => typeof s === 'number' && s > 0);

        let avgScoreValue = 0;
        if (scoresArray.length > 0) {
          avgScoreValue = scoresArray.reduce((acc: number, score: number) => acc + score, 0) / scoresArray.length;
        }

        startTransition(() => {
          if (totalCount > 0) setTotalTools(totalCount);
          if (categoriesNum > 0) setCategoriesCount(categoriesNum);
          if (avgScoreValue > 0) setAvgScore(avgScoreValue);
        });
      }
    } catch (error) {
      console.warn("Could not fetch tools statistics:", error);
    }
  }, []);

  // Defer recent updates fetch for better initial performance
  // Wait 2 seconds after mount to fetch non-critical data
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecentUpdates();
    }, 2000);

    return () => clearTimeout(timer);
  }, [fetchRecentUpdates]);

  useEffect(() => {
    // See #192: stats from the server rows; no client rankings fetch.
    if (initialRankings.length > 0) {
      const total = initialRankings.length;
      const uniqueCats = new Set(initialRankings.map((r) => r.tool.category).filter(Boolean));
      const avgScoreVal = initialRankings.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / initialRankings.length;

      setTotalTools(total);
      setCategoriesCount(uniqueCats.size);
      setAvgScore(avgScoreVal);
    }

    // Defer tools statistics fetch for better initial performance
    const timer = setTimeout(() => {
      fetchToolsStatistics();
    }, 1500);
    return () => clearTimeout(timer);
  }, [fetchToolsStatistics, initialRankings]);

  // See #192: the biggest risers and fallers across all ranks; no top-3 fallback.
  const movers = useMemo(() => selectMovers(initialRankings), [initialRankings]);

  return (
    <>
      <HomeContent
        topRankings={topRankings}
        loading={false}
        loadingText={loadingText}
        lang={lang as Locale}
      />

      {/* News Update Card - Shows latest AI news headlines */}
      <div className="px-3 md:px-6 max-w-7xl mx-auto">
        <NewsUpdateCard lang={lang} limit={5} />
      </div>

      {/* Optimized Stats Section */}
      <StatsSection
        loading={false}
        totalTools={totalTools}
        categoriesCount={categoriesCount}
        avgScore={avgScore}
        lastUpdateDate=""
      />

      {/* See #192: movers strip, rendered from the rows the server passed */}
      <HomeMovers
        up={movers.up}
        down={movers.down}
        lang={lang}
        text={moversText}
        snapshotDate={moversSnapshotDate}
      />

      {/* Recently Updated Section */}
      <section className="px-3 md:px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                <span>⭐</span>
                <span className="ml-2">Recently Updated</span>
              </h2>
              <p className="text-muted-foreground">Latest changes to our ranking data</p>
            </div>
          </div>

          {recentUpdatesLoading ? (
            <div className="grid md:grid-cols-2 gap-3 md:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border rounded-lg p-4 h-32">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-ds-surface-skeleton rounded w-3/4"></div>
                    <div className="h-3 bg-ds-surface-skeleton rounded w-1/2"></div>
                    <div className="h-3 bg-ds-surface-skeleton rounded w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentlyUpdated.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-3 md:gap-6">
              {recentlyUpdated.map((tool) => (
                <RankingCard
                  key={tool.tool.id}
                  tool={tool}
                  lang={lang as Locale}
                  showScore={false}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No recently updated tools found.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default ClientRankings;
