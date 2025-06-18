"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { NewsCard, type NewsItem } from "@/components/news/news-card";
import type { MetricHistory } from "@/types/database";

interface ToolDetailTabsProps {
  tool: {
    id: string;
    name: string;
    category: string;
    info?: {
      links?: {
        website?: string;
      };
    };
  };
  ranking?: {
    rank: number;
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
  };
  metrics?: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
    github_stars?: number;
    valuation?: number;
    funding?: number;
    employees?: number;
  };
  metricHistory?: MetricHistory[];
  rankingsHistory?: Array<{
    position: number;
    score: number;
    period: string;
    ranking_periods: {
      period: string;
      display_name: string;
      calculation_date: string;
    };
  }>;
  newsItems?: Array<{
    id: string;
    title: string;
    summary?: string;
    url?: string;
    source?: string;
    published_at: string;
    category?: string;
    type?: string;
  }>;
  dict: any;
}

const formatMetric = (value: number | undefined, type: string, dict: any): string => {
  if (value === undefined || value === 0) {
    return dict.common.notAvailable;
  }

  switch (type) {
    case "users":
      return value >= 1000000
        ? `${(value / 1000000).toFixed(1)}M`
        : `${(value / 1000).toFixed(0)}k`;
    case "currency":
      const millions = value / 1000000;
      if (millions >= 1000) {
        const billions = millions / 1000;
        return `$${billions % 1 === 0 ? billions.toFixed(0) : billions.toFixed(1)}B`;
      }
      return `$${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "number":
      return value.toLocaleString();
    default:
      return value.toString();
  }
};

export function ToolDetailTabs({
  tool,
  ranking,
  metrics,
  metricHistory,
  rankingsHistory,
  newsItems,
  dict,
}: ToolDetailTabsProps) {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("performance");

  // Debug logging
  console.log("ToolDetailTabs data:", {
    rankingsHistory: rankingsHistory?.length || 0,
    newsItems: newsItems?.length || 0,
    metricHistory: metricHistory?.length || 0,
  });

  // Handle hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && ["performance", "metrics", "scores", "history"].includes(hash)) {
        setActiveTab(hash);
      }
    };

    // Set initial tab from hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Update hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    window.history.pushState(null, "", `${pathname}#${value}`);
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
        <TabsTrigger value="performance" className="text-xs md:text-sm">
          {dict.tools.detail.tabs.performance}
        </TabsTrigger>
        <TabsTrigger value="metrics" className="text-xs md:text-sm">
          {dict.tools.detail.tabs.businessMetrics}
        </TabsTrigger>
        <TabsTrigger value="scores" className="text-xs md:text-sm">
          {dict.tools.detail.tabs.scores}
        </TabsTrigger>
        <TabsTrigger value="history" className="text-xs md:text-sm">
          {dict.tools.detail.tabs.history}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="performance" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{dict.tools.detail.performance.title}</CardTitle>
            <CardDescription>{dict.tools.detail.performance.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics?.swe_bench_score !== undefined && metrics.swe_bench_score > 0 && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">
                      {dict.tools.detail.performance.sweScore}
                    </span>
                    <span className="text-sm font-medium">
                      {formatMetric(metrics.swe_bench_score, "percentage", dict)}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min(metrics.swe_bench_score, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {dict.tools.detail.performance.contextWindow}
                  </p>
                  <p className="font-medium">200k {dict.tools.detail.performance.tokens}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {dict.tools.detail.performance.languageSupport}
                  </p>
                  <p className="font-medium">20+ {dict.tools.detail.performance.languages}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {dict.tools.detail.performance.multiFileSupport}
                  </p>
                  <p className="font-medium">{dict.tools.detail.performance.yes}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {dict.tools.detail.performance.llmProviders}
                  </p>
                  <p className="font-medium">{dict.tools.detail.performance.multiple}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="metrics" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Business Metrics</CardTitle>
            <CardDescription>Financial and growth metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {metrics?.monthly_arr !== undefined && metrics.monthly_arr > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">ARR (Monthly)</p>
                  <p className="text-2xl font-bold">
                    {formatMetric(metrics.monthly_arr, "currency", dict)}
                  </p>
                </div>
              )}
              {metrics?.valuation !== undefined && metrics.valuation > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Valuation</p>
                  <p className="text-2xl font-bold">
                    {formatMetric(metrics.valuation, "currency", dict)}
                  </p>
                </div>
              )}
              {metrics?.funding !== undefined && metrics.funding > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Total Funding</p>
                  <p className="text-2xl font-bold">
                    {formatMetric(metrics.funding, "currency", dict)}
                  </p>
                </div>
              )}
              {metrics?.employees !== undefined && metrics.employees > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Employees</p>
                  <p className="text-2xl font-bold">
                    {formatMetric(metrics.employees, "number", dict)}
                  </p>
                </div>
              )}
              {metrics?.users !== undefined && metrics.users > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{formatMetric(metrics.users, "users", dict)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="scores" className="space-y-4">
        {ranking ? (
          <Card>
            <CardHeader>
              <CardTitle>Algorithm v6.0 Scores</CardTitle>
              <CardDescription>Detailed scoring breakdown across all factors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <span className="font-semibold">Overall Score</span>
                  <span className="text-2xl font-bold">{ranking.scores.overall.toFixed(2)}/10</span>
                </div>

                <Separator />

                <div className="space-y-3">
                  {Object.entries(ranking.scores)
                    .filter(([key]) => key !== "overall")
                    .map(([factor, score]) => (
                      <div key={factor}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium capitalize">
                            {factor.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-medium">{score.toFixed(1)}/10</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${score * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                This tool has not been ranked yet.
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <div className="space-y-6">
          {/* News Updates Section */}
          {newsItems && newsItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">News & Updates</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Recent news and announcements about {tool.name}
              </p>
              <div className="space-y-4">
                {newsItems.map((item) => {
                  const newsItem: NewsItem = {
                    id: item.id,
                    tool_id: tool.id,
                    tool_name: tool.name,
                    tool_category: tool.category,
                    tool_website: tool.info?.links?.website,
                    event_date: item.published_at,
                    event_type: item.type || "update",
                    title: item.title,
                    description: item.summary || "",
                    source_url: item.url,
                    source_name: item.source,
                  };
                  return <NewsCard key={item.id} item={newsItem} showToolLink={false} />;
                })}
              </div>
            </div>
          )}

          {/* Rankings History Section */}
          {rankingsHistory && rankingsHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Rankings History</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Historical rankings for {tool.name}
              </p>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {rankingsHistory.map((history) => (
                      <div
                        key={history.period}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">{history.ranking_periods.display_name}</p>
                          <p className="text-sm text-muted-foreground">
                            Score: {history.score.toFixed(2)}
                          </p>
                        </div>
                        <Badge variant={history.position <= 10 ? "default" : "secondary"}>
                          #{history.position}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Metric History Section */}
          {metricHistory && metricHistory.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Metric Updates</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Recent metrics that affect ranking scores
              </p>
              <div className="space-y-4">
                {metricHistory.map((history, index) => {
                  const newsItem: NewsItem = {
                    id: `${tool.id}-metric-${index}`,
                    tool_id: tool.id,
                    tool_name: tool.name,
                    tool_category: tool.category,
                    tool_website: tool.info?.links?.website,
                    event_date: history.published_date,
                    event_type: "update",
                    title: `${history.source_name} Update`,
                    description: `New metrics reported for ${tool.name}`,
                    source_url: history.source_url || undefined,
                    source_name: history.source_name || undefined,
                    metrics: {
                      users: history.scoring_metrics?.["users"] as number | undefined,
                      revenue: history.scoring_metrics?.["monthly_arr"] as number | undefined,
                    },
                  };

                  return <NewsCard key={index} item={newsItem} showToolLink={false} />;
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!newsItems || newsItems.length === 0) &&
            (!rankingsHistory || rankingsHistory.length === 0) &&
            (!metricHistory || metricHistory.length === 0) && (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    No history available for this tool.
                  </p>
                </CardContent>
              </Card>
            )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
