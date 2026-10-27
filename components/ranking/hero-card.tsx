import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RankingChange } from "@/components/ui/ranking-change";
import { ToolIcon } from "@/components/ui/tool-icon";
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
}

interface HeroCardProps {
  ranking: RankingData;
  index: number;
  lang?: string;
}

export function HeroCard({ ranking, index, lang = "en" }: HeroCardProps) {
  const sweBench = ranking.metrics?.swe_bench_score;
  return (
    <Link href={`/${lang}/tools/${ranking.tool.slug || ranking.tool.id}`} className="block h-full">
      {/* #323: equal-height column card; #1 keeps a ring highlight but no scale, so heights and offsets match */}
      <Card
        className={`relative group flex h-full flex-col hover:shadow-xl transition-all duration-300 cursor-pointer ${
          index === 0 ? "border-primary/40 ring-1 ring-primary/30" : "border-border/50 hover:border-primary/20"
        }`}
      >
        {index === 0 && (
          // #323: the old gradient utility emitted no CSS (white text on the card edge); `.gradient-primary` is the globals.css class
          <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
            <Badge className="gradient-primary border-0 shadow-md text-primary-foreground">
              🏆 #1 Ranked
            </Badge>
          </div>
        )}

        <CardHeader className="pb-3">
          {/* #323: fixed-height row (logo height) with a one-line title, so logo/title/pill line up across cards */}
          <div className="flex h-16 items-center gap-3">
            <div className="flex-shrink-0">
              <ToolIcon name={ranking.tool.name} slug={ranking.tool.slug} logo={ranking.tool.logo} size={64} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-xl font-bold group-hover:text-primary transition-colors">
                {ranking.tool.name}
              </CardTitle>
              {/* #323: rank pill shares the category line, so the title gets the full width; m-0 drops the globals.css p margin */}
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 min-w-0 truncate text-sm text-muted-foreground">
                  {ranking.tool.category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    #{ranking.rank}
                  </Badge>
                  <RankingChange
                    previousRank={ranking.previousRank}
                    currentRank={ranking.rank}
                    changeReason={ranking.changeReason}
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          {/* #323: always three lines tall (text-sm leading-5), so short and long descriptions take the same space */}
          <p className="m-0 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
            {ranking.tool.description ? extractTextFromRichText(ranking.tool.description) : ""}
          </p>

          {/* #323: pinned to the card bottom; SWE-bench keeps its column with an em dash when missing */}
          <div className="mt-auto grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Score</span>
              <div className="font-semibold text-lg text-primary">
                {ranking.scores?.overall?.toFixed(1) || "—"}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">SWE-bench</span>
              <div className="font-semibold text-lg text-accent">
                {sweBench ? `${sweBench.toFixed(1)}%` : "—"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
