"use client";

import { ArrowUpDown, Grid, List, Star, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { trackEvent } from "@/lib/analytics/track";
import { formatUtcDate } from "@/lib/format-utc-date";
import { loggers } from "@/lib/logger-client";
import {
  DEFAULT_RANKING_LIST,
  listTierScheme,
  type RankingList,
  rankingListPath,
} from "@/lib/rankings/lists";
import { AlgorithmInfoCard } from "./algorithm-info-card";
import { RankingCard } from "./ranking-card";
import { RankingsStatsCards } from "./rankings-stats-cards";
import { SearchEmptyState } from "./search-empty-state";
import { TierLegend } from "./tier-legend";
import { useRankingsSearch } from "./use-rankings-search";

interface RankingData {
  rank: number;
  /** #186: the tier within the list (D53). */
  tier?: string;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;  // A link target only; never an image source
    logo?: string;         // Stored local logo path (legacy; see D82)
    description?: string;  // Used by RankingCard
    slug?: string;         // Tool slug for routing
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
    technical_performance: number;
    developer_adoption: number;
    market_traction: number;
    business_sentiment: number;
    development_velocity: number;
    platform_resilience: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
    github_stars?: number;
  };
  modifiers?: {
    innovation_decay?: number;
    platform_risk?: number;
    revenue_quality?: number;
  };
}

interface RankingsGridProps {
  lang: Locale;
  dict: Dictionary;
  initialRankings?: RankingData[];
  /** #186: the list this grid shows; default the coding-harness list (D51). */
  list?: RankingList;
}

/** #186: `/api/rankings` for a list; the default list keeps the unqualified URL (D51). */
function rankingsApiPath(list: RankingList, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (list !== DEFAULT_RANKING_LIST) params.set("list", list);
  const query = params.toString();
  return `/api/rankings${query ? `?${query}` : ""}`;
}

