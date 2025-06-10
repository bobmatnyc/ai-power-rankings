"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Grid, List, ArrowUpDown, TrendingUp, Star } from "lucide-react";
import { RankingCard } from "./ranking-card";

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

export default function RankingsGrid(): React.JSX.Element {
  const searchParams = useSearchParams();
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Get filters from URL
  const categoryParam = searchParams.get("category") || "all";
  const tagsParam = searchParams.get("tags")?.split(",") || [];
  const sortParam = searchParams.get("sort") || "rank";

  useEffect(() => {
    fetchRankings();
  }, []);

  const fetchRankings = async (): Promise<void> => {
    try {
      const response = await fetch("/api/rankings");
      const data = await response.json();
      setRankings(data.rankings);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch rankings:", error);
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
        <p className="text-muted-foreground">Loading rankings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Power Rankings</h1>
        <p className="text-muted-foreground text-lg">
          Comprehensive rankings of AI coding tools using Algorithm v6.0
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rankings.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(rankings.map(r => r.tool.category)).size}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(rankings.reduce((acc, r) => acc + (r.scores?.overall || 0), 0) / rankings.length).toFixed(1)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">This Week</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Select value={sortParam} onValueChange={(value) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === "rank") {
              params.delete("sort");
            } else {
              params.set("sort", value);
            }
            window.location.href = `/rankings${params.toString() ? `?${params.toString()}` : ''}`;
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">
                <div className="flex items-center">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Rank
                </div>
              </SelectItem>
              <SelectItem value="trending">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Trending
                </div>
              </SelectItem>
              <SelectItem value="score">
                <div className="flex items-center">
                  <Star className="h-4 w-4 mr-2" />
                  Score
                </div>
              </SelectItem>
              <SelectItem value="name">Name</SelectItem>
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
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {categoryParam !== "all" && (
            <Badge variant="secondary" className="cursor-pointer" onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("category");
              window.location.href = `/rankings${params.toString() ? `?${params.toString()}` : ''}`;
            }}>
              {categoryParam.replace(/-/g, ' ')} ✕
            </Badge>
          )}
          {tagsParam.map(tag => (
            <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              const newTags = tagsParam.filter(t => t !== tag);
              if (newTags.length === 0) {
                params.delete("tags");
              } else {
                params.set("tags", newTags.join(","));
              }
              window.location.href = `/rankings${params.toString() ? `?${params.toString()}` : ''}`;
            }}>
              {tag.replace(/-/g, ' ')} ✕
            </Badge>
          ))}
        </div>
      )}

      {/* Rankings Display */}
      {viewMode === "grid" ? (
        <div className="grid md:grid-cols-2 gap-6">
          {sortedRankings.map((ranking) => (
            <RankingCard key={ranking.tool.id} ranking={ranking} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {sortedRankings.map((ranking) => (
            <RankingCard key={ranking.tool.id} ranking={ranking} />
          ))}
        </div>
      )}

      {/* Algorithm Info */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle>About Algorithm v6.0</CardTitle>
          <CardDescription>
            Enhanced ranking system with innovation decay, platform risk modifiers, and revenue quality adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="factors" className="w-full">
            <TabsList>
              <TabsTrigger value="factors">Scoring Factors</TabsTrigger>
              <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
              <TabsTrigger value="methodology">Methodology</TabsTrigger>
            </TabsList>

            <TabsContent value="factors" className="mt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Primary Factors (67.5%)</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Agentic Capability</span>
                        <span className="text-muted-foreground">30.0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Innovation</span>
                        <span className="text-muted-foreground">15.0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Technical Performance</span>
                        <span className="text-muted-foreground">12.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Developer Adoption</span>
                        <span className="text-muted-foreground">10.0%</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Secondary Factors (32.5%)</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Market Traction</span>
                        <span className="text-muted-foreground">12.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Business Sentiment</span>
                        <span className="text-muted-foreground">7.5%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Development Velocity</span>
                        <span className="text-muted-foreground">5.0%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Platform Resilience</span>
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
                  <h4 className="font-semibold mb-2">💡 Innovation Decay</h4>
                  <p className="text-sm text-muted-foreground">
                    Innovation scores decay with a 6-month half-life. Tools with innovations older
                    than 12 months see significant score reductions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">⚠️ Platform Risk</h4>
                  <p className="text-sm text-muted-foreground">
                    Tools receive penalties for exclusive dependencies or acquisition by LLM
                    providers. Open-source tools with multi-LLM support receive bonuses.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">💰 Revenue Quality</h4>
                  <p className="text-sm text-muted-foreground">
                    Enterprise revenue (&gt;$100k ACV) counts at 100%, while freemium and
                    donation-based models count at 30% and 20% respectively.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="methodology" className="mt-4">
              <div className="prose prose-sm text-muted-foreground">
                <p>
                  Our ranking algorithm combines quantitative metrics with qualitative assessments
                  to provide a comprehensive view of AI coding tools. We update rankings weekly
                  based on new data and continuously refine our methodology.
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/methodology">
                    View Full Methodology
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