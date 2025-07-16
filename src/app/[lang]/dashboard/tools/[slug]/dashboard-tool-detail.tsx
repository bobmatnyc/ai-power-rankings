"use client";

import { ArrowLeft, ExternalLink, Github, Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { Dictionary } from "@/i18n/get-dictionary";

interface ToolDetailData {
  tool: {
    id: string;
    name: string;
    category: string;
    status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
    website_url?: string;
    tagline?: string;
    info?: {
      technical?: Record<string, unknown>;
      business?: Record<string, unknown>;
      company?: Record<string, unknown>;
      product?: {
        tagline?: string;
      };
      links?: Record<string, string>;
      website?: string;
      summary?: string;
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
  rankingsHistory?: RankingHistoryEntry[];
  newsItems?: NewsItem[];
  metrics?: Record<string, number | string>;
}

interface RankingHistoryEntry {
  period: string;
  position: number;
  score: number;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  published_at: string;
  url?: string;
  category?: string;
}

interface DashboardToolDetailProps {
  slug: string;
  lang: string;
  dict: Dictionary;
}

export function DashboardToolDetail({ slug, lang, dict }: DashboardToolDetailProps) {
  const [tool, setTool] = useState<ToolDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchToolDetails() {
      try {
        const response = await fetch(`/api/tools/${slug}/json`);
        if (!response.ok) {
          throw new Error("Failed to fetch tool details");
        }

        const data = await response.json();
        setTool(data);
      } catch (err) {
        console.error("Error fetching tool:", err);
        setError("Failed to load tool details");
      } finally {
        setLoading(false);
      }
    }

    fetchToolDetails();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">{dict.common.loading}</div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="text-destructive">{error || "Tool not found"}</div>
        <Button asChild variant="outline">
          <Link href={`/${lang}/dashboard/rankings`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rankings
          </Link>
        </Button>
      </div>
    );
  }

  const toolData = tool.tool;
  const ranking = tool.ranking;
  const rankingsHistory = tool.rankingsHistory || [];
  const newsItems = tool.newsItems || [];
  const metrics = tool.metrics || {};

  // Extract all data
  const info = toolData.info || {};
  const technical = info.technical || {};
  const business = info.business || {};
  const company = info.company || {};
  const product = info.product || {};
  const links = info.links || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${lang}/dashboard`} className="hover:text-foreground">
          Dashboard
        </Link>
        <span>/</span>
        <Link href={`/${lang}/dashboard/rankings`} className="hover:text-foreground">
          Rankings
        </Link>
        <span>/</span>
        <span>{toolData.name}</span>
      </div>

      {/* Tool Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <ToolIcon
              name={toolData.name}
              domain={links["website"] || toolData.website_url || info["website"]}
              size={80}
              className="flex-shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-3xl mb-2">{toolData.name}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge className="capitalize">{toolData.category.replace(/-/g, " ")}</Badge>
                    <StatusIndicator status={toolData.status} showLabel />
                    {ranking && (
                      <Badge variant="outline" className="font-bold">
                        Rank #{ranking.rank}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-base">
                    {product.tagline || toolData.tagline || info.summary}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {links["website"] && (
                    <Button asChild variant="outline" size="sm">
                      <a href={links["website"]} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Website
                      </a>
                    </Button>
                  )}
                  {links["github"] && (
                    <Button asChild variant="outline" size="sm">
                      <a href={links["github"]} target="_blank" rel="noopener noreferrer">
                        <Github className="h-4 w-4 mr-2" />
                        GitHub
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="scores" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scores">Ranking Scores</TabsTrigger>
          <TabsTrigger value="technical">Technical Details</TabsTrigger>
          <TabsTrigger value="business">Business Info</TabsTrigger>
          <TabsTrigger value="history">Ranking History</TabsTrigger>
          <TabsTrigger value="news">News & Updates</TabsTrigger>
        </TabsList>

        {/* Ranking Scores Tab */}
        <TabsContent value="scores" className="space-y-4">
          {ranking ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Current Ranking Details</CardTitle>
                  <CardDescription>
                    Algorithm Version: v6-news | Overall Score: {ranking.scores.overall.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Agentic Capability</div>
                        <div className="text-2xl font-bold text-primary">
                          {ranking.scores.agentic_capability.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">Core autonomy score</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Innovation</div>
                        <div className="text-2xl font-bold text-secondary">
                          {ranking.scores.innovation.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">Technical advancement</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Performance</div>
                        <div className="text-2xl font-bold text-accent">
                          {ranking.scores.technical_performance.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">Speed & efficiency</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Adoption</div>
                        <div className="text-2xl font-bold text-foreground">
                          {ranking.scores.developer_adoption.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">Developer usage</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Market Traction</div>
                        <div className="text-2xl font-bold">
                          {ranking.scores.market_traction.toFixed(1)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Business Sentiment</div>
                        <div className="text-2xl font-bold">
                          {ranking.scores.business_sentiment.toFixed(1)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Dev Velocity</div>
                        <div className="text-2xl font-bold">
                          {ranking.scores.development_velocity.toFixed(1)}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Platform Resilience</div>
                        <div className="text-2xl font-bold">
                          {ranking.scores.platform_resilience.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking Algorithm Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Score Calculation</h4>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                      Overall Score = (Base Category Score × 0.5) + (News Impact Score × 0.5) +
                      Random Variation (±0.25)
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">News Impact Factors</h4>
                    <ul className="space-y-2 text-sm">
                      <li>• Recent Activity Bonus: 3-month news count × 10</li>
                      <li>• Funding News: Each funding article × 30 points</li>
                      <li>• Product Launches: Each launch article × 20 points</li>
                      <li>• Volume Bonus: log(total news + 1) × 15</li>
                      <li>• Momentum Bonus: min(3-month news × 20, 100)</li>
                      <li>• Recency Decay: 1 / (1 + (avgDaysOld / 90)^1.5)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Category Base Scores</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div>Autonomous Agent: 75</div>
                      <div>AI Assistant: 70</div>
                      <div>IDE Assistant: 65</div>
                      <div>Code Editor: 60</div>
                      <div>Open Source: 55</div>
                      <div>App Builder: 50</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8 text-muted-foreground">
                No ranking data available for this tool
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Technical Details Tab */}
        <TabsContent value="technical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Technical Specifications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Context & Language Support</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Context Window</div>
                    <div className="font-medium">
                      {technical["context_window"]
                        ? `${technical["context_window"].toLocaleString()} tokens`
                        : "Not specified"}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Multi-file Support</div>
                    <div className="font-medium">
                      {technical["multi_file_support"] ? "Yes" : "No"}
                    </div>
                  </div>
                </div>
                {Array.isArray(technical["supported_languages"]) &&
                  technical["supported_languages"].length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm text-muted-foreground mb-2">Supported Languages</div>
                      <div className="flex flex-wrap gap-2">
                        {(technical["supported_languages"] as string[]).map((lang: string) => (
                          <Badge key={lang} variant="secondary">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {Array.isArray(technical["llm_providers"]) &&
                technical["llm_providers"].length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">LLM Providers</h4>
                    <div className="flex flex-wrap gap-2">
                      {(technical["llm_providers"] as string[]).map((provider: string) => (
                        <Badge key={provider} variant="outline">
                          {provider}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

              {Array.isArray(technical["integrations"]) && technical["integrations"].length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Integrations</h4>
                  <div className="flex flex-wrap gap-2">
                    {(technical["integrations"] as string[]).map((integration: string) => (
                      <Badge key={integration} variant="outline">
                        {integration}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-3">Performance Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {metrics["swe_bench_score"] && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">SWE-bench Score</div>
                      <div className="font-medium text-lg">{metrics["swe_bench_score"]}%</div>
                    </div>
                  )}
                  {metrics["github_stars"] && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">GitHub Stars</div>
                      <div className="font-medium text-lg">
                        {Number(metrics["github_stars"]).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {technical["response_time"] && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Avg Response Time</div>
                      <div className="font-medium text-lg">{technical["response_time"]}ms</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Info Tab */}
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.name && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Company</div>
                    <div className="font-medium">{company.name}</div>
                  </div>
                )}
                {company.founded && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Founded</div>
                    <div className="font-medium">{company.founded}</div>
                  </div>
                )}
                {company.headquarters && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Headquarters</div>
                    <div className="font-medium">{company.headquarters}</div>
                  </div>
                )}
                {metrics.employees && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Employees</div>
                    <div className="font-medium">{metrics.employees.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {metrics.valuation && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Valuation</div>
                    <div className="font-medium text-lg">
                      ${(metrics.valuation / 1000000000).toFixed(1)}B
                    </div>
                  </div>
                )}
                {metrics.funding && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Total Funding</div>
                    <div className="font-medium text-lg">
                      ${(metrics.funding / 1000000).toFixed(0)}M
                    </div>
                  </div>
                )}
                {metrics.monthly_arr && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Monthly ARR</div>
                    <div className="font-medium text-lg">
                      ${(metrics.monthly_arr / 1000000).toFixed(1)}M
                    </div>
                  </div>
                )}
                {metrics.users && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Estimated Users</div>
                    <div className="font-medium text-lg">{metrics.users.toLocaleString()}</div>
                  </div>
                )}
                {business.pricing_model && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Pricing Model</div>
                    <div className="font-medium">{business.pricing_model}</div>
                  </div>
                )}
                {business.license_type && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">License</div>
                    <div className="font-medium">{business.license_type}</div>
                  </div>
                )}
              </div>

              {business.pricing_details && (
                <div>
                  <h4 className="font-medium mb-3">Pricing Plans</h4>
                  <div className="space-y-2">
                    {Object.entries(business.pricing_details).map(([plan, details]) => (
                      <div
                        key={plan}
                        className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="font-medium">{plan}</div>
                        <div className="text-sm text-muted-foreground">{String(details)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ranking History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ranking History</CardTitle>
              <CardDescription>Position and score changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              {rankingsHistory.length > 0 ? (
                <div className="space-y-2">
                  {rankingsHistory.map((entry: RankingHistoryEntry, index: number) => {
                    const prevEntry = rankingsHistory[index + 1];
                    const positionChange = prevEntry ? prevEntry.position - entry.position : 0;

                    return (
                      <div
                        key={entry.period}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-lg font-bold">#{entry.position}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(entry.period).toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">Score: {entry.score.toFixed(1)}</div>
                          </div>
                        </div>
                        <div>
                          {positionChange !== 0 && (
                            <Badge
                              className={
                                positionChange > 0
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }
                            >
                              {positionChange > 0 ? (
                                <>
                                  <TrendingUp className="h-3 w-3 mr-1" />+{positionChange}
                                </>
                              ) : (
                                <>
                                  <TrendingDown className="h-3 w-3 mr-1" />
                                  {Math.abs(positionChange)}
                                </>
                              )}
                            </Badge>
                          )}
                          {positionChange === 0 && index > 0 && (
                            <Badge variant="secondary">
                              <Minus className="h-3 w-3 mr-1" />
                              Same
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No ranking history available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent News & Updates</CardTitle>
              <CardDescription>Latest mentions and articles about {toolData.name}</CardDescription>
            </CardHeader>
            <CardContent>
              {newsItems.length > 0 ? (
                <div className="space-y-3">
                  {newsItems.map((item: NewsItem) => (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium mb-1">
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                {item.title}
                              </a>
                            ) : (
                              item.title
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground mb-2">{item.summary}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{item.source}</span>
                            <span>{new Date(item.published_at).toLocaleDateString()}</span>
                            {item.category && (
                              <Badge variant="secondary" className="text-xs">
                                {item.category}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent news available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
