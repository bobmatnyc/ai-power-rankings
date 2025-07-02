"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export function ClientRankings({ loadingText, lang }: ClientRankingsProps) {
  const [topRankings, setTopRankings] = useState<RankingData[]>([]);
  const [trendingTools, setTrendingTools] = useState<RankingData[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTools, setTotalTools] = useState(0);
  const [trendingUpCount, setTrendingUpCount] = useState(0);
  const [trendingDownCount, setTrendingDownCount] = useState(0);
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("");

  useEffect(() => {
    async function fetchRankings() {
      try {
        console.log("Fetching rankings from static data");

        // Try multiple approaches to fetch the data
        let response;
        let data;

        // First try the static file with timeout
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

          console.log("Attempting to fetch /data/rankings.json");
          response = await fetch("/data/rankings.json", {
            signal: controller.signal,
            cache: "no-store",
          });
          clearTimeout(timeoutId);

          console.log("Static file response status:", response.status);
          console.log("Static file response headers:", response.headers);

          if (response.ok) {
            const text = await response.text();
            console.log("Static file response length:", text.length);
            console.log("First 100 chars:", text.substring(0, 100));

            try {
              data = JSON.parse(text);
              console.log("Successfully parsed static file data");
            } catch (parseError) {
              console.error("Failed to parse static file JSON:", parseError);
              console.log("Raw response:", text);
            }
          } else {
            console.warn("Static file not OK:", response.status, response.statusText);
          }
        } catch (e) {
          console.warn("Static file fetch failed:", e);
        }

        // If static file fails, try the API endpoint
        if (!data) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            response = await fetch("/api/rankings/json", {
              signal: controller.signal,
              cache: "no-store",
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              data = await response.json();
              console.log("Loaded from API endpoint");
            }
          } catch (e) {
            console.warn("API endpoint fetch failed:", e);
          }
        }

        if (!data) {
          throw new Error("Failed to fetch rankings from both static file and API");
        }

        console.log("Received data:", data);

        const rankings = data.rankings || [];
        console.log("Rankings count:", rankings.length);

        if (rankings && rankings.length > 0) {
          setTopRankings(rankings.slice(0, 3));

          // Calculate actual trending tools (those with positive rank changes)
          const actualTrendingTools = rankings.filter(
            (r: RankingData) => r.rankChange && r.rankChange > 0
          );
          setTrendingTools(actualTrendingTools.slice(0, 3));
          setTrendingUpCount(actualTrendingTools.length);

          // Calculate tools trending down (those with negative rank changes)
          const trendingDownTools = rankings.filter(
            (r: RankingData) => r.rankChange && r.rankChange < 0
          );
          setTrendingDownCount(trendingDownTools.length);

          setRecentlyUpdated(rankings.slice(6, 10));

          // Set total tools from stats or count rankings
          setTotalTools(data.stats?.total_tools || rankings.length);

          // Set last update date - show actual date
          if (data.algorithm?.date) {
            const updateDate = new Date(data.algorithm.date);
            // Format as "Jan 1, 2025" or similar
            const options: Intl.DateTimeFormatOptions = {
              month: "short",
              day: "numeric",
              year: "numeric",
            };
            setLastUpdateDate(updateDate.toLocaleDateString("en-US", options));
          } else {
            setLastUpdateDate("Daily");
          }
        } else {
          console.warn("No rankings data received", data);
        }
      } catch (error) {
        console.error("Failed to fetch rankings", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRankings();
  }, []);

  return (
    <>
      <HomeContent
        topRankings={topRankings}
        loading={loading}
        loadingText={loadingText}
        lang={lang}
      />

      {/* Stats Row - Optimized for T-031 CLS fix */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 stats-grid"
        style={{ minHeight: "120px" }} // Reserve space to prevent layout shift
      >
        <div
          className="text-center"
          style={{
            width: "100%",
            minHeight: "80px", // Consistent height
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div className="text-3xl font-bold text-primary mb-1">
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-9 w-12 mx-auto rounded" />
            ) : (
              totalTools
            )}
          </div>
          <div className="text-sm text-muted-foreground">Tools Ranked</div>
        </div>
        <div
          className="text-center"
          style={{
            width: "100%",
            minHeight: "80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div className="text-3xl font-bold text-secondary mb-1">
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-9 w-20 mx-auto rounded" />
            ) : (
              `${trendingUpCount}/${trendingDownCount}`
            )}
          </div>
          <div className="text-sm text-muted-foreground">Trending ↑/↓</div>
        </div>
        <div
          className="text-center"
          style={{
            width: "100%",
            minHeight: "80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div className="text-3xl font-bold text-accent mb-1">
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-9 w-16 mx-auto rounded" />
            ) : (
              lastUpdateDate || "Daily"
            )}
          </div>
          <div className="text-sm text-muted-foreground">Last Update</div>
        </div>
        <div
          className="text-center"
          style={{
            width: "100%",
            minHeight: "80px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div className="text-3xl font-bold text-foreground mb-1">100%</div>
          <div className="text-sm text-muted-foreground">Free Access</div>
        </div>
      </div>

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
            {trendingTools.length > 0
              ? // Show actual trending tools
                trendingTools.map((tool: RankingData) => (
                  <Link
                    key={tool.tool.id}
                    href={`/${lang}/tools/${tool.tool.slug || tool.tool.id}`}
                    className="relative h-full block"
                  >
                    <div className="absolute -top-2 -right-2 z-10">
                      <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
                        +{tool.rankChange}
                      </span>
                    </div>
                    <div className="h-full">
                      <div className="bg-card border rounded-lg p-4 h-full hover:shadow-lg transition-shadow cursor-pointer">
                        <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
                        <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
                        <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
                        {tool.changeReason && (
                          <p className="mt-2 text-xs text-muted-foreground">{tool.changeReason}</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              : // Fall back to top performers if no rank changes
                topRankings.map((tool: RankingData) => (
                  <Link
                    key={tool.tool.id}
                    href={`/${lang}/tools/${tool.tool.slug || tool.tool.id}`}
                    className="relative h-full block"
                  >
                    <div className="absolute -top-2 -right-2 z-10">
                      <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
                        #{tool.rank}
                      </span>
                    </div>
                    <div className="h-full">
                      <div className="bg-card border rounded-lg p-4 h-full hover:shadow-lg transition-shadow cursor-pointer">
                        <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
                        <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
                        <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
                      </div>
                    </div>
                  </Link>
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
            {recentlyUpdated.map((tool: RankingData) => (
              <Link
                key={tool.tool.id}
                href={`/${lang}/tools/${tool.tool.slug || tool.tool.id}`}
                className="h-full block"
              >
                <div className="bg-card border rounded-lg p-4 h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
                  <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
                  <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
