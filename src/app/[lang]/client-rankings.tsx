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
  const [debugInfo, setDebugInfo] = useState<string>("");

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

        // Set debug info for display
        setDebugInfo(
          `API Response: ${rankings.length} rankings received at ${new Date().toISOString()}`
        );

        if (rankings && rankings.length > 0) {
          setTopRankings(rankings.slice(0, 3));
          setTrendingTools(rankings.slice(3, 6));
          setRecentlyUpdated(rankings.slice(6, 10));
        } else {
          console.warn("No rankings data received", data);
          setDebugInfo(`WARNING: No rankings data received. Response: ${JSON.stringify(data)}`);
        }
      } catch (error) {
        console.error("Failed to fetch rankings", error);
        setDebugInfo(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
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

      {/* Debug Info - only visible in development */}
      {debugInfo && (
        <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-md">
          <p className="text-sm font-mono">{debugInfo}</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary mb-1">
            {loading ? 0 : topRankings.length > 0 ? 39 : 0}
          </div>
          <div className="text-sm text-muted-foreground">Tools Ranked</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-secondary mb-1">
            {loading ? 0 : trendingTools.length}
          </div>
          <div className="text-sm text-muted-foreground">Trending Up</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-accent mb-1">Daily</div>
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
            {trendingTools.map((tool: any, index: number) => (
              <div key={tool.tool.id} className="relative h-full">
                <div className="absolute -top-2 -right-2 z-10">
                  <span className="bg-accent border-0 shadow-lg text-accent-foreground px-2 py-1 rounded text-sm">
                    +{3 - index}
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
