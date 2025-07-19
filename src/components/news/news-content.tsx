"use client";

import {
  ArrowRight,
  DollarSign,
  ExternalLink,
  FileText,
  GitBranch,
  Globe,
  Newspaper,
  Rss,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToolIcon } from "@/components/ui/tool-icon";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import { loggers } from "@/lib/logger";
import ArticleScoringImpact from "./article-scoring-impact";
import ScoringMetrics from "./scoring-metrics";

interface MetricsHistory {
  id: string;
  slug: string;
  tool_id: string;
  tool_slug?: string;
  tool_name: string;
  tool_category: string;
  tool_website: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string;
  source_url?: string;
  source_name?: string;
  metrics?: {
    users?: number;
    revenue?: number;
    score_change?: number;
    rank_change?: number;
    importance_score?: number;
  };
  scoring_factors?: {
    agentic_capability?: number;
    innovation?: number;
    technical_performance?: number;
    developer_adoption?: number;
    market_traction?: number;
    business_sentiment?: number;
    development_velocity?: number;
    platform_resilience?: number;
  };
  tags?: string[];
}

interface NewsContentProps {
  lang: Locale;
  dict: Dictionary;
}

export default function NewsContent({ lang, dict }: NewsContentProps): React.JSX.Element {
  const [newsItems, setNewsItems] = useState<MetricsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchNews = useCallback(async (_pageNum: number, isInitial: boolean): Promise<void> => {
    try {
      // Only fetch on initial load
      if (!isInitial) {
        return;
      }

      setLoading(true);

      // Fetch ALL news from API at once
      const response = await fetch("/api/news?limit=100");

      if (!response.ok) {
        throw new Error("Failed to fetch news");
      }

      const data = await response.json();
      const allNews: MetricsHistory[] = data.news || [];

      // Store all news for client-side filtering
      setNewsItems(allNews);
      setLoading(false);
    } catch (error) {
      loggers.news.error("Failed to fetch news", { error });
      setLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchNews(1, true);
  }, [fetchNews]);

  // Calculate totalPages early for use in effects
  const filteredItemsCount =
    filter === "all"
      ? newsItems.length
      : newsItems.filter((item) => item.event_type === filter).length;
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredItemsCount / itemsPerPage);

  // Set up intersection observer for infinite scroll (client-side)
  useEffect(() => {
    if (!loadMoreRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting && page < totalPages && !loading) {
          setPage(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [page, totalPages, loading]);

  const getEventColor = (eventType: string): string => {
    switch (eventType) {
      case "milestone":
        return "bg-primary/10 text-primary border-primary/20";
      case "feature":
        return "bg-secondary/10 text-secondary border-secondary/20";
      case "partnership":
        return "bg-accent/10 text-accent border-accent/20";
      case "update":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "announcement":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getSourceIcon = (sourceName: string): React.JSX.Element => {
    const source = sourceName?.toLowerCase() || "";
    if (source.includes("github") || source.includes("git")) {
      return <GitBranch className="h-4 w-4" />;
    } else if (
      source.includes("news") ||
      source.includes("techcrunch") ||
      source.includes("verge")
    ) {
      return <Newspaper className="h-4 w-4" />;
    } else if (source.includes("blog") || source.includes("medium")) {
      return <FileText className="h-4 w-4" />;
    } else if (source.includes("twitter") || source.includes("x.com")) {
      return <Globe className="h-4 w-4" />;
    }
    return <ExternalLink className="h-4 w-4" />;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 24) {
      if (diffHours === 0) {
        return dict.news.time?.justNow || "Just now";
      }
      const hoursText =
        diffHours === 1
          ? dict.news.time?.hourAgo || "hour ago"
          : dict.news.time?.hoursAgo || "{count} hours ago";
      return hoursText.replace("{count}", diffHours.toString());
    } else if (diffDays < 7) {
      const daysText =
        diffDays === 1
          ? dict.news.time?.dayAgo || "day ago"
          : dict.news.time?.daysAgo || "{count} days ago";
      return daysText.replace("{count}", diffDays.toString());
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  // Reset pagination when filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter is intentionally used to reset pagination
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // Client-side filtering
  const filteredNews =
    filter === "all" ? newsItems : newsItems.filter((item) => item.event_type === filter);

  // Client-side pagination
  const startIndex = (page - 1) * itemsPerPage;
  const paginatedNews = filteredNews.slice(startIndex, startIndex + itemsPerPage);

  const eventTypes = ["all", "milestone", "feature", "partnership", "update", "announcement"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">{dict.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{dict.news.title}</h1>
            <p className="text-muted-foreground text-lg">{dict.news.subtitle}</p>
          </div>
          <Link
            href={`/${lang}/news/rss.xml`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            title="RSS Feed"
          >
            <Rss className="h-5 w-5" />
            <span className="text-sm hidden sm:inline">RSS Feed</span>
          </Link>
        </div>
      </div>

      {/* Scoring Metrics */}
      <ScoringMetrics />

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {eventTypes.map((type) => (
          <Button
            key={type}
            variant={filter === type ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(type)}
            className="capitalize"
          >
            {type === "all"
              ? dict.news.filters.all
              : dict.news.filters[type as keyof typeof dict.news.filters] || type.replace("-", " ")}
          </Button>
        ))}
      </div>

      {/* News List */}
      <div className="space-y-2 md:space-y-4">
        {paginatedNews.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{dict.news.noItems}</p>
          </Card>
        ) : (
          paginatedNews.map((item) => (
            <Link key={item.id} href={`/${lang}/news/${item.slug}`} className="block">
              <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex flex-col gap-2">
                        {/* Tool Icon */}
                        <ToolIcon
                          name={item.tool_name}
                          domain={item.tool_website}
                          size={40}
                          className="flex-shrink-0"
                          context="news"
                        />
                        {/* Source Icon */}
                        {item.source_name && (
                          <div className="flex items-center justify-center w-6 h-6 rounded bg-muted/50">
                            {getSourceIcon(item.source_name)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={getEventColor(item.event_type)}>
                            <span>{item.event_type}</span>
                          </Badge>
                          {item.source_name && (
                            <Badge variant="outline" className="text-xs">
                              {getSourceIcon(item.source_name)}
                              <span className="ml-1">{item.source_name}</span>
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {formatDate(item.event_date)}
                          </span>
                        </div>
                        <CardTitle className="text-lg mb-1 hover:text-primary transition-colors">
                          {item.title}
                        </CardTitle>
                        <CardDescription>{item.description}</CardDescription>

                        {/* Tool mentions after summary */}
                        {item.tool_name && item.tool_name !== "Various Tools" && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">Related to:</span>
                            <Badge variant="secondary" className="text-xs">
                              <ToolIcon
                                name={item.tool_name}
                                domain={item.tool_website}
                                size={12}
                                className="mr-1"
                                context="news"
                              />
                              {item.tool_name}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Metrics */}
                    {item.metrics && (
                      <div className="flex flex-wrap gap-3 text-sm">
                        {item.metrics.users && (
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>
                              {(item.metrics.users / 1000).toFixed(0)}K{" "}
                              {dict.news.metrics?.users || "users"}
                            </span>
                          </div>
                        )}
                        {item.metrics.revenue && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span>${(item.metrics.revenue / 1000000).toFixed(0)}M</span>
                          </div>
                        )}
                        {item.metrics.score_change && (
                          <div className="flex items-center gap-1">
                            {item.metrics.score_change > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={
                                item.metrics.score_change > 0 ? "text-green-500" : "text-red-500"
                              }
                            >
                              {item.metrics.score_change > 0 ? "+" : ""}
                              {item.metrics.score_change.toFixed(1)}{" "}
                              {dict.news.metrics?.score || "score"}
                            </span>
                          </div>
                        )}
                        {item.metrics.rank_change && (
                          <div className="flex items-center gap-1">
                            {item.metrics.rank_change > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                            <span
                              className={
                                item.metrics.rank_change > 0 ? "text-green-500" : "text-red-500"
                              }
                            >
                              {item.metrics.rank_change > 0 ? "+" : ""}
                              {item.metrics.rank_change} {dict.news.metrics?.rank || "rank"}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {item.tags && item.tags.length > 0 && (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="flex gap-2">
                          {item.tags
                            .slice(0, 3)
                            .map((tag) => {
                              // Format tag display name
                              let displayName = tag;

                              // Skip if tag is just a number, UUID, or empty
                              if (
                                /^\d+$/.test(tag) ||
                                /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
                                  tag
                                ) ||
                                !tag.trim()
                              ) {
                                return null;
                              }

                              // Handle category names
                              if (
                                tag === "product" ||
                                tag === "autonomous-agent" ||
                                tag === "ide-assistant" ||
                                tag === "code-completion" ||
                                tag === "testing" ||
                                tag === "documentation" ||
                                tag === "code-review" ||
                                tag === "security" ||
                                tag === "cloud-ide" ||
                                tag === "collaboration" ||
                                tag === "ai-chat"
                              ) {
                                displayName = tag
                                  .replace(/-/g, " ")
                                  .replace(/\b\w/g, (l) => l.toUpperCase());
                              }

                              return (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {displayName}
                                </Badge>
                              );
                            })
                            .filter(Boolean)}
                        </div>
                      </>
                    )}

                    {/* View Tool Link - only show if there's a valid tool slug */}
                    {item.tool_slug && (
                      <div className="ml-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link href={`/${lang}/tools/${item.tool_slug}`}>
                            {dict.news.viewTool || "View Tool"}
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Article Scoring Impact */}
                  <div className="mt-4">
                    <ArticleScoringImpact
                      scoring_factors={item.scoring_factors}
                      importance_score={item.metrics?.importance_score}
                      event_type={item.event_type}
                      compact={true}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Infinite scroll trigger */}
      {page < totalPages && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          <div className="text-muted-foreground">{dict.common.loading}</div>
        </div>
      )}

      {page >= totalPages && filteredNews.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">{dict.news.noMore}</div>
      )}
    </div>
  );
}
