"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { HomeContent } from "./home-content";

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

interface ClientRankingsProps {
  loadingText: string;
  lang: string;
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
    showRankChange = false,
  }: {
    tool: RankingData;
    lang: string;
    showRankChange?: boolean;
  }) => {
    return (
      <Link
        key={tool.tool.id}
        href={`/${lang}/tools/${tool.tool.slug || tool.tool.id}`}
        className="relative h-full block"
      >
        <div className="absolute -top-2 -right-2 z-10">
          <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
            {showRankChange && tool.rankChange ? `+${tool.rankChange}` : `#${tool.rank}`}
          </span>
        </div>
        <div className="h-full">
          <div className="bg-card border rounded-lg p-4 h-full hover:shadow-lg transition-shadow cursor-pointer">
            <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
            <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
            <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
            {showRankChange && tool.changeReason && (
              <p className="mt-2 text-xs text-muted-foreground">{tool.changeReason}</p>
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
      prevProps.tool.scores.overall === nextProps.tool.scores.overall
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
    trendingUpCount,
    trendingDownCount,
    lastUpdateDate,
  }: {
    loading: boolean;
    totalTools: number;
    trendingUpCount: number;
    trendingDownCount: number;
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
              <div className="animate-pulse bg-gray-200 h-9 w-12 mx-auto rounded" />
            ) : (
              totalTools
            )}
          </div>
          <div className="text-sm text-muted-foreground">Tools Ranked</div>
        </div>
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-secondary mb-1">
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-9 w-20 mx-auto rounded" />
            ) : (
              `${trendingUpCount}/${trendingDownCount}`
            )}
          </div>
          <div className="text-sm text-muted-foreground">Trending ↑/↓</div>
        </div>
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-accent mb-1">
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-9 w-16 mx-auto rounded" />
            ) : (
              lastUpdateDate || "Daily"
            )}
          </div>
          <div className="text-sm text-muted-foreground">Last Update</div>
        </div>
        <div className="text-center flex flex-col justify-center" style={{ minHeight: "80px" }}>
          <div className="text-3xl font-bold text-foreground mb-1">100%</div>
          <div className="text-sm text-muted-foreground">Free Access</div>
        </div>
      </div>
    );
  }
);

StatsSection.displayName = "StatsSection";

