"use client";

import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Save,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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

interface PreviewResult {
  period: string;
  algorithm_version: string;
  total_tools: number;
  new_entries: number;
  dropped_entries: number;
  rankings_comparison: RankingComparison[];
  top_10_changes: RankingComparison[];
  biggest_movers: {
    up: RankingComparison[];
    down: RankingComparison[];
  };
  summary: {
    tools_moved_up: number;
    tools_moved_down: number;
    tools_stayed_same: number;
    average_score_change: number;
    highest_score: number;
    lowest_score: number;
  };
  comparison_period?: string;
  is_initial_ranking: boolean;
}

// Helper function to format period display
function formatPeriodDisplay(period: string): string {
  // Check if it's a daily period (YYYY-MM-DD) or monthly (YYYY-MM)
  if (period.length === 10) {
    // Daily period - format as "Jan 15, 2025"
    return format(parseISO(period), "MMM d, yyyy");
  } else if (period.length === 7) {
    // Monthly period - format as "January 2025"
    return format(parseISO(`${period}-01`), "MMMM yyyy");
  }
  return period;
}

export function RankingBuilder() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [compareWith, setCompareWith] = useState<string>("auto");
  const [algorithmVersion, setAlgorithmVersion] = useState<string>("v6.0");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string>("");
  const [progressTicker, setProgressTicker] = useState<string>("");
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [expandedPreview, setExpandedPreview] = useState(false);

  const loadAvailablePeriods = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ranking-periods");
      if (response.ok) {
        const data = await response.json();
        setAvailablePeriods(data.periods?.map((p: { period: string }) => p.period) || []);
      }
    } catch (err) {
      console.error("Failed to load periods:", err);
    }
  }, []);

  useEffect(() => {
    loadAvailablePeriods();

    // Set default period to current date
    const now = new Date();
    const defaultPeriod = format(now, "yyyy-MM-dd");
    setSelectedPeriod(defaultPeriod);
  }, [loadAvailablePeriods]);

  const generatePreview = async () => {
    if (!selectedPeriod) {
      setError("Please select a period");
      return;
    }

    setError("");
    setIsGeneratingPreview(true);
    setPreview(null);
    setProgressTicker("Starting generation...");

    // Start progress polling
    const progressInterval = setInterval(async () => {
      try {
        const progressResponse = await fetch("/api/admin/ranking-progress");
        if (progressResponse.ok) {
          const progressData = await progressResponse.json();
          setProgressTicker(progressData.message || "Processing...");
        }
      } catch (_err) {
        // Ignore progress errors, continue with main request
      }
    }, 1000);

    try {
      const response = await fetch("/api/admin/preview-rankings-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period: selectedPeriod,
          algorithm_version: algorithmVersion,
          compare_with: compareWith,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate preview");
      }

      if (data.success) {
        setPreview(data.preview);
      } else {
        throw new Error(data.error || "Preview generation failed");
      }
    } catch (err) {
      console.error("Preview generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      clearInterval(progressInterval);
      setIsGeneratingPreview(false);
      setProgressTicker("");
    }
  };

  const saveRankings = async () => {
    if (!preview) {
      setError("Please generate a preview first");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/rankings/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          period: selectedPeriod,
          algorithm_version: algorithmVersion,
          rankings: preview.rankings_comparison.map((comparison) => ({
            tool_id: comparison.tool_id,
            tool_name: comparison.tool_name,
            position: comparison.new_position,
            score: comparison.new_score,
            movement: {
              direction: comparison.movement,
              position_change: comparison.position_change,
              current_position: comparison.current_position,
              score_change: comparison.score_change,
            },
            change_analysis: comparison.change_analysis,
            factor_scores: {}, // Will be filled by the algorithm
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save rankings");
      }

      if (data.success) {
        // Navigate back to rankings management with success message
        window.location.href = `/dashboard/rankings?saved=true&period=${selectedPeriod}`;
      } else {
        throw new Error(data.error || "Failed to save rankings");
      }
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save rankings");
    } finally {
      setIsSaving(false);
    }
  };

  const getMovementIcon = (movement: string, comparison: RankingComparison | null) => {
    const icon = (() => {
      switch (movement) {
        case "up":
          return <ChevronUp className="h-4 w-4 text-green-600" />;
        case "down":
          return <ChevronDown className="h-4 w-4 text-red-600" />;
        case "new":
          return <Zap className="h-4 w-4 text-blue-600" />;
        case "same":
          return <ArrowUpDown className="h-4 w-4 text-gray-600" />;
        default:
          return null;
      }
    })();

    if (!icon) {
      return null;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-help">{icon}</div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              {movement === "up" && (
                <>
                  <p className="font-medium">
                    Moved up {comparison?.position_change} position
                    {(comparison?.position_change ?? 0) > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From #{comparison?.current_position} to #{comparison?.new_position}
                  </p>
                </>
              )}
              {movement === "down" && (
                <>
                  <p className="font-medium">
                    Moved down {Math.abs(comparison?.position_change ?? 0)} position
                    {Math.abs(comparison?.position_change ?? 0) > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From #{comparison?.current_position} to #{comparison?.new_position}
                  </p>
                </>
              )}
              {movement === "new" && <p className="font-medium">New entry in rankings</p>}
              {movement === "same" && <p className="font-medium">No change in position</p>}
              {comparison?.score_change && (
                <p className="text-xs text-muted-foreground mt-1">
                  Score: {comparison?.current_score?.toFixed(1) || "N/A"} →{" "}
                  {(comparison?.new_score || 0).toFixed(1)}(
                  {(comparison?.score_change ?? 0) > 0 ? "+" : ""}
                  {comparison?.score_change?.toFixed(1)})
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const getMovementBadge = (movement: string, change: number) => {
    switch (movement) {
      case "up":
        return <Badge className="bg-green-100 text-green-800">↑ {Math.abs(change)}</Badge>;
      case "down":
        return <Badge className="bg-red-100 text-red-800">↓ {Math.abs(change)}</Badge>;
      case "new":
        return <Badge className="bg-blue-100 text-blue-800">NEW</Badge>;
      case "same":
        return <Badge className="bg-gray-100 text-gray-800">—</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Ranking Configuration
          </CardTitle>
          <CardDescription>Configure the ranking period and comparison settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="period">Ranking Date</Label>
              <Input
                id="period"
                type="date"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="compare">Compare With</Label>
              <Select value={compareWith} onValueChange={setCompareWith}>
                <SelectTrigger>
                  <SelectValue placeholder="Select comparison period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Previous Period)</SelectItem>
                  <SelectItem value="none">No Comparison</SelectItem>
                  {availablePeriods.map((period) => (
                    <SelectItem key={period} value={period}>
                      {formatPeriodDisplay(period)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="algorithm">Algorithm Version</Label>
              <Select value={algorithmVersion} onValueChange={setAlgorithmVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select algorithm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="v6.0">v6.0 (Latest)</SelectItem>
                  <SelectItem value="v5.0">v5.0</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={generatePreview}
              disabled={isGeneratingPreview || !selectedPeriod}
              className="flex-1"
            >
              {isGeneratingPreview ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Generate Preview
                </>
              )}
            </Button>
          </div>

          {progressTicker && (
            <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md border">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                {progressTicker}
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Preview Results */}
      {preview && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{preview.total_tools}</p>
                    <p className="text-sm text-muted-foreground">Total Tools</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{preview.new_entries}</p>
                    <p className="text-sm text-muted-foreground">New Entries</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ChevronUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{preview.summary.tools_moved_up}</p>
                    <p className="text-sm text-muted-foreground">Moved Up</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <ChevronDown className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{preview.summary.tools_moved_down}</p>
                    <p className="text-sm text-muted-foreground">Moved Down</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rankings Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Rankings Preview ({formatPeriodDisplay(preview.period)})
                  </CardTitle>
                  <CardDescription>
                    {preview.is_initial_ranking
                      ? "Initial ranking with no comparison data"
                      : `Compared with ${formatPeriodDisplay(preview.comparison_period || "")}`}
                  </CardDescription>
                </div>
                <Button
                  onClick={saveRankings}
                  disabled={isSaving}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Rankings
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {preview.rankings_comparison
                  .slice(0, expandedPreview ? undefined : 20)
                  .map((comparison, index) => (
                    <Link
                      key={comparison.tool_id}
                      href={`/en/dashboard/tools/${comparison.tool_id}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border hover:shadow-md transition-shadow",
                        index < 3 && "bg-yellow-50 border-yellow-200 hover:border-yellow-300",
                        index >= 3 && index < 10 && "bg-gray-50 hover:bg-gray-100",
                        index >= 10 && "hover:bg-gray-50"
                      )}
                      style={{ display: "flex" }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-center">
                          <div className={cn("text-lg font-bold", index < 3 && "text-yellow-600")}>
                            #{comparison.new_position}
                          </div>
                          {comparison.current_position && (
                            <div className="text-xs text-muted-foreground">
                              was #{comparison.current_position}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-1">
                          {getMovementIcon(comparison.movement, comparison)}
                          <div>
                            <div className="font-medium">{comparison.tool_name}</div>
                            <div className="text-sm text-muted-foreground">
                              Score: {(comparison.new_score || 0).toFixed(1)}
                              {comparison.current_score && (
                                <span
                                  className={cn(
                                    "ml-2",
                                    comparison.score_change > 0 ? "text-green-600" : "text-red-600"
                                  )}
                                >
                                  ({comparison.score_change > 0 ? "+" : ""}
                                  {(comparison.score_change || 0).toFixed(1)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getMovementBadge(comparison.movement, comparison.position_change)}
                      </div>
                    </Link>
                  ))}

                {preview.rankings_comparison.length > 20 && !expandedPreview && (
                  <div className="text-center py-4">
                    <Button
                      variant="link"
                      onClick={() => setExpandedPreview(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ... and {preview.rankings_comparison.length - 20} more tools →
                    </Button>
                  </div>
                )}

                {expandedPreview && preview.rankings_comparison.length > 20 && (
                  <div className="text-center py-4">
                    <Button
                      variant="link"
                      onClick={() => setExpandedPreview(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ← Show less
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
