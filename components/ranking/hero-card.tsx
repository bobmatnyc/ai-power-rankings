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

        {/* #326: px-4 in the md-xl three-column layout gives the title and metrics 16px more width */}
        <CardHeader className="pb-3 md:px-4 xl:px-6">
          {/* #326: logo row (fixed logo height) carries the rank pill and trend at its right; they wrap
              under each other when the card is narrow, so both stay inside the card at every width */}
          <div className="flex h-16 items-start justify-between gap-3">
            <div className="flex-shrink-0">
              <ToolIcon name={ranking.tool.name} slug={ranking.tool.slug} logo={ranking.tool.logo} size={64} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
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
          {/* #326: full-width title in a fixed two-line slot (2 x 1.25em): names wrap instead of truncating to one
              letter, and all cards keep equal rows. md/lg sizes fit ~30 characters in the narrow three-column layout.
              leading-[1.25] follows the font size because tailwind-merge drops CardTitle's leading-tight. */}
          <CardTitle
            title={ranking.tool.name}
            className="line-clamp-2 h-[2.5em] break-words text-xl font-bold leading-[1.25] group-hover:text-primary transition-colors md:text-xs lg:text-sm xl:text-xl"
          >
            {ranking.tool.name}
          </CardTitle>
          {/* #326: category steps down with the title in the md band; m-0 drops the globals.css p margin */}
          <p className="m-0 truncate text-sm text-muted-foreground md:text-xs lg:text-sm">
            {ranking.tool.category.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
          </p>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4 md:px-4 xl:px-6">
          {/* #323: always three lines tall (text-sm leading-5), so short and long descriptions take the same space */}
          <p className="m-0 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
            {ranking.tool.description ? extractTextFromRichText(ranking.tool.description) : ""}
          </p>

          {/* #323: pinned to the card bottom; SWE-bench keeps its column with an em dash when missing */}
          {/* #326: md-xl labels drop to text-xs and never wrap, so "SWE-bench" stays on one line */}
          <div className="mt-auto grid grid-cols-2 gap-4 text-sm md:text-xs xl:text-sm">
            <div>
              <span className="whitespace-nowrap text-muted-foreground">Score</span>
              <div className="font-semibold text-lg text-primary">
                {ranking.scores?.overall?.toFixed(1) || "—"}
              </div>
            </div>
            <div>
              <span className="whitespace-nowrap text-muted-foreground">SWE-bench</span>
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