function RankingsGridContent({
  lang,
  dict,
  initialRankings = [],
  list = DEFAULT_RANKING_LIST,
}: RankingsGridProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [rankings, setRankings] = useState<RankingData[]>(initialRankings);
  const [loading, setLoading] = useState(initialRankings.length === 0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("");
  // Honest "Rankings as of <date>" marker sourced from the current snapshot's
  // published_at, so a frozen snapshot is never presented as fresh silently.
  const [publishedDate, setPublishedDate] = useState<string>("");
  const [totalTools, setTotalTools] = useState<number>(0);
  const [categoriesCount, setCategoriesCount] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<number>(0);
  // #186: once the list's rows are read, show its real counts (a list may be empty).
  const [statsLoaded, setStatsLoaded] = useState(initialRankings.length > 0);
  // #186: sort and filter links stay on this list's page.
  const listPath = `/${lang}${rankingListPath(list)}`;

  // Get filters from URL
  const categoryParam = searchParams.get("category") || "all";
  const tagsParam = searchParams.get("tags")?.split(",") || [];
  const sortParam = searchParams.get("sort") || "rank";
  // #233: the search term is client state only; it never enters the URL.
  const [searchTerm, setSearchTerm] = useState("");

  const fetchToolsStatistics = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch("/api/tools");
      if (response.ok) {
        const data = await response.json();
        const tools = data.tools || [];

        // Calculate total tools
        setTotalTools(tools.length);

        // Calculate categories count
        const uniqueCategories = new Set(tools.map((t: any) => t.category).filter(Boolean));
        setCategoriesCount(uniqueCategories.size);

        // Calculate average baseline score if available
        const scoresArray = tools
          .map((t: any) => t.baseline_score || t.score)
          .filter((s: any) => typeof s === 'number' && s > 0);

        if (scoresArray.length > 0) {
          const avgScoreValue = scoresArray.reduce((acc: number, score: number) => acc + score, 0) / scoresArray.length;
          setAvgScore(avgScoreValue);
        }
      }
    } catch (error) {
      console.warn("Could not fetch tools statistics:", error);
    }
  }, []);

  const fetchAlgorithmDate = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(rankingsApiPath(list, { metadata: "true" }));
      if (response.ok) {
        const data = await response.json();
        if (data.algorithm?.date) {
          const date = new Date(data.algorithm.date);
          // #239: UTC, so the stored date names the same day in every browser zone.
          const formattedDate = formatUtcDate(date, lang, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          setLastUpdateDate(formattedDate);
        }
        if (data.published_at) {
          // #239: UTC, so the stored date names the same day in every browser zone.
          setPublishedDate(
            formatUtcDate(data.published_at, lang, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          );
        }
      }
    } catch {
      // Silently fail, will use fallback
    }
  }, [lang, list]);

  const fetchRankings = useCallback(async (): Promise<void> => {
    try {
      const isDev = process.env["NODE_ENV"] === "development";
      const timestamp = Date.now();
      const url = rankingsApiPath(list, isDev ? { _t: String(timestamp) } : {});
      const response = await fetch(url, {
        cache: isDev ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data || !data.rankings) {
        loggers.ranking.warn("Invalid API response", { data });
        setRankings([]);
      } else {
        setRankings(data.rankings);
        setTotalTools(data.rankings.length);
        setStatsLoaded(true);

        // Calculate stats from rankings if available
        if (data.rankings && data.rankings.length > 0) {
          setTotalTools(data.rankings.length);

          const uniqueCategories = new Set(data.rankings.map((r: RankingData) => r.tool.category).filter(Boolean));
          setCategoriesCount(uniqueCategories.size);

          const avgScoreValue = data.rankings.reduce((acc: number, r: RankingData) => acc + (r.scores?.overall || 0), 0) / data.rankings.length;
          setAvgScore(avgScoreValue);
        }

        // Set the "Rankings as of" marker from the snapshot's published_at
        if (data.published_at) {
          // #239: UTC, so the stored date names the same day in every browser zone.
          setPublishedDate(
            formatUtcDate(data.published_at, lang, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          );
        }

        // Set last update date from algorithm date
        if (data.algorithm?.date) {
          const date = new Date(data.algorithm.date);
          // #239: UTC, so the stored date names the same day in every browser zone.
          const formattedDate = formatUtcDate(date, lang, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          setLastUpdateDate(formattedDate);
        } else {
          // Fallback to current date if no algorithm date
          const today = new Date();
          const formattedDate = today.toLocaleDateString(lang, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          setLastUpdateDate(formattedDate);
        }
      }

      setLoading(false);
    } catch (error) {
      loggers.ranking.error("Failed to fetch rankings", { error, list });
      setRankings([]); // Ensure rankings is always an array
      setLoading(false);
    }
  }, [lang, list]);

  useEffect(() => {
    // Only fetch if no initial rankings provided
    if (initialRankings.length === 0) {
      fetchRankings();
      // Also fetch tools statistics as a fallback
      fetchToolsStatistics();
    } else {
      setLoading(false);
      // For SSR, calculate stats from initial rankings
      if (initialRankings.length > 0) {
        setTotalTools(initialRankings.length);

        const uniqueCategories = new Set(initialRankings.map((r) => r.tool.category).filter(Boolean));
        setCategoriesCount(uniqueCategories.size);

        const avgScoreValue = initialRankings.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / initialRankings.length;
        setAvgScore(avgScoreValue);
      }
      // For SSR, we need to fetch the algorithm date separately
      fetchAlgorithmDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialRankings.length, // For SSR, we need to fetch the algorithm date separately
    fetchAlgorithmDate,
    fetchRankings,
    fetchToolsStatistics,
  ]);

  // Apply filters
  const filteredRankings = rankings.filter((r) => {
    if (categoryParam !== "all" && r.tool.category !== categoryParam) {
      return false;
    }
    // Add tag filtering logic here when tags are implemented
    return true;
  });
  // #175: apply the search term and send site_search once the rankings are loaded.
  const searchedRankings = useRankingsSearch(filteredRankings, searchTerm, !loading);

  // Apply sorting
  const sortedRankings = [...searchedRankings].sort((a, b) => {
    switch (sortParam) {
      case "trending":
        // Simulate trending by looking at recent metrics
        return (b.metrics.users || 0) - (a.metrics.users || 0);
      case "score":
        return (b.scores?.overall || 0) - (a.scores?.overall || 0);
      case "name":
        return a.tool.name.localeCompare(b.tool.name);
      default: // rank
        return a.rank - b.rank;
    }
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{dict.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{dict.common.appName}</h1>
        <p className="text-muted-foreground text-lg">{dict.rankings.subtitle}</p>
        {publishedDate && (
          <p className="text-sm text-muted-foreground mt-2">
            {dict.rankings.asOf.replace("{date}", publishedDate)}
          </p>
        )}
      </div>

      {/* Stats Cards - Optimized for T-031 & T-040 CLS fix */}
      <RankingsStatsCards
        dict={dict}
        loading={loading}
        statsLoaded={statsLoaded}
        totalTools={totalTools}
        categoriesCount={categoriesCount}
        avgScore={avgScore}
        lastUpdateDate={lastUpdateDate}
      />

      {/* Tier Legend */}
      <div className="mb-6">
        <TierLegend dict={dict} scheme={listTierScheme(rankings.length)} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Select
            value={sortParam}
            onValueChange={(value) => {
              // #175: the rankings sort select.
              trackEvent("filter_use", { filter_name: "sort", filter_value: value, page_type: "rankings" });
              const params = new URLSearchParams(searchParams.toString());
              if (value === "rank") {
                params.delete("sort");
              } else {
                params.set("sort", value);
              }
              // #175: client-side navigation keeps the page loaded, so gtag sends filter_use from its normal batch.
              router.push(`${listPath}${params.toString() ? `?${params.toString()}` : ""}`);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={dict.rankings.sortBy} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">
                <div className="flex items-center">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  {dict.rankings.sort.rank}
                </div>
              </SelectItem>
              <SelectItem value="trending">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  {dict.rankings.sort.trending}
                </div>
              </SelectItem>
              <SelectItem value="score">
                <div className="flex items-center">
                  <Star className="h-4 w-4 mr-2" />
                  {dict.rankings.sort.score}
                </div>
              </SelectItem>
              <SelectItem value="name">{dict.rankings.sort.name}</SelectItem>
            </SelectContent>
          </Select>
          {/* #233: no <form> and no name, so the term can never be submitted into a URL. */}
          <Input
            type="search"
            aria-label={dict.common.search}
            placeholder={dict.common.search}
            className="w-[220px]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Filters */}
      {(categoryParam !== "all" || tagsParam.length > 0 || searchTerm.trim()) && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">{dict.rankings.activeFilters}:</span>
          {categoryParam !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("category");
                window.location.href = `${listPath}${params.toString() ? `?${params.toString()}` : ""}`;
              }}
            >
              {categoryParam.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} ✕
            </Badge>
          )}
          {searchTerm.trim() && (
            // #233: clearing the term resets client state; it does not navigate.
            <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchTerm("")}>
              &ldquo;{searchTerm.trim()}&rdquo; ✕
            </Badge>
          )}
          {tagsParam.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                const newTags = tagsParam.filter((t) => t !== tag);
                if (newTags.length === 0) {
                  params.delete("tags");
                } else {
                  params.set("tags", newTags.join(","));
                }
                window.location.href = `${listPath}${params.toString() ? `?${params.toString()}` : ""}`;
              }}
            >
              {tag.replace(/-/g, " ")} ✕
            </Badge>
          ))}
        </div>
      )}

      {/* Rankings Display */}
      {/* #207: a typed term that matches no row gets a message and a clear button,
          not a blank grid. Loading returns early above; a category filter alone shows nothing new. */}
      {rankings.length === 0 ? (
        // #186: a list with no ranked tool says so instead of rendering an empty grid.
        <p className="text-muted-foreground">{dict.rankings.lists.empty}</p>
      ) : sortedRankings.length === 0 && searchTerm.trim() ? (
        <SearchEmptyState
          term={searchTerm.trim()}
          message={dict.rankings.noResults}
          clearLabel={dict.rankings.clearSearch}
          onClear={() => setSearchTerm("")}
        />
      ) : viewMode === "grid" ? (
        <div className="grid md:grid-cols-2 gap-3 md:gap-6">
          {sortedRankings.map((ranking) => (
            <RankingCard key={ranking.tool.id} ranking={ranking} />
          ))}
        </div>
      ) : (
        <div className="space-y-2 md:space-y-4">
          {sortedRankings.map((ranking) => (
            <RankingCard key={ranking.tool.id} ranking={ranking} />
          ))}
        </div>
      )}

      {/* Algorithm Info */}
      <AlgorithmInfoCard lang={lang} dict={dict} />
    </div>
  );
}

export default function RankingsGrid({
  lang,
  dict,
  initialRankings,
  list,
}: RankingsGridProps): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{dict.common.loading}</p>
        </div>
      }
    >
      <RankingsGridContent lang={lang} dict={dict} initialRankings={initialRankings} list={list} />
    </Suspense>
  );
}
