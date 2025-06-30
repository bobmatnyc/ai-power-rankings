"use client";

import { useState } from "react";
import { useRankingChanges } from "@/contexts/ranking-changes-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Play,
  Loader2,
} from "lucide-react";

interface RankingComparison {
  tool_id: string;
  tool_name: string;
  current_position?: number;
  new_position: number;
  current_score?: number;
  new_score: number;
  position_change: number;
  score_change: number;
  movement: "up" | "down" | "same" | "new" | "dropped";
  change_analysis?: {
    narrativeExplanation: string;
    primaryReason: string;
    secondaryReasons: string[];
    changeCategory: string;
  };
}

interface RankingPreview {
  period: string;
  algorithm_version: string;
  total_tools: number;
  new_entries: number;
  dropped_entries: number;
  rankings_comparison: RankingComparison[];
  top_10_changes: RankingComparison[];
  biggest_movers: {
    up: Array<{
      tool_id: string;
      tool_name: string;
      current_position?: number;
      new_position: number;
      position_change: number;
      score_change: number;
    }>;
    down: Array<{
      tool_id: string;
      tool_name: string;
      current_position?: number;
      new_position: number;
      position_change: number;
      score_change: number;
    }>;
  };
  summary: {
    tools_moved_up: number;
    tools_moved_down: number;
    tools_stayed_same: number;
    average_score_change: number;
    highest_score: number;
    lowest_score: number;
  };
  change_report?: {
    summary: string;
    narrativeSummary: string;
    factorTrends: Record<string, { improving: number; declining: number }>;
  };
}

