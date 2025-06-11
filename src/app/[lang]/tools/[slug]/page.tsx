import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ToolIcon } from "@/components/ui/tool-icon";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { NewsCard, type NewsItem } from "@/components/news/news-card";
import { MetricHistory } from "@/types/database";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface ToolDetail {
  tool: {
    id: string;
    name: string;
    category: string;
    status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
    info: {
      company: {
        name: string;
        website?: string;
        founded_date?: string;
        headquarters?: string;
      };
      product: {
        tagline?: string;
        description?: string;
        pricing_model?: string;
        license_type?: string;
      };
      links: {
        website?: string;
        github?: string;
        documentation?: string;
        pricing?: string;
        blog?: string;
      };
      tags?: string[];
      features?: {
        key_features?: string[];
        languages_supported?: string[];
        ide_support?: string[];
        llm_providers?: string[];
      };
      metadata?: {
        logo_url?: string;
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
}

interface PageProps {
  params: Promise<{ lang: Locale; slug: string }>;
}

export default async function ToolDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);

  // Fetch tool data on the server
  let toolData: ToolDetail | null = null;
  let loading = false;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/tools/${slug}`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (response.ok) {
      toolData = await response.json();
    }
  } catch (error) {
    console.error("Failed to fetch tool details:", error);
    loading = true;
  }

  const formatMetric = (value: number | undefined, type: string): string => {
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

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">{dict.common.loading}</p>
        </div>
      </div>
    );
  }

  if (!toolData) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground mb-4">{dict.tools.notFound}</p>
          <Button asChild>
            <Link href={`/${lang}/tools`}>{dict.tools.backToTools}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { tool, ranking, metrics, metricHistory } = toolData;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href={`/${lang}/tools`} className="hover:text-foreground">
            {dict.navigation.tools}
          </Link>
          <span>/</span>
          <span>{tool.name}</span>
        </div>

        {/* Category Badge - Centered on mobile */}
        <div className="mb-4 md:hidden flex justify-center">
          <Badge className="capitalize px-4 py-1 text-xs">{tool.category.replace(/-/g, " ")}</Badge>
        </div>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <ToolIcon
              name={tool.name}
              domain={tool.info?.links?.website}
              size={64}
              className="flex-shrink-0 mt-1"
            />
            <div>
              <h1 className="text-2xl md:text-4xl font-bold mb-2">{tool.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="capitalize hidden md:inline-flex">
                  {tool.category.replace(/-/g, " ")}
                </Badge>
                <StatusIndicator status={tool.status} showLabel />
                {ranking && <Badge variant="outline">Rank #{ranking.rank}</Badge>}
              </div>
            </div>
          </div>

          {/* Desktop buttons */}
          <div className="hidden md:flex gap-2">
            {tool.info?.links?.website && (
              <Button asChild>
                <a href={tool.info.links.website} target="_blank" rel="noopener noreferrer">
                  {dict.tools.detail.visitWebsite}
                </a>
              </Button>
            )}
            {tool.info?.links?.github && (
              <Button variant="outline" asChild>
                <a href={tool.info.links.github} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Overview Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{dict.tools.detail.overview}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-1">{dict.tools.detail.description}</h3>
            <p className="text-muted-foreground">
              {tool.info?.product?.description ||
                tool.info?.product?.tagline ||
                dict.tools.defaultDescription}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{dict.tools.detail.company}</p>
              <p className="font-medium">{tool.info?.company?.name || dict.common.notAvailable}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{dict.tools.detail.pricing}</p>
              <p className="font-medium">
                {tool.info?.product?.pricing_model || dict.common.notAvailable}
              </p>
            </div>
            {metrics?.users && (
              <div>
                <p className="text-sm text-muted-foreground">{dict.common.users}</p>
                <p className="font-medium">{formatMetric(metrics.users, "users")}</p>
              </div>
            )}
            {metrics?.github_stars && (
              <div>
                <p className="text-sm text-muted-foreground">{dict.tools.detail.githubStars}</p>
                <p className="font-medium">{formatMetric(metrics.github_stars, "number")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Information Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger value="performance" className="text-xs md:text-sm">
            {dict.tools.detail.tabs.performance}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="text-xs md:text-sm">
            {dict.tools.detail.tabs.business}
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
                        {dict.tools.detail.performance.sweBench}
                      </span>
                      <span className="text-sm font-medium">
                        {formatMetric(metrics.swe_bench_score, "percentage")}
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
                    <p className="font-medium">200k {dict.common.tokens}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Language Support</p>
                    <p className="font-medium">20+ languages</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Multi-file Support</p>
                    <p className="font-medium">Yes</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">LLM Providers</p>
                    <p className="font-medium">Multiple</p>
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
                      {formatMetric(metrics.monthly_arr, "currency")}
                    </p>
                  </div>
                )}
                {metrics?.valuation !== undefined && metrics.valuation > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valuation</p>
                    <p className="text-2xl font-bold">
                      {formatMetric(metrics.valuation, "currency")}
                    </p>
                  </div>
                )}
                {metrics?.funding !== undefined && metrics.funding > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Total Funding</p>
                    <p className="text-2xl font-bold">
                      {formatMetric(metrics.funding, "currency")}
                    </p>
                  </div>
                )}
                {metrics?.employees !== undefined && metrics.employees > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Employees</p>
                    <p className="text-2xl font-bold">
                      {formatMetric(metrics.employees, "number")}
                    </p>
                  </div>
                )}
                {metrics?.users !== undefined && metrics.users > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-2xl font-bold">{formatMetric(metrics.users, "users")}</p>
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
                    <span className="text-2xl font-bold">
                      {ranking.scores.overall.toFixed(2)}/10
                    </span>
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
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Metric History</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Recent metrics that affect ranking scores
              </p>
            </div>
            {metricHistory && metricHistory.length > 0 ? (
              <div className="space-y-4">
                {metricHistory.map((history, index) => {
                  // Convert MetricHistory to NewsItem format
                  const newsItem: NewsItem = {
                    id: `${tool.id}-${index}`,
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
                      // Add other metrics as needed
                    },
                  };

                  return <NewsCard key={index} item={newsItem} showToolLink={false} />;
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">
                    No metric history available for this tool.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Mobile Visit Site button - centered below content */}
      <div className="mt-8 flex flex-col items-center gap-3 md:hidden">
        {tool.info?.links?.website && (
          <Button asChild size="lg" className="w-full max-w-xs">
            <a href={tool.info.links.website} target="_blank" rel="noopener noreferrer">
              {dict.tools.detail.visitWebsite}
            </a>
          </Button>
        )}
        {tool.info?.links?.github && (
          <Button variant="outline" asChild size="lg" className="w-full max-w-xs">
            <a href={tool.info.links.github} target="_blank" rel="noopener noreferrer">
              {dict.tools.detail.viewGithub}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
