import Link from "next/link";
import { loggers } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolIcon } from "@/components/ui/tool-icon";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ToolDetailTabs } from "@/components/tools/tool-detail-tabs";
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
  pricingPlans?: Array<{
    id: string;
    tool_id: string;
    plan_name: string;
    price_monthly?: number;
    price_annually?: number;
    currency: string;
    billing_cycle: string;
    features?: string[];
    limits?: Record<string, any>;
    is_primary: boolean;
    is_active: boolean;
  }>;
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
    const isDev = process.env["NODE_ENV"] === "development";
    const baseUrl = isDev
      ? "http://localhost:3001"
      : process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/tools/${slug}`, {
      next: { revalidate: isDev ? 0 : 3600 }, // No cache in dev, 1 hour in prod
    });
    if (response.ok) {
      toolData = await response.json();
    }
  } catch (error) {
    loggers.tools.error("Failed to fetch tool details", { slug, error });
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

  const { tool, ranking, metrics, metricHistory, rankingsHistory, newsItems, pricingPlans } =
    toolData;

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
                {pricingPlans && pricingPlans.length > 0 ? (
                  <>
                    {pricingPlans.find((p) => p.is_primary)?.price_monthly === 0
                      ? "Free"
                      : `From $${pricingPlans.find((p) => p.is_primary)?.price_monthly || pricingPlans[0]?.price_monthly}/mo`}
                  </>
                ) : (
                  tool.info?.product?.pricing_model || dict.common.notAvailable
                )}
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
      <ToolDetailTabs
        tool={tool}
        ranking={ranking}
        metrics={metrics}
        metricHistory={metricHistory}
        rankingsHistory={rankingsHistory}
        newsItems={newsItems}
        pricingPlans={pricingPlans}
        dict={dict}
      />

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
