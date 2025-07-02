"use client";

import { useEffect, useState, Suspense } from "react";
import { loggers } from "@/lib/logger";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getCategoryColor } from "@/lib/category-colors";

interface RankingData {
  rank: number;
  tool: {
    id: string;
    slug?: string;
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

function RankingsContentInner(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rankings, setRankings] = useState<RankingData[]>([]);
  const [loading, setLoading] = useState(true);

  // Get category from URL or default to 'all'
  const categoryParam = searchParams.get("category") || "all";
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);

  useEffect(() => {
    fetchRankings();
  }, []);

  useEffect(() => {
    // Update URL when category changes
    const params = new URLSearchParams(searchParams.toString());
    if (selectedCategory === "all") {
      params.delete("category");
    } else {
      params.set("category", selectedCategory);
    }
    const query = params.toString();
    router.push(query ? `?${query}` : "/rankings", { scroll: false });
  }, [selectedCategory, router, searchParams]);

  const fetchRankings = async (): Promise<void> => {
    try {
      const response = await fetch("/api/rankings");
      const data = await response.json();
      setRankings(data.rankings);
      setLoading(false);
    } catch (error) {
      loggers.ranking.error("Failed to fetch rankings", { error });
      setLoading(false);
    }
  };

  const categories = ["all", ...new Set(rankings.map((r) => r.tool.category))];
  const filteredRankings =
    selectedCategory === "all"
      ? rankings
      : rankings.filter((r) => r.tool.category === selectedCategory);

