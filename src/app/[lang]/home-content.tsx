"use client";

import { HeroCard } from "@/components/ranking/hero-card";

interface RankingData {
  rank: number;
  tool: {
    id: string;
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

interface HomeContentProps {
  topRankings: RankingData[];
  loading: boolean;
  loadingText: string;
}

export function HomeContent({ topRankings, loading, loadingText }: HomeContentProps) {
  return loading ? (
    <div className="text-center text-muted-foreground mb-12">{loadingText}</div>
  ) : (
    <div className="grid md:grid-cols-3 gap-3 md:gap-6 mb-12">
      {topRankings.map((ranking, index) => (
        <HeroCard key={ranking.tool.id} ranking={ranking} index={index} />
      ))}
    </div>
  );
}
