import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { TierScheme } from "@/lib/rankings/lists";

interface TierLegendProps {
  dict?: Dictionary;
  /** #186: "thirds" for a list of fewer than 10 entries (D53); default "standard". */
  scheme?: TierScheme;
}

export function TierLegend({ dict, scheme = "standard" }: TierLegendProps) {
  const title = dict?.rankings?.tierLegend?.title || "Ranking Tiers";
  const thirds = dict?.rankings?.tierLegend?.thirds;
  const description =
    scheme === "thirds"
      ? thirds?.description || "Tiers split the list into thirds"
      : dict?.rankings?.tierLegend?.description ||
        "Tools are assigned tiers based on their ranking position";
  const tierData = dict?.rankings?.tierLegend?.tiers;

  // #190 C2 (Option B): solid --ds-score-* bands with --ds-score-fg text (AA in
  // both modes), the same classes as getTierColor in lib/ranking-utils.ts, including
  // the band repeated as the hover fill, so Badge's default primary hover never shows.
  const standardTiers = [
    {
      name: "S",
      label: tierData?.S?.label || "Elite",
      range: tierData?.S?.range || "Top 5",
      color: "bg-ds-score-s hover:bg-ds-score-s text-ds-score-fg",
      description: tierData?.S?.description || "The absolute best AI coding tools",
    },
    {
      name: "A",
      label: tierData?.A?.label || "Excellent",
      range: tierData?.A?.range || "6-15",
      color: "bg-ds-score-a hover:bg-ds-score-a text-ds-score-fg",
      description: tierData?.A?.description || "Exceptional tools with strong performance",
    },
    {
      name: "B",
      label: tierData?.B?.label || "Good",
      range: tierData?.B?.range || "16-25",
      color: "bg-ds-score-b hover:bg-ds-score-b text-ds-score-fg",
      description: tierData?.B?.description || "Solid, reliable tools",
    },
    {
      name: "C",
      label: tierData?.C?.label || "Average",
      range: tierData?.C?.range || "26-35",
      color: "bg-ds-score-c hover:bg-ds-score-c text-ds-score-fg",
      description: tierData?.C?.description || "Decent tools with specific use cases",
    },
    {
      name: "D",
      label: tierData?.D?.label || "Below Average",
      range: tierData?.D?.range || "36+",
      color: "bg-ds-score-d hover:bg-ds-score-d text-ds-score-fg",
      description: tierData?.D?.description || "Tools with limited features or adoption",
    },
  ];
  // #186 (D53): a short list keeps S, A and B only, each a third of the list.
  const thirdsRange: Record<string, string> = {
    S: thirds?.S || "Top third",
    A: thirds?.A || "Middle third",
    B: thirds?.B || "Bottom third",
  };
  const tiers =
    scheme === "thirds"
      ? standardTiers.slice(0, 3).map((tier) => ({ ...tier, range: thirdsRange[tier.name]! }))
      : standardTiers;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </div>
        {description && <CardDescription className="text-sm">{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {tiers.map((tier) => (
            <div key={tier.name} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge className={`${tier.color} font-bold px-3 py-1`}>{tier.name}</Badge>
                <span className="text-sm font-medium">{tier.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <div className="font-medium">{scheme === "thirds" ? tier.range : `Rank ${tier.range}`}</div>
                <div className="mt-1">{tier.description}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
