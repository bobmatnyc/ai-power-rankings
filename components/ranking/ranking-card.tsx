import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RankingChange } from "@/components/ui/ranking-change";
import { ToolIcon } from "@/components/ui/tool-icon";
import { getCategoryColor } from "@/lib/category-colors";
import { calculateTier, getTierColor } from "@/lib/ranking-utils";
import { extractTextFromRichText, type RichTextBlock } from "@/lib/richtext-utils";

interface RankingData {
  rank: number;
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
}

export function RankingCard({
  ranking,
  showDetails = true,
  lang = "en",
}: RankingCardProps): React.JSX.Element {
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
    <Link href={`/${lang}/tools/${ranking.tool.slug || ranking.tool.id}`} className="block h-full">
      <Card className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/20 h-full flex flex-col cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center space-x-3 min-w-0">
              <ToolIcon
                name={ranking.tool.name}
                domain={ranking.tool.website_url}
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
              <Badge
                className={`${getTierColor(calculateTier(ranking.rank))} font-bold px-2 py-0.5`}
              >
                {calculateTier(ranking.rank)}
              </Badge>
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
                <Badge className={getCategoryColor(ranking.tool.category)}>
                  {ranking.tool.category.replace(/-/g, " ")}
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
