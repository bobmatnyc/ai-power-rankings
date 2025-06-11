"use client";

import { useEffect, useState, useRef } from "react";
import { loggers } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToolIcon } from "@/components/ui/tool-icon";
import Link from "next/link";
import {
  Award,
  Sparkles,
  GitBranch,
  Zap,
  AlertCircle,
  Clock,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface MetricsHistory {
  id: string;
  tool_id: string;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initial data fetch
  useEffect(() => {
    fetchNews(1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up intersection observer for infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loadingMore) {
          fetchNews(page + 1, false);
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
  }, [page, hasMore, loadingMore]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNews = async (pageNum: number, isInitial: boolean): Promise<void> => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const itemsPerPage = 20;
      const offset = (pageNum - 1) * itemsPerPage;

      // Fetch from API
      const response = await fetch(
        `/api/news?limit=${itemsPerPage}&offset=${offset}&filter=${filter}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch news");
      }

      const data = await response.json();
      const newsData: MetricsHistory[] = data.news || [];

      if (isInitial) {
        setNewsItems(newsData);
      } else {
        setNewsItems((prev) => [...prev, ...newsData]);
      }

      setPage(pageNum);
      setHasMore(data.hasMore || false);
      setLoading(false);
      setLoadingMore(false);
    } catch (error) {
      loggers.news.error("Failed to fetch news", { error, pageNum, isInitial });
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const getEventIcon = (eventType: string): React.JSX.Element => {
    switch (eventType) {
      case "milestone":
        return <Award className="h-4 w-4" />;
      case "feature":
        return <Sparkles className="h-4 w-4" />;
      case "partnership":
        return <GitBranch className="h-4 w-4" />;
      case "update":
        return <Zap className="h-4 w-4" />;
      case "announcement":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

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
  useEffect(() => {
    setNewsItems([]);
    setPage(1);
    setHasMore(true);
    fetchNews(1, true);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredNews =
    filter === "all" ? newsItems : newsItems.filter((item) => item.event_type === filter);

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
        <h1 className="text-4xl font-bold mb-2">{dict.news.title}</h1>
        <p className="text-muted-foreground text-lg">{dict.news.subtitle}</p>
      </div>

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
        {filteredNews.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">{dict.news.noItems}</p>
          </Card>
        ) : (
          filteredNews.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <ToolIcon
                      name={item.tool_name}
                      domain={item.tool_website}
                      size={40}
                      className="flex-shrink-0 mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getEventColor(item.event_type)}>
                          {getEventIcon(item.event_type)}
                          <span className="ml-1">{item.event_type}</span>
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(item.event_date)}
                        </span>
                      </div>
                      <CardTitle className="text-lg mb-1">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
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
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}

                  {/* View Tool Link */}
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/${lang}/tools/${item.tool_id}`}>
                        {dict.news.viewTool || "View Tool"}
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Infinite scroll trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
          {loadingMore && <div className="text-muted-foreground">{dict.news.loadingMore}</div>}
        </div>
      )}

      {!hasMore && filteredNews.length > 0 && (
        <div className="text-center py-8 text-muted-foreground">{dict.news.noMore}</div>
      )}
    </div>
  );
}
