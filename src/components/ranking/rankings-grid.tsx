"use client";

import { useEffect, useState, Suspense } from "react";
import { loggers } from "@/lib/logger";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid, List, ArrowUpDown, TrendingUp, Star } from "lucide-react";
import { RankingCard } from "./ranking-card";
import { TierLegend } from "./tier-legend";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface RankingData {
  rank: number;
  tool: {
    id: string;
    name: string;
    category: string;
    status: string;
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
}

function RankingsGridContent({
  lang,
  dict,
  initialRankings = [],
}: RankingsGridProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const [rankings, setRankings] = useState<RankingData[]>(initialRankings);
  const [loading, setLoading] = useState(initialRankings.length === 0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lastUpdateDate, setLastUpdateDate] = useState<string>("");

  // Get filters from URL
  const categoryParam = searchParams.get("category") || "all";
  const tagsParam = searchParams.get("tags")?.split(",") || [];
  const sortParam = searchParams.get("sort") || "rank";

  useEffect(() => {
    // Only fetch if no initial rankings provided
    if (initialRankings.length === 0) {
      fetchRankings();
    } else {
      setLoading(false);
      // For SSR, we need to fetch the algorithm date separately
      fetchAlgorithmDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRankings.length]);

  const fetchAlgorithmDate = async (): Promise<void> => {
    try {
      const response = await fetch("/api/rankings?metadata=true");
      if (response.ok) {
        const data = await response.json();
        if (data.algorithm?.date) {
          const date = new Date(data.algorithm.date);
          const formattedDate = date.toLocaleDateString(lang, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          setLastUpdateDate(formattedDate);
        }
      }
    } catch {
      // Silently fail, will use fallback
    }
  };

  const fetchRankings = async (): Promise<void> => {
    try {
      const isDev = process.env["NODE_ENV"] === "development";
      const timestamp = Date.now();
      const url = `/api/rankings${isDev ? `?_t=${timestamp}` : ""}`;
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

        // Set last update date from algorithm date
        if (data.algorithm?.date) {
          const date = new Date(data.algorithm.date);
          const formattedDate = date.toLocaleDateString(lang, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          setLastUpdateDate(formattedDate);
        }
      }

      setLoading(false);
    } catch (error) {
      loggers.ranking.error("Failed to fetch rankings", { error });
      setRankings([]); // Ensure rankings is always an array
      setLoading(false);
    }
  };

  // Apply filters
  const filteredRankings = rankings.filter((r) => {
    if (categoryParam !== "all" && r.tool.category !== categoryParam) {
      return false;
    }
    // Add tag filtering logic here when tags are implemented
    return true;
  });

  // Apply sorting
  const sortedRankings = [...filteredRankings].sort((a, b) => {
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
      </div>

      {/* Stats Cards - Optimized for T-031 CLS fix */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-8"
        style={{ minHeight: "140px" }} // Reserve space to prevent layout shift
      >
        <Card
          className="border-border/50"
          style={{ minHeight: "120px" }} // Consistent card height
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {dict.rankings.stats.totalTools}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-12 rounded" />
              ) : (
                rankings.length
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50" style={{ minHeight: "120px" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {dict.rankings.stats.categories}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-8 rounded" />
              ) : (
                new Set(rankings.map((r) => r.tool.category)).size
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50" style={{ minHeight: "120px" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {dict.rankings.stats.avgScore}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-12 rounded" />
              ) : (
                (
                  rankings.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / rankings.length
                ).toFixed(1)
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50" style={{ minHeight: "120px" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {dict.rankings.stats.lastUpdate}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-16 rounded" />
              ) : (
                lastUpdateDate || dict.rankings.stats.thisWeek
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Legend */}
      <div className="mb-6">
        <TierLegend dict={dict} />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Select
            value={sortParam}
            onValueChange={(value) => {
              const params = new URLSearchParams(searchParams.toString());
              if (value === "rank") {
                params.delete("sort");
              } else {
                params.set("sort", value);
              }
              window.location.href = `/${lang}/rankings${params.toString() ? `?${params.toString()}` : ""}`;
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
      {(categoryParam !== "all" || tagsParam.length > 0) && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">{dict.rankings.activeFilters}:</span>
          {categoryParam !== "all" && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete("category");
                window.location.href = `/${lang}/rankings${params.toString() ? `?${params.toString()}` : ""}`;
              }}
            >
              {categoryParam.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())} ✕
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
                window.location.href = `/${lang}/rankings${params.toString() ? `?${params.toString()}` : ""}`;
              }}
            >
              {tag.replace(/-/g, " ")} ✕
            </Badge>
          ))}
        </div>
      )}

      {/* Rankings Display */}
      {viewMode === "grid" ? (
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
      <Card className="mt-12">
        <CardHeader>
          <CardTitle>{dict.rankings.algorithm.title}</CardTitle>
          <CardDescription>{dict.rankings.algorithm.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="factors" className="w-full">
            <TabsList>
              <TabsTrigger value="factors">{dict.rankings.algorithm.tabs.factors}</TabsTrigger>
              <TabsTrigger value="modifiers">{dict.rankings.algorithm.tabs.modifiers}</TabsTrigger>
              <TabsTrigger value="methodology">
                {dict.rankings.algorithm.tabs.methodology}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="factors" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">{dict.rankings.algorithm.primaryFactors}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.agentic}</span>
                        <span className="text-muted-foreground">30.0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.innovation}</span>
                        <span className="text-muted-foreground">15.0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.performance}</span>
                        <span className="text-muted-foreground">12.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.adoption}</span>
                        <span className="text-muted-foreground">10.0%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      {dict.rankings.algorithm.secondaryFactors}
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.traction}</span>
                        <span className="text-muted-foreground">12.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.sentiment}</span>
                        <span className="text-muted-foreground">7.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.velocity}</span>
                        <span className="text-muted-foreground">5.0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{dict.rankings.algorithm.factors.resilience}</span>
                        <span className="text-muted-foreground">5.0%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="modifiers" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">
                    💡 {dict.home.methodology.modifiers.decay.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {dict.rankings.algorithm.modifiers.decay}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">
                    ⚠️ {dict.home.methodology.modifiers.risk.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {dict.rankings.algorithm.modifiers.risk}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">
                    💰 {dict.home.methodology.modifiers.revenue.name}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {dict.rankings.algorithm.modifiers.revenue}
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="methodology" className="mt-4">
              <div className="prose prose-sm text-muted-foreground">
                <p>{dict.rankings.algorithm.methodologyText}</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href={`/${lang}/methodology`}>
                    {dict.rankings.algorithm.viewMethodology}
                  </Link>
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RankingsGrid({
  lang,
  dict,
  initialRankings,
}: RankingsGridProps): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{dict.common.loading}</p>
        </div>
      }
    >
      <RankingsGridContent lang={lang} dict={dict} initialRankings={initialRankings} />
    </Suspense>
  );
}
