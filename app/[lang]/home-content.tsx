"use client";

import { HeroCard } from "@/components/ranking/hero-card";
import type { Locale } from "@/i18n/config";

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

interface HomeContentProps {
  topRankings: RankingData[];
  loading: boolean;
  loadingText: string;
  lang?: string;
}

export function HomeContent({ topRankings, loading, loadingText, lang = "en" }: HomeContentProps) {
  return loading ? (
    <div className="text-center text-muted-foreground mb-12">{loadingText}</div>
  ) : topRankings.length === 0 ? (
    <div className="text-center text-muted-foreground mb-12">
      <p>Unable to load rankings data. Please refresh the page or try again later.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
      >
        Reload Page
      </button>
    </div>
  ) : (
    <div className="grid md:grid-cols-3 gap-3 md:gap-6 mb-12">
      {topRankings.map((ranking, index) => (
        <HeroCard key={ranking.tool.id} ranking={ranking} index={index} lang={lang as Locale} />
      ))}
    </div>
  );
}
