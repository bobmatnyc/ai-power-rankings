"use client";

import { useEffect, useState } from "react";
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
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("");

  useEffect(() => {
    async function fetchRankings() {
      try {
        console.log("Fetching rankings from /api/rankings");
        const response = await fetch("/api/rankings");

        console.log("Response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("API Error:", errorText);
          throw new Error(`Failed to fetch rankings: ${response.status}`);
        }

        const data = await response.json();
        console.log("Received data:", data);

        const rankings = data.rankings || [];
        console.log("Rankings count:", rankings.length);

        if (rankings && rankings.length > 0) {
          setTopRankings(rankings.slice(0, 3));

          // Calculate actual trending tools (those with positive rank changes)
          const actualTrendingTools = rankings.filter(
            (r: any) => r.rank_change && r.rank_change > 0
          );
          setTrendingTools(actualTrendingTools.slice(0, 3));
          setTrendingUpCount(actualTrendingTools.length);

          setRecentlyUpdated(rankings.slice(6, 10));

          // Set total tools from stats or count rankings
          setTotalTools(data.stats?.total_tools || rankings.length);

          // Set last update date
          if (data.algorithm?.date) {
            const updateDate = new Date(data.algorithm.date);
            const isToday = new Date().toDateString() === updateDate.toDateString();
            const isYesterday =
              new Date(Date.now() - 86400000).toDateString() === updateDate.toDateString();
            setLastUpdateDate(isToday ? "Today" : isYesterday ? "Yesterday" : "Daily");
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

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary mb-1">{loading ? 0 : totalTools}</div>
          <div className="text-sm text-muted-foreground">Tools Ranked</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-secondary mb-1">
            {loading ? 0 : trendingUpCount}
          </div>
          <div className="text-sm text-muted-foreground">Trending Up</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-accent mb-1">
            {loading ? "..." : lastUpdateDate || "Daily"}
          </div>
          <div className="text-sm text-muted-foreground">Updates</div>
        </div>
        <div className="text-center">
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
                trendingTools.map((tool: any) => (
                  <div key={tool.tool.id} className="relative h-full">
                    <div className="absolute -top-2 -right-2 z-10">
                      <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
                        +{tool.rank_change}
                      </span>
                    </div>
                    <div className="h-full">
                      <div className="bg-card border rounded-lg p-4 h-full">
                        <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
                        <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
                        <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
                        {tool.change_reason && (
                          <p className="mt-2 text-xs text-muted-foreground">{tool.change_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              : // Fall back to top performers if no rank changes
                topRankings.map((tool: any) => (
                  <div key={tool.tool.id} className="relative h-full">
                    <div className="absolute -top-2 -right-2 z-10">
                      <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
                        #{tool.rank}
                      </span>
                    </div>
                    <div className="h-full">
                      <div className="bg-card border rounded-lg p-4 h-full">
                        <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
                        <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
                        <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
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
            {recentlyUpdated.map((tool: any) => (
              <div key={tool.tool.id} className="h-full">
                <div className="bg-card border rounded-lg p-4 h-full">
                  <h3 className="font-semibold text-lg">{tool.tool.name}</h3>
                  <p className="text-sm text-muted-foreground">{tool.tool.category}</p>
                  <div className="mt-2 text-sm">Score: {tool.scores.overall.toFixed(1)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
