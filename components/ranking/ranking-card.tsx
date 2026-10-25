"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RankingChange } from "@/components/ui/ranking-change";
import { ToolIcon } from "@/components/ui/tool-icon";
import { trackEvent } from "@/lib/analytics/track";
import { getCategoryColor } from "@/lib/category-colors";
import { CategoryIcon } from "@/lib/category-icons";
import { calculateTier, getTierColor } from "@/lib/ranking-utils";
import { extractTextFromRichText, type RichTextBlock } from "@/lib/richtext-utils";

interface RankingData {
  rank: number;
  /** #186: the tier within the row's list (D53); absent rows use the rank tiers. */
  tier?: string;
  previousRank?: number;
  rankChange?: number;
  changeReason?: string;
  tool: {
    id: string;
    slug?: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
    logo?: string;  // Local PNG path (preferred over favicon API)
    description?: string | RichTextBlock[]; // Can be string or RichText array
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
  };
  trend?: "up" | "down" | "stable";
  trendChange?: number;
}

interface RankingCardProps {
  ranking: RankingData;
  showDetails?: boolean;
  lang?: string;
  // #175: which list the row sits in, sent as `list_name` on ranking_row_click.
  listName?: string;
}

export function RankingCard({
  ranking,
  showDetails = true,
  lang = "en",
  listName = "rankings",
}: RankingCardProps): React.JSX.Element {
  const router = useRouter();
  // #186: a list row carries its D53 tier (S/A/B by thirds on a short list).
  const tier = ranking.tier && /^[SABCD]$/.test(ranking.tier) ? ranking.tier : calculateTier(ranking.rank);
  const toolSlug = ranking.tool.slug || ranking.tool.id;

  const getMedal = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🏆";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
  };

  return (
    <Link
      href={`/${lang}/tools/${toolSlug}`}
      className="block h-full"
      // #175: the category badge below stops propagation, so only row clicks land here.
      onClick={() =>
        trackEvent("ranking_row_click", {
          tool_slug: toolSlug,
          rank: ranking.rank,
          list_name: listName,
          tool_category: ranking.tool.category,
        })
      }
    >
      <Card className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/20 h-full flex flex-col cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <ToolIcon
                name={ranking.tool.name}
                domain={ranking.tool.website_url || ranking.tool.logo}
                size={48}
                className="flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {ranking.tool.name}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground truncate">
                  {ranking.tool.category
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <span className="text-xs mr-1">{getMedal(ranking.rank)}</span>#{ranking.rank}
              </Badge>
              <Badge className={`${getTierColor(tier)} font-bold px-2 py-0.5`}>{tier}</Badge>
              <RankingChange
                previousRank={ranking.previousRank}
                currentRank={ranking.rank}
                changeReason={ranking.changeReason}
                size="sm"
                showIcon={true}
              />
            </div>
          </div>
        </CardHeader>

        {showDetails && (
          <CardContent className="pt-0 flex-1 flex flex-col">
            <div className="flex-1 flex flex-col">
              {/* Description if available */}
              {ranking.tool.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                  {extractTextFromRichText(ranking.tool.description)}
                </p>
              )}

              {/* Top section - Badges */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge
                  className={`${getCategoryColor(ranking.tool.category)} cursor-pointer hover:opacity-80 flex items-center gap-1.5`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // #175: the badge applies a category filter on /tools.
                    trackEvent("filter_use", {
                      filter_name: "category",
                      filter_value: ranking.tool.category,
                      page_type: "rankings",
                    });
                    router.push(`/${lang}/tools?category=${ranking.tool.category}`);
                  }}
                >
                  <CategoryIcon category={ranking.tool.category} size={14} />
                  <span>{ranking.tool.category.replace(/-/g, " ")}</span>
                </Badge>
                {ranking.scores?.overall && (
                  <Badge variant="outline">Score: {ranking.scores.overall.toFixed(1)}</Badge>
                )}
                {ranking.metrics?.swe_bench_score ? (
                  <Badge variant="outline">
                    SWE-bench: {ranking.metrics.swe_bench_score.toFixed(1)}%
                  </Badge>
                ) : null}
              </div>

              {/* Spacer to push bottom content down */}
              <div className="flex-1" />

              {/* Bottom section - Metrics */}
              <div className="pt-3 border-t border-border/50">
                <div className="flex flex-col space-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-primary rounded-full"></span>
                    <span>Agentic: {ranking.scores?.agentic_capability?.toFixed(1) || "-"}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-secondary rounded-full"></span>
                    <span>Innovation: {ranking.scores?.innovation?.toFixed(1) || "-"}</span>
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}
