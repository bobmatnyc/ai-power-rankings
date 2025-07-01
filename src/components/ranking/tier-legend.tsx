import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";

interface TierLegendProps {
  dict?: Dictionary;
}

export function TierLegend({ dict }: TierLegendProps) {
  const title = dict?.rankings?.tierLegend?.title || "Ranking Tiers";
  const description =
    dict?.rankings?.tierLegend?.description ||
    "Tools are assigned tiers based on their ranking position";
  const tierData = dict?.rankings?.tierLegend?.tiers;

  const tiers = [
    {
      name: "S",
      label: tierData?.S?.label || "Elite",
      range: tierData?.S?.range || "Top 5",
      color: "bg-gradient-to-r from-yellow-500 to-amber-500 text-white",
      description: tierData?.S?.description || "The absolute best AI coding tools",
    },
    {
      name: "A",
      label: tierData?.A?.label || "Excellent",
      range: tierData?.A?.range || "6-15",
      color: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
      description: tierData?.A?.description || "Exceptional tools with strong performance",
    },
    {
      name: "B",
      label: tierData?.B?.label || "Good",
      range: tierData?.B?.range || "16-25",
      color: "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
      description: tierData?.B?.description || "Solid, reliable tools",
    },
    {
      name: "C",
      label: tierData?.C?.label || "Average",
      range: tierData?.C?.range || "26-35",
      color: "bg-gradient-to-r from-gray-500 to-slate-500 text-white",
      description: tierData?.C?.description || "Decent tools with specific use cases",
    },
    {
      name: "D",
      label: tierData?.D?.label || "Below Average",
      range: tierData?.D?.range || "36+",
      color: "bg-gradient-to-r from-orange-500 to-red-500 text-white",
      description: tierData?.D?.description || "Tools with limited features or adoption",
    },
  ];

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
                <div className="font-medium">Rank {tier.range}</div>
                <div className="mt-1">{tier.description}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
