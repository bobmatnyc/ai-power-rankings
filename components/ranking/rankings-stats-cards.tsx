"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * The four stat cards above the rankings grid (moved out of `rankings-grid.tsx`, #186).
 *
 * #305: the counts are the list's own rows (an empty list shows 0), never a placeholder.
 */
export function RankingsStatsCards({
  dict,
  loading,
  totalTools,
  categoriesCount,
  avgScore,
  lastUpdateDate,
}: {
  dict: Dictionary;
  loading: boolean;
  totalTools: number;
  categoriesCount: number;
  avgScore: number;
  lastUpdateDate: string;
}): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-8 stats-grid"
      style={{ minHeight: "140px" }} // Reserve space to prevent layout shift
    >
      <Card
        className="border-border/50"
        style={{ minHeight: "120px" }} // Consistent card height
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {dict.rankings.stats.totalTools}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-8 w-12 rounded" />
            ) : (
              totalTools
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/50" style={{ minHeight: "120px" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {dict.rankings.stats.categories}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-8 w-8 rounded" />
            ) : (
              categoriesCount
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/50" style={{ minHeight: "120px" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {dict.rankings.stats.avgScore}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-8 w-12 rounded" />
            ) : avgScore > 0 ? (
              avgScore.toFixed(1)
            ) : (
              "-"
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/50" style={{ minHeight: "120px" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {dict.rankings.stats.lastUpdate}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {loading ? (
              <div className="animate-pulse bg-ds-surface-skeleton h-8 w-16 rounded" />
            ) : lastUpdateDate ? (
              lastUpdateDate
            ) : (
              dict.rankings.stats.thisWeek || "This Week"
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
