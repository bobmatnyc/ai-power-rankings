"use client";

import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// Define RankingPeriod interface locally
interface RankingPeriod {
  period: string;
  algorithm_version: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  published_at?: string;
  rankings?: any[];
}
import { cn } from "@/lib/utils";

interface RankingPeriodSummary {
  period: string;
  is_current: boolean;
  total_tools: number;
  algorithm_version: string;
  created_at: string;
  updated_at?: string;
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

export function RankingsViewer() {
  const searchParams = useSearchParams();
  const [periods, setPeriods] = useState<RankingPeriodSummary[]>([]);
  const [expandedRankings, setExpandedRankings] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [currentLivePeriod, setCurrentLivePeriod] = useState<string>("");
  const [rankingsData, setRankingsData] = useState<RankingPeriod | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [isSettingLive, setIsSettingLive] = useState(false);
  const [deleteConfirmPeriod, setDeleteConfirmPeriod] = useState<string | null>(null);
  const [isDeletingRanking, setIsDeletingRanking] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Define loadPeriods with useCallback to ensure it's available for useEffect dependencies
  const loadPeriods = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ranking-periods");
      if (response.ok) {
        const data = await response.json();
        const periodsData = data.periods || [];
        setPeriods(periodsData);

        // Find current live period
        const currentPeriod = periodsData.find((p: RankingPeriodSummary) => p.is_current);
        if (currentPeriod) {
          setCurrentLivePeriod(currentPeriod.period);
          setSelectedPeriod(currentPeriod.period);
        } else if (periodsData.length > 0) {
          // Select most recent period if no current live period
          setSelectedPeriod(periodsData[0].period);
        }
      }
    } catch (err) {
      console.error("Failed to load periods:", err);
      setError("Failed to load ranking periods");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Define loadRankingsForPeriod with useCallback to ensure it's available for useEffect dependencies
  const loadRankingsForPeriod = useCallback(async (period: string) => {
    setIsLoadingRankings(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/rankings/${period}`);
      if (response.ok) {
        const data = await response.json();
        setRankingsData(data.period);
      } else {
        throw new Error("Failed to load rankings data");
      }
    } catch (err) {
      console.error("Failed to load rankings:", err);
      setError("Failed to load rankings data");
      setRankingsData(null);
    } finally {
      setIsLoadingRankings(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();

    // Check for success message from URL params
    if (searchParams.get("saved") === "true") {
      const period = searchParams.get("period");
      setSuccess(
        period ? `Rankings for ${period} saved successfully!` : "Rankings saved successfully!"
      );

      // Clear URL params
      window.history.replaceState({}, "", "/dashboard/rankings");
    }
  }, [searchParams, loadPeriods]);

  useEffect(() => {
    if (selectedPeriod) {
      loadRankingsForPeriod(selectedPeriod);
    }
  }, [selectedPeriod, loadRankingsForPeriod]);

  const setAsLive = async (period: string) => {
    setIsSettingLive(true);
    setError("");

    try {
      const response = await fetch("/api/admin/rankings/set-current", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ period }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to set as live");
      }

      if (data.success) {
        setCurrentLivePeriod(period);
        setSuccess(`${formatPeriodDisplay(period)} is now live on the website!`);
        // Reload periods to update current status
        loadPeriods();
      } else {
        throw new Error(data.error || "Failed to set as live");
      }
    } catch (err) {
      console.error("Set live error:", err);
      setError(err instanceof Error ? err.message : "Failed to set as live");
    } finally {
      setIsSettingLive(false);
    }
  };

  const handleDeleteRanking = async (period: string) => {
    setIsDeletingRanking(period);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/rankings/${period}/delete`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete ranking");
      }

      setSuccess(`Successfully deleted ranking period ${formatPeriodDisplay(period)}`);
      setDeleteConfirmPeriod(null);

      // If we deleted the current live ranking, clear it
      if (period === currentLivePeriod) {
        setCurrentLivePeriod("");
      }

      // If we deleted the selected period, clear it
      if (period === selectedPeriod) {
        setSelectedPeriod("");
        setRankingsData(null);
      }

      // Reload periods
      loadPeriods();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete ranking");
    } finally {
      setIsDeletingRanking(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Period Selection */}
      {periods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Ranking Period
            </CardTitle>
            <CardDescription>Choose a ranking period to view and manage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Select
                  value={selectedPeriod}
                  onValueChange={(value) => {
                    setSelectedPeriod(value);
                    setExpandedRankings(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a period" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map((period) => (
                      <SelectItem key={period.period} value={period.period}>
                        <div className="flex items-center gap-2">
                          {formatPeriodDisplay(period.period)}
                          {period.is_current && (
                            <Badge className="bg-green-100 text-green-800">LIVE</Badge>
                          )}
                          <span className="text-muted-foreground">
                            ({period.total_tools} tools)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {selectedPeriod && selectedPeriod !== currentLivePeriod && (
                  <Button
                    onClick={() => setAsLive(selectedPeriod)}
                    disabled={isSettingLive}
                    variant="outline"
                    className="whitespace-nowrap"
                  >
                    {isSettingLive ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Setting Live...
                      </>
                    ) : (
                      <>
                        <Globe className="h-4 w-4 mr-2" />
                        Set as Live
                      </>
                    )}
                  </Button>
                )}

                {selectedPeriod &&
                  selectedPeriod !== currentLivePeriod &&
                  (deleteConfirmPeriod === selectedPeriod ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Confirm delete?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteRanking(selectedPeriod)}
                        disabled={isDeletingRanking === selectedPeriod}
                      >
                        {isDeletingRanking === selectedPeriod ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Yes"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteConfirmPeriod(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirmPeriod(selectedPeriod)}
                      disabled={isDeletingRanking === selectedPeriod}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rankings Display */}
      {selectedPeriod && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Rankings for {formatPeriodDisplay(selectedPeriod)}
                  {selectedPeriod === currentLivePeriod && (
                    <Badge className="bg-green-100 text-green-800">LIVE</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {rankingsData && (
                    <>
                      {rankingsData.rankings.length} tools • Algorithm{" "}
                      {rankingsData.algorithm_version}
                    </>
                  )}
                </CardDescription>
              </div>
              {rankingsData && (
                <Link href={`/en/dashboard/rankings/${selectedPeriod}/changes`}>
                  <Button variant="outline" size="sm">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Changes Summary
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingRankings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : rankingsData ? (
              <div className="space-y-2">
                {rankingsData.rankings
                  .slice(0, expandedRankings ? undefined : 20)
                  .map((entry, index) => (
                    <Link
                      key={entry.tool_id}
                      href={`/en/dashboard/tools/${entry.tool_id}`}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border relative hover:shadow-md transition-shadow",
                        index < 3 && "bg-yellow-50 border-yellow-200 hover:border-yellow-300",
                        index >= 3 && index < 10 && "bg-gray-50 hover:bg-gray-100",
                        index >= 10 && "hover:bg-gray-50"
                      )}
                      style={{ display: "flex" }}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-center">
                          <div className={cn("text-lg font-bold", index < 3 && "text-yellow-600")}>
                            #{entry.position}
                          </div>
                          {index < 3 && <Star className="h-4 w-4 mx-auto text-yellow-500" />}
                        </div>

                        <div className="flex-1">
                          <div className="font-medium">{entry.tool_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Score: {(entry.score || 0).toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.movement && entry.movement.direction !== "same" && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge
                                  className={cn(
                                    "cursor-help",
                                    entry.movement.direction === "up" &&
                                      "bg-green-100 text-green-800",
                                    entry.movement.direction === "down" &&
                                      "bg-red-100 text-red-800",
                                    entry.movement.direction === "new" &&
                                      "bg-blue-100 text-blue-800"
                                  )}
                                >
                                  {entry.movement.direction === "up" &&
                                    `↑ ${entry.movement.change}`}
                                  {entry.movement.direction === "down" &&
                                    `↓ ${Math.abs(entry.movement.change)}`}
                                  {entry.movement.direction === "new" && "NEW"}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  {entry.movement.direction === "up" && (
                                    <>
                                      <p className="font-medium">
                                        Moved up {entry.movement.change} position
                                        {entry.movement.change > 1 ? "s" : ""}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Previous rank: #
                                        {entry.movement.previous_position ||
                                          (entry.position ?? 0) + entry.movement.change}
                                      </p>
                                    </>
                                  )}
                                  {entry.movement.direction === "down" && (
                                    <>
                                      <p className="font-medium">
                                        Moved down {Math.abs(entry.movement.change)} position
                                        {Math.abs(entry.movement.change) > 1 ? "s" : ""}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Previous rank: #
                                        {entry.movement.previous_position ||
                                          (entry.position ?? 0) - entry.movement.change}
                                      </p>
                                    </>
                                  )}
                                  {entry.movement.direction === "new" && (
                                    <p className="font-medium">New entry in rankings</p>
                                  )}
                                  {entry.change_analysis?.primary_reason && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Reason: {entry.change_analysis.primary_reason}
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </Link>
                  ))}

                {rankingsData.rankings.length > 20 && !expandedRankings && (
                  <div className="text-center py-4">
                    <Button
                      variant="link"
                      onClick={() => setExpandedRankings(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ... and {rankingsData.rankings.length - 20} more tools →
                    </Button>
                  </div>
                )}

                {expandedRankings && rankingsData.rankings.length > 20 && (
                  <div className="text-center py-4">
                    <Button
                      variant="link"
                      onClick={() => setExpandedRankings(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ← Show less
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No rankings data available for this period
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {periods.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Rankings Available</h3>
            <p className="text-muted-foreground mb-4">
              Get started by building your first set of rankings
            </p>
            <Link href="/dashboard/rankings/build">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Build First Rankings
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
