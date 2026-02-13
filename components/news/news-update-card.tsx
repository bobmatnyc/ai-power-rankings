"use client";

import { ArrowRight, Newspaper } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  published_at: string;
  source?: string;
  source_url?: string;
  tool_mentions?: string[];
  tags?: string[];
}

interface NewsUpdateCardProps {
  lang: string;
  limit?: number;
}

/**
 * Format relative time for news articles
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

/**
 * News Update Card component for the homepage.
 * Shows 3-5 recent news headlines with source and relative time.
 */
export const NewsUpdateCard = memo(function NewsUpdateCard({
  lang,
  limit = 5
}: NewsUpdateCardProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = useCallback(async () => {
    try {
      const response = await fetch(`/api/news/recent?limit=${limit}&days=14`);
      if (response.ok) {
        const data = await response.json();
        setNews(data.news || []);
      }
    } catch (error) {
      console.error("Failed to fetch recent news:", error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // Defer news fetch slightly to prioritize rankings
    const timer = setTimeout(() => {
      fetchNews();
    }, 500);

    return () => clearTimeout(timer);
  }, [fetchNews]);

  // Don't render if no news available
  if (!loading && news.length === 0) {
    return null;
  }

  return (
    <Card className="mb-8 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            <span>Latest AI News</span>
          </CardTitle>
          <Link
            href={`/${lang}/news`}
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            View All
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-full mb-1.5" />
                <div className="h-3 bg-muted/60 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <ul className="space-y-3">
            {news.map((article) => (
              <li key={article.id} className="group">
                <Link
                  href={`/${lang}/news/${article.slug}`}
                  className="block hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-md transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground text-sm mt-0.5 flex-shrink-0">
                      &bull;
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {article.source && (
                          <>
                            <span className="truncate max-w-[120px]">{article.source}</span>
                            <span>&middot;</span>
                          </>
                        )}
                        <span className="flex-shrink-0">
                          {formatRelativeTime(article.published_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
});

NewsUpdateCard.displayName = "NewsUpdateCard";