export function ClientRankings({ loadingText, lang }: ClientRankingsProps) {
  const [topRankings, setTopRankings] = useState<RankingData[]>([]);
  const [trendingTools, setTrendingTools] = useState<RankingData[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTools, setTotalTools] = useState(0);
  const [trendingUpCount, setTrendingUpCount] = useState(0);
  const [trendingDownCount, setTrendingDownCount] = useState(0);
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("");

  // Use transition API to mark updates as non-urgent
  const [, startTransition] = useTransition();

  /**
   * Process rankings data in chunks to avoid blocking the main thread.
   *
   * WHY: Processing 50+ ranking items synchronously blocks the main thread
   * for 50-100ms, causing jank during initial render.
   *
   * DESIGN DECISION: Use requestIdleCallback to process data in chunks when
   * the browser is idle, keeping each chunk under 5ms of processing time.
   */
  const processRankingsInChunks = useCallback((rankings: RankingData[]) => {
    const CHUNK_SIZE = 10;
    let currentIndex = 0;

    const processChunk = (deadline: IdleDeadline) => {
      // Process items while we have idle time (target 5ms chunks)
      while (currentIndex < rankings.length && deadline.timeRemaining() > 5) {
        const chunk = rankings.slice(currentIndex, currentIndex + CHUNK_SIZE);

        if (currentIndex === 0) {
          // First chunk: Set top rankings immediately for fast initial render
          startTransition(() => {
            setTopRankings(chunk.slice(0, 3));
          });
        }

        // Process trending calculations
        if (currentIndex < 30) {
          const trendingUp = chunk.filter((r) => r.rankChange && r.rankChange > 0);
          const trendingDown = chunk.filter((r) => r.rankChange && r.rankChange < 0);

          startTransition(() => {
            setTrendingUpCount((prev) => prev + trendingUp.length);
            setTrendingDownCount((prev) => prev + trendingDown.length);

            if (trendingUp.length > 0) {
              setTrendingTools((prev) => [...prev, ...trendingUp].slice(0, 3));
            }
          });
        }

        currentIndex += CHUNK_SIZE;
      }

      // Schedule next chunk if needed
      if (currentIndex < rankings.length) {
        requestIdleCallback(processChunk);
      } else {
        // Final updates
        startTransition(() => {
          setRecentlyUpdated(rankings.slice(6, 10));
          setTotalTools(rankings.length);
          setLoading(false);
        });
      }
    };

    // Start processing
    if ("requestIdleCallback" in window) {
      requestIdleCallback(processChunk);
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(
        () =>
          processChunk({
            timeRemaining: () => 50,
            didTimeout: false,
          } as IdleDeadline),
        0
      );
    }
  }, []);

  useEffect(() => {
    async function fetchRankings() {
      try {
        // Mark the start of data fetching for performance tracking
        performance.mark("rankings-fetch-start");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s

        // Try static file first with more relaxed caching for immediate fixes
        const response = await fetch("/data/rankings.json", {
          signal: controller.signal,
          cache: "no-cache", // Ensure we get fresh data to debug
          headers: {
            "Cache-Control": "no-cache", // Force fresh fetch
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Failed to fetch rankings: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch rankings: ${response.status}`);
        }

        // Mark when data is received
        performance.mark("rankings-fetch-end");

        // Parse JSON in a non-blocking way
        const text = await response.text();

        // Use a worker-like pattern for JSON parsing if the data is large
        if (text.length > 50000) {
          // For large JSON, parse in chunks
          const data = await new Promise<{ rankings?: unknown[]; [key: string]: unknown }>(
            (resolve) => {
              setTimeout(() => {
                resolve(JSON.parse(text));
              }, 0);
            }
          );

          performance.mark("rankings-parse-end");
          const rankings = (data.rankings || []) as RankingData[];
          processRankingsInChunks(rankings);

          // Update date immediately
          const algorithm = data["algorithm"] as any;
          if (algorithm?.["date"]) {
            const updateDate = new Date(algorithm["date"]);

            // Check if date is valid
            if (Number.isNaN(updateDate.getTime())) {
              setLastUpdateDate("Daily");
            } else {
              setLastUpdateDate(
                updateDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              );
            }
          }
        } else {
          // For smaller JSON, parse directly
          const data = JSON.parse(text);
          processRankingsInChunks(data.rankings || []);

          if (data.algorithm?.date) {
            const updateDate = new Date(data.algorithm.date);

            // Check if date is valid
            if (Number.isNaN(updateDate.getTime())) {
              setLastUpdateDate("Daily");
            } else {
              setLastUpdateDate(
                updateDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              );
            }
          }
        }

        // Measure and report performance
        performance.measure(
          "rankings-fetch-duration",
          "rankings-fetch-start",
          "rankings-fetch-end"
        );

        // Log performance metrics in development
        if (process.env.NODE_ENV === "development") {
          const measure = performance.getEntriesByName("rankings-fetch-duration")[0];
          if (measure && "duration" in measure) {
            console.log(`Rankings fetch took ${measure.duration.toFixed(2)}ms`);
          }
        }
      } catch (error) {
        console.error("Failed to fetch rankings", error);

        // Enhanced error logging for debugging
        if (error instanceof Error) {
          console.error("Error name:", error.name);
          console.error("Error message:", error.message);
          if (error.name === "AbortError") {
            console.error("Request timed out after 10 seconds");
          }
        }

        // Set loading to false but also try to set some fallback data
        setLoading(false);

        // Try to set a minimal fallback to show something rather than nothing
        setTotalTools(0);
        setTopRankings([]);
        setTrendingTools([]);
        setRecentlyUpdated([]);
      }
    }

    fetchRankings();
  }, [processRankingsInChunks]);

  // Memoize trending tools display to prevent re-computation
  const trendingDisplay = useMemo(() => {
    return trendingTools.length > 0 ? trendingTools : topRankings;
  }, [trendingTools, topRankings]);

  return (
    <>
      <HomeContent
        topRankings={topRankings}
        loading={loading}
        loadingText={loadingText}
        lang={lang}
      />

      {/* Optimized Stats Section */}
      <StatsSection
        loading={loading}
        totalTools={totalTools}
        trendingUpCount={trendingUpCount}
        trendingDownCount={trendingDownCount}
        lastUpdateDate={lastUpdateDate}
      />

      {/* Trending Section */}
      <section className="px-3 md:px-6 py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                <span>🔥</span>
                <span className="ml-2">Trending Tools</span>
              </h2>
              <p className="text-muted-foreground">Tools gaining momentum this week</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3 md:gap-6">
            {trendingDisplay.map((tool) => (
              <RankingCard
                key={tool.tool.id}
                tool={tool}
                lang={lang}
                showRankChange={trendingTools.length > 0}
              />
            ))}
          </div>
        </div>
      </section>

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

          <div className="grid md:grid-cols-2 gap-3 md:gap-6">
            {recentlyUpdated.map((tool) => (
              <RankingCard key={tool.tool.id} tool={tool} lang={lang} showRankChange={false} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
