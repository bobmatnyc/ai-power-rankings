import { DollarSign, ExternalLink, TrendingDown, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ToolIcon } from "@/components/ui/tool-icon";

export interface NewsItem {
  id: string;
  tool_id: string;
  tool_name: string;
  tool_category: string;
  tool_website?: string;
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

interface NewsCardProps {
  item: NewsItem;
  showToolLink?: boolean;
}

export function NewsCard({ item }: NewsCardProps) {
  const getEventColor = (eventType: string) => {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Date unavailable";
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 24) {
      if (diffHours === 0) {
        return "Just now";
      }
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <Link
              href={`/tools/${item.tool_id}`}
              className="flex-shrink-0 mt-1 hover:opacity-80 transition-opacity"
            >
              <ToolIcon name={item.tool_name} domain={item.tool_website} size={40} context="news" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={getEventColor(item.event_type)}>
                  <span>{item.event_type}</span>
                </Badge>
                <span className="text-sm text-muted-foreground">{formatDate(item.event_date)}</span>
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
                  <span>{(item.metrics.users / 1000).toFixed(0)}K users</span>
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
                    className={item.metrics.score_change > 0 ? "text-green-500" : "text-red-500"}
                  >
                    {item.metrics.score_change > 0 ? "+" : ""}
                    {item.metrics.score_change.toFixed(1)} score
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
                    className={item.metrics.rank_change > 0 ? "text-green-500" : "text-red-500"}
                  >
                    {item.metrics.rank_change > 0 ? "+" : ""}
                    {item.metrics.rank_change} rank
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

          {/* Action Links */}
          <div className="ml-auto">
            {item.source_url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                  View Source
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
