"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Copy, TrendingUp, TrendingDown, Zap, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { format, parseISO } from "date-fns";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { RankingPeriod } from "@/lib/json-db/schemas";

interface RankingChangesSummaryProps {
  period: string;
  lang: string;
  dict: Dictionary;
}

interface ChangeEntry {
  tool_name: string;
  tool_id: string;
  position: number;
  previous_position?: number;
  movement_direction: string;
  movement_change: number;
  score: number;
  score_change?: number;
  primary_reason?: string;
}

function formatPeriodDisplay(period: string): string {
  if (period.length === 10) {
    return format(parseISO(period), "MMMM d, yyyy");
  } else if (period.length === 7) {
    return format(parseISO(period + "-01"), "MMMM yyyy");
  }
  return period;
}

export function RankingChangesSummary({ period, lang }: RankingChangesSummaryProps) {
  const [rankingsData, setRankingsData] = useState<RankingPeriod | null>(null);
  const [previousPeriod, setPreviousPeriod] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get available periods to find the previous one
        const periodsResponse = await fetch("/api/admin/rankings/periods");
        if (periodsResponse.ok) {
          const periodsData = await periodsResponse.json();
          const periods = periodsData.periods || [];
          const currentIndex = periods.indexOf(period);
          if (currentIndex > 0 && currentIndex < periods.length - 1) {
            setPreviousPeriod(periods[currentIndex + 1]);
          }
        }

        // Get current period rankings
        const response = await fetch(`/api/admin/rankings/${period}`);
        if (!response.ok) {
          throw new Error("Failed to load rankings data");
        }

        const data = await response.json();
        setRankingsData(data.period);
      } catch (err) {
        console.error("Error loading rankings:", err);
        setError("Failed to load ranking changes");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  const getSignificantChanges = (): ChangeEntry[] => {
    if (!rankingsData) {
      return [];
    }

    return rankingsData.rankings
      .filter(
        (entry) =>
          entry.movement &&
          (entry.movement.direction === "up" ||
            entry.movement.direction === "down" ||
            entry.movement.direction === "new")
      )
      .map((entry) => ({
        tool_name: entry.tool_name,
        tool_id: entry.tool_id,
        position: entry.position,
        previous_position: entry.movement?.previous_position,
        movement_direction: entry.movement?.direction || "same",
        movement_change: entry.movement?.change || 0,
        score: entry.score,
        score_change: 0, // Score change is not available in the current data structure
        primary_reason: entry.change_analysis?.primary_reason,
      }))
      .sort((a, b) => Math.abs(b.movement_change) - Math.abs(a.movement_change));
  };

  const generateNarrative = () => {
    const changes = getSignificantChanges();
    const newEntries = changes.filter((c) => c.movement_direction === "new");
    const bigMoversUp = changes.filter(
      (c) => c.movement_direction === "up" && c.movement_change >= 3
    );
    const bigMoversDown = changes.filter(
      (c) => c.movement_direction === "down" && c.movement_change >= 3
    );
    const topThreeChanges =
      rankingsData?.rankings.slice(0, 3).filter((r) => r.movement?.direction !== "same") || [];

    let narrative = `# AI Tool Rankings Update - ${formatPeriodDisplay(period)}\n\n`;

    if (previousPeriod) {
      narrative += `*Comparing to rankings from ${formatPeriodDisplay(previousPeriod)}*\n\n`;
    }

    // Executive Summary
    narrative += `## Executive Summary\n\n`;
    narrative += `This period saw ${changes.length} significant position changes among the ${rankingsData?.rankings.length || 0} ranked AI coding tools. `;

    if (newEntries.length > 0) {
      narrative += `${newEntries.length} new tool${newEntries.length > 1 ? "s" : ""} entered the rankings. `;
    }

    if (bigMoversUp.length > 0 || bigMoversDown.length > 0) {
      narrative += `Major shifts indicate ${bigMoversUp.length > bigMoversDown.length ? "increasing momentum in newer tools" : "market consolidation around established players"}.\n\n`;
    } else {
      narrative += `The rankings remained relatively stable with minor adjustments.\n\n`;
    }

    // Top Rankings Changes
    if (topThreeChanges.length > 0) {
      narrative += `## Changes in Top 3\n\n`;
      topThreeChanges.forEach((entry) => {
        if (entry.movement?.direction === "up") {
          narrative += `- **${entry.tool_name}** climbed to #${entry.position} (up ${entry.movement.change} position${entry.movement.change > 1 ? "s" : ""})\n`;
        } else if (entry.movement?.direction === "down") {
          narrative += `- **${entry.tool_name}** dropped to #${entry.position} (down ${Math.abs(entry.movement.change)} position${Math.abs(entry.movement.change) > 1 ? "s" : ""})\n`;
        } else if (entry.movement?.direction === "new") {
          narrative += `- **${entry.tool_name}** entered the top 3 at #${entry.position}\n`;
        }
      });
      narrative += "\n";
    }

    // New Entries
    if (newEntries.length > 0) {
      narrative += `## New Entries\n\n`;
      newEntries.slice(0, 5).forEach((entry) => {
        narrative += `- **${entry.tool_name}** debuts at #${entry.position} with a score of ${entry.score.toFixed(1)}`;
        if (entry.primary_reason) {
          narrative += ` - ${entry.primary_reason}`;
        }
        narrative += "\n";
      });
      if (newEntries.length > 5) {
        narrative += `- *Plus ${newEntries.length - 5} more new entries*\n`;
      }
      narrative += "\n";
    }

    // Biggest Movers Up
    if (bigMoversUp.length > 0) {
      narrative += `## Biggest Gainers\n\n`;
      bigMoversUp.slice(0, 5).forEach((entry) => {
        narrative += `- **${entry.tool_name}** jumped ${entry.movement_change} position${entry.movement_change > 1 ? "s" : ""} to #${entry.position}`;
        if (entry.primary_reason) {
          narrative += ` - ${entry.primary_reason}`;
        }
        narrative += "\n";
      });
      narrative += "\n";
    }

    // Biggest Movers Down
    if (bigMoversDown.length > 0) {
      narrative += `## Notable Declines\n\n`;
      bigMoversDown.slice(0, 5).forEach((entry) => {
        narrative += `- **${entry.tool_name}** fell ${Math.abs(entry.movement_change)} position${Math.abs(entry.movement_change) > 1 ? "s" : ""} to #${entry.position}`;
        if (entry.primary_reason) {
          narrative += ` - ${entry.primary_reason}`;
        }
        narrative += "\n";
      });
      narrative += "\n";
    }

    // Key Insights
    narrative += `## Key Insights\n\n`;

    // Analyze patterns
    const autonomousAgents = changes.filter(
      (c) => rankingsData?.rankings.find((r) => r.tool_id === c.tool_id)?.tier === "S"
    );

    if (autonomousAgents.length > 0) {
      narrative += `1. **Autonomous Coding Agents**: ${autonomousAgents.filter((a) => a.movement_direction === "up").length} of ${autonomousAgents.length} autonomous agents improved their positions, indicating growing maturity in AI-powered development.\n\n`;
    }

    if (newEntries.length >= 3) {
      narrative += `2. **Market Expansion**: The addition of ${newEntries.length} new tools suggests rapid innovation and increasing competition in the AI coding assistant space.\n\n`;
    }

    const avgMovement =
      changes.reduce((sum, c) => sum + Math.abs(c.movement_change), 0) / changes.length;
    if (avgMovement > 5) {
      narrative += `3. **High Volatility**: With an average position change of ${avgMovement.toFixed(1)} places, the market remains highly dynamic as tools compete for developer mindshare.\n\n`;
    }

    // Footer
    narrative += `---\n\n`;
    narrative += `*Generated from AI Power Rankings data for ${formatPeriodDisplay(period)}*\n`;
    narrative += `*Total tools ranked: ${rankingsData?.rankings.length || 0}*\n`;
    narrative += `*Algorithm version: ${rankingsData?.algorithm_version || "v6-news"}*`;

    return narrative;
  };

  const copyToClipboard = () => {
    const narrative = generateNarrative();
    navigator.clipboard.writeText(narrative).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <DashboardLayout
        title="Ranking Changes Summary"
        description={`Loading changes for ${formatPeriodDisplay(period)}`}
        backHref={`/${lang}/dashboard/rankings`}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !rankingsData) {
    return (
      <DashboardLayout
        title="Ranking Changes Summary"
        description="Error loading ranking changes"
        backHref={`/${lang}/dashboard/rankings`}
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Failed to load ranking data"}</AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const changes = getSignificantChanges();

  return (
    <DashboardLayout
      title="Ranking Changes Summary"
      description={`Movement analysis for ${formatPeriodDisplay(period)}`}
      backHref={`/${lang}/dashboard/rankings`}
      action={
        <div className="flex gap-2">
          <Button onClick={copyToClipboard} variant="outline">
            <Copy className="h-4 w-4 mr-2" />
            {copied ? "Copied!" : "Copy Narrative"}
          </Button>
          <Link href={`/${lang}/dashboard/rankings`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Rankings
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold">{changes.length}</div>
              <p className="text-sm text-muted-foreground">Total Changes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-green-600">
                {changes.filter((c) => c.movement_direction === "up").length}
              </div>
              <p className="text-sm text-muted-foreground">Tools Moving Up</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-red-600">
                {changes.filter((c) => c.movement_direction === "down").length}
              </div>
              <p className="text-sm text-muted-foreground">Tools Moving Down</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-2xl font-bold text-blue-600">
                {changes.filter((c) => c.movement_direction === "new").length}
              </div>
              <p className="text-sm text-muted-foreground">New Entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Narrative Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Narrative Preview</CardTitle>
            <CardDescription>
              Copy this narrative to use in Faw.ai or other content generation tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono">{generateNarrative()}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Changes */}
        <Card>
          <CardHeader>
            <CardTitle>All Position Changes</CardTitle>
            <CardDescription>Detailed view of all ranking movements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {changes.map((change) => (
                <Link
                  key={change.tool_id}
                  href={`/en/dashboard/tools/${change.tool_id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      {change.movement_direction === "up" && (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      )}
                      {change.movement_direction === "down" && (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                      {change.movement_direction === "new" && (
                        <Zap className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{change.tool_name}</div>
                      <div className="text-sm text-muted-foreground">
                        #{change.position}
                        {change.previous_position && (
                          <span> (was #{change.previous_position})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      className={
                        change.movement_direction === "up"
                          ? "bg-green-100 text-green-800"
                          : change.movement_direction === "down"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                      }
                    >
                      {change.movement_direction === "up" && `↑ ${change.movement_change}`}
                      {change.movement_direction === "down" &&
                        `↓ ${Math.abs(change.movement_change)}`}
                      {change.movement_direction === "new" && "NEW"}
                    </Badge>
                    {change.primary_reason && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {change.primary_reason}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
