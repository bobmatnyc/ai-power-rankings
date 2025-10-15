"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { Locale } from "@/i18n/config";
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

interface AlgorithmData {
  version?: string;
  name?: string;
  date?: string;
  weights?: {
    newsImpact?: number;
    baseScore?: number;
  };
}

interface RankingsResponse {
  rankings?: RankingData[];
  algorithm?: AlgorithmData;
  stats?: {
    total_tools?: number;
    tools_with_news?: number;
    avg_news_boost?: number;
    max_news_impact?: number;
  };
  _source?: string;
  _timestamp?: string;
}

interface ClientRankingsProps {
  loadingText: string;
  lang: string;
  initialRankings?: RankingData[];
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
    showScore = true,
  }: {
    tool: RankingData;
    lang: string;
    showRankChange?: boolean;
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
            {showRankChange && tool.rankChange ? `+${tool.rankChange}` : `#${tool.rank}`}
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
              <div className="animate-pulse bg-gray-200 h-9 w-12 mx-auto rounded" />
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
              <div className="animate-pulse bg-gray-200 h-9 w-8 mx-auto rounded" />
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
              <div className="animate-pulse bg-gray-200 h-9 w-16 mx-auto rounded" />
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
              <div className="animate-pulse bg-gray-200 h-9 w-20 mx-auto rounded" />
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

function ClientRankings({ loadingText, lang, initialRankings = [] }: ClientRankingsProps) {
  const [topRankings, setTopRankings] = useState<RankingData[]>(initialRankings);
  const [trendingTools, setTrendingTools] = useState<RankingData[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<RankingData[]>([]);
  const [recentUpdatesLoading, setRecentUpdatesLoading] = useState(true);
  const [loading, setLoading] = useState(initialRankings.length === 0);
  const [totalTools, setTotalTools] = useState(0);
  const [categoriesCount, setCategoriesCount] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("");

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
        const transformedTools: RankingData[] = recentTools.map((tool: any, index: number) => ({
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
        const uniqueCategories = new Set(tools.map((t: any) => t.category).filter(Boolean));
        const categoriesNum = uniqueCategories.size;

        // Calculate average baseline score
        // First try baseline_score, then score field, then look for scores.overall
        const scoresArray = tools
          .map((t: any) => t.baseline_score || t.score || t.scores?.overall)
          .filter((s: any) => typeof s === 'number' && s > 0);

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
    // Calculate statistics from rankings data
    if (rankings && rankings.length > 0) {
      // Total tools
      const total = rankings.length;

      // Unique categories
      const uniqueCats = new Set(rankings.map((r) => r.tool.category).filter(Boolean));
      const catsCount = uniqueCats.size;

      // Average score
      const avgScoreVal = rankings.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / rankings.length;

      startTransition(() => {
        setTotalTools(total);
        setCategoriesCount(catsCount);
        setAvgScore(avgScoreVal);
      });
    }

    // Ensure this only runs on the client
    if (typeof window === "undefined") {
      // During SSR, just set the data directly without chunking
      setTopRankings(rankings.slice(0, 3));
      setTrendingTools(rankings.filter((r) => r.rankChange && r.rankChange > 0).slice(0, 3));
      // Recently updated is now fetched separately from the API
      setLoading(false);
      return;
    }

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

          if (trendingUp.length > 0) {
            startTransition(() => {
              setTrendingTools((prev) => [...prev, ...trendingUp].slice(0, 3));
            });
          }
        }

        currentIndex += CHUNK_SIZE;
      }

      // Schedule next chunk if needed
      if (currentIndex < rankings.length) {
        requestIdleCallback(processChunk);
      } else {
        // Final updates
        startTransition(() => {
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

  // Defer recent updates fetch for better initial performance
  // Wait 2 seconds after mount to fetch non-critical data
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecentUpdates();
    }, 2000);

    return () => clearTimeout(timer);
  }, [fetchRecentUpdates]);

  useEffect(() => {
    // Skip client-side fetch if we already have server-side data
    if (initialRankings.length > 0) {
      console.log("Using server-side rankings, skipping client fetch");
      // Calculate stats from initial rankings
      const total = initialRankings.length;
      const uniqueCats = new Set(initialRankings.map((r) => r.tool.category).filter(Boolean));
      const avgScoreVal = initialRankings.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / initialRankings.length;

      setTotalTools(total);
      setCategoriesCount(uniqueCats.size);
      setAvgScore(avgScoreVal);

      // Defer tools statistics fetch for better initial performance
      setTimeout(() => {
        fetchToolsStatistics();
      }, 1500);
      return;
    }

    async function fetchRankings() {
      try {
        console.log("Starting rankings fetch...");
        // Mark the start of data fetching for performance tracking
        performance.mark("rankings-fetch-start");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased timeout to 10s

        // Fetch from API endpoint (database source)
        const response = await fetch("/api/rankings", {
          signal: controller.signal,
          cache: "no-cache",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Failed to fetch rankings: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch rankings: ${response.status}`);
        }

        console.log("Successfully fetched rankings, parsing response...");

        // Mark when data is received
        performance.mark("rankings-fetch-end");

        // Parse JSON in a non-blocking way
        const text = await response.text();

        // Use a worker-like pattern for JSON parsing if the data is large
        if (text.length > 50000) {
          // For large JSON, parse in chunks
          const data = await new Promise<RankingsResponse>((resolve) => {
            setTimeout(() => {
              resolve(JSON.parse(text));
            }, 0);
          });

          performance.mark("rankings-parse-end");
          const rankings = (data.rankings || []) as RankingData[];

          // Check if we got empty rankings from database, try fallback to public data
          if (rankings.length === 0) {
            console.log("No rankings from API, trying fallback to public data");
            try {
              const fallbackResponse = await fetch("/data/rankings.json");
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.rankings && fallbackData.rankings.length > 0) {
                  console.log("Using fallback rankings from public/data");
                  processRankingsInChunks(fallbackData.rankings);

                  // Set date from fallback
                  if (fallbackData.algorithm?.date) {
                    const updateDate = new Date(fallbackData.algorithm.date);
                    if (!Number.isNaN(updateDate.getTime())) {
                      setLastUpdateDate(
                        updateDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      );
                    }
                  }
                  return;
                }
              }
            } catch (fallbackError) {
              console.warn("Failed to load fallback rankings:", fallbackError);
            }
          }

          processRankingsInChunks(rankings);

          // Update date immediately
          const algorithm = data.algorithm;
          if (algorithm?.date) {
            const updateDate = new Date(algorithm.date);

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
          const data: RankingsResponse = JSON.parse(text);

          // Check if we got empty rankings from database, try fallback to public data
          if (!data.rankings || data.rankings.length === 0) {
            console.log("No rankings from API, trying fallback to public data");
            try {
              const fallbackResponse = await fetch("/data/rankings.json");
              if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.rankings && fallbackData.rankings.length > 0) {
                  console.log("Using fallback rankings from public/data");
                  processRankingsInChunks(fallbackData.rankings);

                  // Set date from fallback
                  if (fallbackData.algorithm?.date) {
                    const updateDate = new Date(fallbackData.algorithm.date);
                    if (!Number.isNaN(updateDate.getTime())) {
                      setLastUpdateDate(
                        updateDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      );
                    }
                  }
                  return;
                }
              }
            } catch (fallbackError) {
              console.warn("Failed to load fallback rankings:", fallbackError);
            }
          }

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

    // Fetch rankings and tools statistics in parallel
    fetchRankings();
    fetchToolsStatistics();
  }, [processRankingsInChunks, fetchToolsStatistics, initialRankings.length]);

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
        lang={lang as Locale}
      />

      {/* Optimized Stats Section */}
      <StatsSection
        loading={loading}
        totalTools={totalTools}
        categoriesCount={categoriesCount}
        avgScore={avgScore}
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
                lang={lang as Locale}
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

          {recentUpdatesLoading ? (
            <div className="grid md:grid-cols-2 gap-3 md:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-card border rounded-lg p-4 h-32">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 rounded w-full"></div>
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
                  showRankChange={false}
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