  const getStatusBadge = (status: string): React.JSX.Element => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      beta: "secondary",
      acquired: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const formatMetric = (value: number | undefined, type: string): string => {
    if (value === undefined || value === 0) {
      return "-";
    }

    switch (type) {
      case "users":
        return value >= 1000000
          ? `${(value / 1000000).toFixed(1)}M`
          : `${(value / 1000).toFixed(0)}k`;
      case "arr": {
        const millions = value / 1000000;
        if (millions >= 1000) {
          const billions = millions / 1000;
          return `$${billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)}B`;
        }
        return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
      }
      case "percentage":
        return `${value.toFixed(1)}%`;
      case "stars":
        return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString();
      default:
        return value.toFixed(1);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading rankings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Power Ranking</h1>
        <p className="text-muted-foreground text-lg">
          Algorithm v6.0: Code-Ready Modifiers • June 2025
        </p>
      </div>

      {/* Algorithm Info Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Algorithm v6.0 Features</CardTitle>
          <CardDescription>
            Enhanced ranking system with innovation decay, platform risk modifiers, and revenue
            quality adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <h4 className="font-semibold mb-1">Agentic Capability</h4>
              <p className="text-sm text-muted-foreground">30% weight</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Innovation</h4>
              <p className="text-sm text-muted-foreground">15% weight (with decay)</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Technical Performance</h4>
              <p className="text-sm text-muted-foreground">12.5% weight</p>
            </div>
            <div>
              <h4 className="font-semibold mb-1">Market Traction</h4>
              <p className="text-sm text-muted-foreground">12.5% weight</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="mb-6 flex gap-4 items-center">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === "all"
                  ? "All Categories"
                  : cat.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedCategory !== "all" && (
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80"
            onClick={() => setSelectedCategory("all")}
          >
            Clear filter ✕
          </Badge>
        )}
      </div>

      {/* Rankings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top 15 AI Coding Tools</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Overall Score</TableHead>
                <TableHead className="text-center">Key Metrics</TableHead>
                <TableHead className="text-center">Modifiers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRankings.slice(0, 15).map((ranking) => {
                const medal =
                  ranking.rank === 1
                    ? "🥇"
                    : ranking.rank === 2
                      ? "🥈"
                      : ranking.rank === 3
                        ? "🥉"
                        : "";

                return (
                  <TableRow key={ranking.tool.id}>
                    <TableCell className="font-medium">
                      <span className="text-lg">{medal}</span> {ranking.rank}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/tools/${ranking.tool.slug || ranking.tool.id}`}
                          className="font-semibold hover:underline"
                        >
                          {ranking.tool.name}
                        </Link>
                        {getStatusBadge(ranking.tool.status)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${getCategoryColor(ranking.tool.category)} cursor-pointer hover:opacity-80`}
                        onClick={() => setSelectedCategory(ranking.tool.category)}
                      >
                        {ranking.tool.category.replace("-", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {ranking.scores?.overall ? (
                        <>
                          <div className="font-bold text-lg">
                            {ranking.scores.overall.toFixed(1)}
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground">-</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {ranking.metrics.users !== undefined && ranking.metrics.users > 0 && (
                          <div>Users: {formatMetric(ranking.metrics.users, "users")}</div>
                        )}
                        {ranking.metrics.monthly_arr !== undefined &&
                          ranking.metrics.monthly_arr > 0 && (
                            <div>ARR: {formatMetric(ranking.metrics.monthly_arr, "arr")}</div>
                          )}
                        {ranking.metrics.swe_bench_score !== undefined &&
                          ranking.metrics.swe_bench_score > 0 && (
                            <div>
                              SWE-bench:{" "}
                              {formatMetric(ranking.metrics.swe_bench_score, "percentage")}
                            </div>
                          )}
                        {ranking.metrics.github_stars !== undefined &&
                          ranking.metrics.github_stars > 0 && (
                            <div>
                              GitHub: {formatMetric(ranking.metrics.github_stars, "stars")}⭐
                            </div>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        {ranking.modifiers?.innovation_decay &&
                          ranking.modifiers.innovation_decay < 0.8 && (
                            <div className="text-orange-600">
                              🔄 Decay: {(ranking.modifiers.innovation_decay * 100).toFixed(0)}%
                            </div>
                          )}
                        {ranking.modifiers?.platform_risk !== undefined &&
                          Math.abs(ranking.modifiers.platform_risk) > 0.001 && (
                            <div
                              className={
                                ranking.modifiers.platform_risk > 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              ⚠️ Risk: {ranking.modifiers.platform_risk > 0 ? "+" : ""}
                              {ranking.modifiers.platform_risk.toFixed(1)}
                            </div>
                          )}
                        {ranking.modifiers?.revenue_quality &&
                          ranking.modifiers.revenue_quality !== 0.5 && (
                            <div className="text-blue-600">
                              💰 Quality: {(ranking.modifiers.revenue_quality * 100).toFixed(0)}%
                            </div>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Score Breakdown Tabs */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Detailed Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="top3" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="top3">Top 3 Analysis</TabsTrigger>
              <TabsTrigger value="factors">Scoring Factors</TabsTrigger>
              <TabsTrigger value="insights">Key Insights</TabsTrigger>
            </TabsList>

            <TabsContent value="top3" className="mt-4">
              <div className="space-y-4">
                {rankings.slice(0, 3).map((ranking) => (
                  <Card key={ranking.tool.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        #{ranking.rank} {ranking.tool.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Agentic</p>
                          <p className="font-semibold">
                            {ranking.scores?.agentic_capability
                              ? `${ranking.scores.agentic_capability.toFixed(1)}`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Innovation</p>
                          <p className="font-semibold">
                            {ranking.scores?.innovation
                              ? `${ranking.scores.innovation.toFixed(1)}`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Technical</p>
                          <p className="font-semibold">
                            {ranking.scores?.technical_performance
                              ? `${ranking.scores.technical_performance.toFixed(1)}`
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Adoption</p>
                          <p className="font-semibold">
                            {ranking.scores?.developer_adoption
                              ? `${ranking.scores.developer_adoption.toFixed(1)}`
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="factors" className="mt-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Primary Factors (67.5% total)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>Agentic Capability</span>
                      <span className="font-mono">30.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Innovation (with decay)</span>
                      <span className="font-mono">15.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Technical Performance</span>
                      <span className="font-mono">12.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Developer Adoption</span>
                      <span className="font-mono">12.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Market Traction</span>
                      <span className="font-mono">12.5%</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-2">Secondary Factors (17.5% total)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>Business Sentiment</span>
                      <span className="font-mono">7.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Development Velocity</span>
                      <span className="font-mono">5.0%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Resilience</span>
                      <span className="font-mono">5.0%</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="insights" className="mt-4">
              <div className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-1">💡 Innovation Decay</h4>
                  <p className="text-muted-foreground">
                    Innovation scores decay with a 6-month half-life. Tools with innovations older
                    than 12 months see significant score reductions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">⚠️ Platform Risk</h4>
                  <p className="text-muted-foreground">
                    Tools receive penalties for exclusive dependencies or acquisition by LLM
                    providers. Open-source tools with multi-LLM support receive bonuses.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">💰 Revenue Quality</h4>
                  <p className="text-muted-foreground">
                    Enterprise revenue (&gt;$100k ACV) counts at 100%, while freemium and
                    donation-based models count at 30% and 20% respectively.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RankingsContent(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading rankings...</p>
          </div>
        </div>
      }
    >
      <RankingsContentInner />
    </Suspense>
  );
}