export function RankingsManager() {
  const { setChanges } = useRankingChanges();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [preview, setPreview] = useState<RankingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/preview-rankings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period: new Date().toISOString().slice(0, 7), // Current month in YYYY-MM format
          algorithm_version: "v6.0",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to preview rankings");
      }

      const data = await response.json();
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    // TODO: Replace with a proper confirmation dialog
    // For now, proceed without confirmation in development
    const shouldProceed = true;
    if (!shouldProceed) {
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/generate-rankings", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate rankings");
      }

      setSuccess(`Successfully generated rankings for ${data.tools_ranked} tools`);
      setPreview(null); // Clear preview after generation

      // Save changes to context
      if (preview) {
        setChanges({
          totalChanges:
            preview.summary.tools_moved_up + preview.summary.tools_moved_down + preview.new_entries,
          movedUp: preview.summary.tools_moved_up,
          movedDown: preview.summary.tools_moved_down,
          newEntries: preview.new_entries,
          lastUpdated: new Date(),
        });
      }

      // Auto-sync after generation
      await handleSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch("/api/admin/sync-current-rankings", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync rankings");
      }

      setSuccess(`Successfully synced ${data.results.updated} tool rankings`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSyncing(false);
    }
  };

  // const getChangeIcon = (change: number) => {
  //   if (change > 0) {
  //     return <ArrowUp className="h-4 w-4 text-green-600" />;
  //   }
  //   if (change < 0) {
  //     return <ArrowDown className="h-4 w-4 text-red-600" />;
  //   }
  //   return <Minus className="h-4 w-4 text-gray-400" />;
  // };

  const getChangeBadge = (change: number) => {
    if (change > 0) {
      return <Badge variant="success">+{change}</Badge>;
    }
    if (change < 0) {
      return <Badge variant="destructive">{change}</Badge>;
    }
    return <Badge variant="secondary">-</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Rankings Management</h2>
        <p className="text-muted-foreground">Preview, generate, and manage AI tool rankings</p>
      </div>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Preview changes before generating new rankings</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button onClick={handlePreview} disabled={isPreviewLoading} variant="outline">
            {isPreviewLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Preview Changes
          </Button>

          <Button onClick={handleGenerate} disabled={isGenerating || !preview} variant="default">
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Generate Rankings
          </Button>

          <Button onClick={handleSync} disabled={isSyncing} variant="secondary">
            {isSyncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync Current Rankings
          </Button>
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Preview Results */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Ranking Preview</CardTitle>
            <CardDescription>
              Period: {preview.period} | Algorithm: {preview.algorithm_version} | Tools:{" "}
              {preview.total_tools}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="report">Analysis</TabsTrigger>
                <TabsTrigger value="up">Moved Up ({preview.summary.tools_moved_up})</TabsTrigger>
                <TabsTrigger value="down">
                  Moved Down ({preview.summary.tools_moved_down})
                </TabsTrigger>
                <TabsTrigger value="new">New ({preview.new_entries})</TabsTrigger>
                <TabsTrigger value="dropped">Dropped ({preview.dropped_entries})</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Changes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {preview.summary.tools_moved_up +
                          preview.summary.tools_moved_down +
                          preview.new_entries}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avg Score Change</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {preview.summary.average_score_change.toFixed(1)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Biggest Gain</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {preview.biggest_movers.up[0] ? (
                        <>
                          <div className="text-sm font-medium">
                            {preview.biggest_movers.up[0].tool_name}
                          </div>
                          <div className="text-lg font-bold text-green-600">
                            +{preview.biggest_movers.up[0].position_change}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No changes</div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Biggest Drop</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {preview.biggest_movers.down[0] ? (
                        <>
                          <div className="text-sm font-medium">
                            {preview.biggest_movers.down[0].tool_name}
                          </div>
                          <div className="text-lg font-bold text-red-600">
                            {preview.biggest_movers.down[0].position_change}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No changes</div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="report" className="space-y-4">
                {preview.change_report ? (
                  <>
                    {/* Narrative Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Movement Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{preview.change_report.narrativeSummary}</p>
                      </CardContent>
                    </Card>

                    {/* Factor Trends */}
                    {preview.change_report.factorTrends && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Factor Trends</CardTitle>
                          <CardDescription>Which factors drove the most changes</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {Object.entries(preview.change_report.factorTrends).map(
                              ([factor, trend]) => {
                                const netTrend = trend.improving - trend.declining;
                                return (
                                  <div
                                    key={factor}
                                    className="flex items-center justify-between p-2 rounded"
                                  >
                                    <span className="text-sm font-medium capitalize">
                                      {factor.replace(/([A-Z])/g, " $1").trim()}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-green-600">
                                        +{trend.improving}
                                      </span>
                                      <span className="text-sm text-red-600">
                                        -{trend.declining}
                                      </span>
                                      <Badge
                                        variant={
                                          netTrend > 0
                                            ? "default"
                                            : netTrend < 0
                                              ? "destructive"
                                              : "secondary"
                                        }
                                      >
                                        {netTrend > 0 ? "+" : ""}
                                        {netTrend}
                                      </Badge>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Top Movers with Explanations */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Top Movers</CardTitle>
                        <CardDescription>Tools with the biggest changes and why</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {preview.rankings_comparison
                          .filter(
                            (tool) => tool.change_analysis && Math.abs(tool.position_change) >= 3
                          )
                          .sort((a, b) => Math.abs(b.position_change) - Math.abs(a.position_change))
                          .slice(0, 10)
                          .map((tool, idx) => (
                            <div key={idx} className="p-3 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{tool.tool_name}</div>
                                <div className="flex items-center gap-2">
                                  {tool.position_change > 0 ? (
                                    <TrendingUp className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <TrendingDown className="h-4 w-4 text-red-600" />
                                  )}
                                  <Badge
                                    variant={tool.position_change > 0 ? "default" : "destructive"}
                                  >
                                    {tool.position_change > 0 ? "+" : ""}
                                    {tool.position_change}
                                  </Badge>
                                </div>
                              </div>
                              {tool.change_analysis && (
                                <p className="text-sm text-muted-foreground">
                                  {tool.change_analysis.narrativeExplanation}
                                </p>
                              )}
                            </div>
                          ))}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No detailed analysis available</p>
                )}
              </TabsContent>

              <TabsContent value="up">
                <div className="space-y-2">
                  {preview.rankings_comparison
                    .filter((tool) => tool.movement === "up")
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <div className="flex-1">
                            <div className="font-medium">{tool.tool_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Position: {tool.current_position} → {tool.new_position}
                            </div>
                            {tool.change_analysis && (
                              <div className="mt-1 text-sm text-muted-foreground italic">
                                {tool.change_analysis.primaryReason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getChangeBadge(tool.position_change)}
                          <div className="text-sm text-muted-foreground">
                            Score: {tool.new_score.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="down">
                <div className="space-y-2">
                  {preview.rankings_comparison
                    .filter((tool) => tool.movement === "down")
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                          <div className="flex-1">
                            <div className="font-medium">{tool.tool_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Position: {tool.current_position} → {tool.new_position}
                            </div>
                            {tool.change_analysis && (
                              <div className="mt-1 text-sm text-muted-foreground italic">
                                {tool.change_analysis.primaryReason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getChangeBadge(tool.position_change)}
                          <div className="text-sm text-muted-foreground">
                            Score: {tool.new_score.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="new">
                <div className="space-y-2">
                  {preview.rankings_comparison
                    .filter((tool) => tool.movement === "new")
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg bg-green-50"
                      >
                        <div>
                          <div className="font-medium">{tool.tool_name}</div>
                          <div className="text-sm text-muted-foreground">
                            New at position {tool.new_position}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Score: {tool.new_score.toFixed(2)}
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="dropped">
                <div className="space-y-2">
                  {preview.rankings_comparison
                    .filter((tool) => tool.movement === "dropped")
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg bg-red-50"
                      >
                        <div>
                          <div className="font-medium">{tool.tool_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Was at position {tool.current_position}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
