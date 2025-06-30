"use client";

import { useState, useEffect } from "react";
// import { useRankingChanges } from "@/contexts/ranking-changes-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// import { Calendar } from "@/components/ui/calendar";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  Loader2,
  Save,
  Database,
  Globe,
  Minus,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit,
  X,
  Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";

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
  change_report?: {
    summary: string;
    narrativeSummary: string;
    factorTrends: Record<string, { improving: number; declining: number }>;
  };
  comparison_period?: string;
  is_initial_ranking?: boolean;
}

interface RankingPeriod {
  id: string;
  period: string;
  algorithm_version: string;
  created_at: string;
  is_current: boolean;
  total_tools: number;
}

export function EnhancedRankingsManager() {
  // const { setChanges } = useRankingChanges();

  // State for UI controls
  const [previewDate, setPreviewDate] = useState<Date>(new Date());
  const [compareWithPeriod, setCompareWithPeriod] = useState<string>("auto");
  const [availablePeriods, setAvailablePeriods] = useState<RankingPeriod[]>([]);
  const [currentLiveRanking, setCurrentLiveRanking] = useState<string>("");

  // State for operations
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isBuildingRanking, setIsBuildingRanking] = useState(false);
  const [isSavingLive, setIsSavingLive] = useState(false);
  const [isLoadingPeriods, setIsLoadingPeriods] = useState(false);
  const [isDeletingRanking, setIsDeletingRanking] = useState<string | null>(null);
  const [deleteConfirmPeriod, setDeleteConfirmPeriod] = useState<string | null>(null);
  const [selectedRanking, setSelectedRanking] = useState<RankingPeriod | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isRenamingRanking, setIsRenamingRanking] = useState(false);

  // State for data
  const [preview, setPreview] = useState<RankingPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for UI
  // const [showCalendar, setShowCalendar] = useState(false);
  const [selectedRankingData, setSelectedRankingData] = useState<any[]>([]);
  const [isLoadingRankingData, setIsLoadingRankingData] = useState(false);

  // Load available ranking periods on mount
  useEffect(() => {
    loadAvailablePeriods();
  }, []);

  const loadAvailablePeriods = async () => {
    setIsLoadingPeriods(true);
    try {
      const response = await fetch("/api/admin/ranking-periods");
      if (response.ok) {
        const data = await response.json();
        console.log(
          "Loaded periods from API:",
          data.periods?.map((p: RankingPeriod) => p.period)
        );
        setAvailablePeriods(data.periods || []);
        const current = data.periods?.find((p: RankingPeriod) => p.is_current);
        if (current) {
          setCurrentLiveRanking(current.period);
        }
      }
    } catch (err) {
      console.error("Failed to load ranking periods:", err);
    } finally {
      setIsLoadingPeriods(false);
    }
  };

  const handlePreviewRankings = async () => {
    setIsPreviewLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const previewPeriod = format(previewDate, "yyyy-MM");
      const body: any = {
        period: previewPeriod,
        algorithm_version: "v6.0",
        preview_date: format(previewDate, "yyyy-MM-dd"),
      };

      if (compareWithPeriod !== "auto") {
        body.compare_with = compareWithPeriod;
      }

      const response = await fetch("/api/admin/preview-rankings-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const handleBuildRankings = async () => {
    if (!preview) {
      return;
    }

    setIsBuildingRanking(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/build-rankings-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period: preview.period,
          algorithm_version: preview.algorithm_version,
          preview_date: format(previewDate, "yyyy-MM-dd"),
          rankings: preview.rankings_comparison,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to build rankings");
      }

      const data = await response.json();
      setSuccess(
        `Successfully built rankings for ${data.tools_saved} tools in period ${preview.period}`
      );

      // Reload periods after building
      await loadAvailablePeriods();

      // Clear preview after successful build
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsBuildingRanking(false);
    }
  };

  const handleSetLiveRanking = async (period: string) => {
    setIsSavingLive(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/set-live-ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set live ranking");
      }

      setCurrentLiveRanking(period);
      setSuccess(`Successfully set ${period} as the live ranking`);
      await loadAvailablePeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSavingLive(false);
    }
  };

  const handleDeleteRanking = async (period: string) => {
    setIsDeletingRanking(period);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/admin/rankings/${period}/delete`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete ranking");
      }

      setSuccess(`Successfully deleted ranking period ${period}`);
      setDeleteConfirmPeriod(null);

      // If we deleted the current live ranking, clear it
      if (currentLiveRanking === period) {
        setCurrentLiveRanking("");
      }

      // Reload periods after deletion
      await loadAvailablePeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDeletingRanking(null);
    }
  };

  const handleRenameRanking = async () => {
    if (!selectedRanking || !editingName) return;

    setIsRenamingRanking(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/rename-ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_period: selectedRanking.period,
          new_period: editingName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to rename ranking");
      }

      await response.json();
      setSuccess(
        `Successfully renamed ranking period from ${selectedRanking.period} to ${editingName}`
      );

      // Update the selected ranking with new name
      setSelectedRanking({
        ...selectedRanking,
        period: editingName,
      });

      // If we renamed the current live ranking, update it
      if (currentLiveRanking === selectedRanking.period) {
        setCurrentLiveRanking(editingName);
      }

      // Close editing mode
      setIsEditingName(false);
      setEditingName("");

      // Reload periods after renaming
      await loadAvailablePeriods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsRenamingRanking(false);
    }
  };

  const loadRankingData = async (period: string) => {
    setIsLoadingRankingData(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/rankings/${encodeURIComponent(period)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to load rankings");
      }

      const data = await response.json();
      setSelectedRankingData(data.period?.rankings || data.rankings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rankings");
      setSelectedRankingData([]);
    } finally {
      setIsLoadingRankingData(false);
    }
  };

  const getMovementIcon = (movement: string, _change: number) => {
    switch (movement) {
      case "up":
        return <ChevronUp className="h-4 w-4 text-green-600" />;
      case "down":
        return <ChevronDown className="h-4 w-4 text-red-600" />;
      case "same":
        return <Minus className="h-4 w-4 text-gray-400" />;
      case "new":
        return (
          <Badge variant="secondary" className="h-4 px-1 text-xs">
            NEW
          </Badge>
        );
      case "dropped":
        return (
          <Badge variant="destructive" className="h-4 px-1 text-xs">
            OUT
          </Badge>
        );
      default:
        return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
  };

  // Helper function to parse different period formats into dates
  const parsePeriodToDate = (period: string): Date => {
    // Handle YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(period)) {
      return new Date(period + "-01");
    }

    // Handle month-year format (e.g., "january-2024", "march-2025")
    const monthYearMatch = period.match(/^(\w+)-(\d{4})$/);
    if (monthYearMatch) {
      const [_, month, year] = monthYearMatch;
      const monthMap: Record<string, number> = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };
      const monthIndex = monthMap[month?.toLowerCase() || ""];
      if (monthIndex !== undefined && year) {
        return new Date(parseInt(year), monthIndex, 1);
      }
    }

    // Handle "Month Year" format (e.g., "June 2025")
    const monthSpaceYearMatch = period.match(/^(\w+)\s+(\d{4})$/);
    if (monthSpaceYearMatch) {
      const [_, month, year] = monthSpaceYearMatch;
      const monthMap: Record<string, number> = {
        january: 0,
        february: 1,
        march: 2,
        april: 3,
        may: 4,
        june: 5,
        july: 6,
        august: 7,
        september: 8,
        october: 9,
        november: 10,
        december: 11,
      };
      const monthIndex = monthMap[month?.toLowerCase() || ""];
      if (monthIndex !== undefined && year) {
        return new Date(parseInt(year), monthIndex, 1);
      }
    }

    // Fallback: try to parse as-is
    const date = new Date(period);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // If all else fails, return current date (will sort to top)
    return new Date();
  };

  const getChangeBadge = (change: number, movement: string) => {
    if (movement === "new") {
      return <Badge variant="secondary">NEW</Badge>;
    }
    if (movement === "dropped") {
      return <Badge variant="destructive">DROPPED</Badge>;
    }

    if (change > 0) {
      return (
        <Badge variant="default" className="text-green-700 bg-green-100">
          +{change}
        </Badge>
      );
    }
    if (change < 0) {
      return <Badge variant="destructive">{change}</Badge>;
    }
    return <Badge variant="secondary">-</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Ranking Configuration</CardTitle>
          <CardDescription>Configure ranking preview parameters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Preview Date Selection */}
            <div className="space-y-2">
              <Label>Preview Date</Label>
              <Input
                type="date"
                value={format(previewDate, "yyyy-MM-dd")}
                onChange={(e) => {
                  if (e.target.value) {
                    // Parse the date string to avoid timezone issues
                    const [year, month, day] = e.target.value.split("-").map(Number) as [
                      number,
                      number,
                      number,
                    ];
                    setPreviewDate(new Date(year, month - 1, day, 12, 0, 0));
                  }
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Rankings will include news up to this date
              </p>
            </div>

            {/* Compare With Period */}
            <div className="space-y-2">
              <Label>Compare With</Label>
              <Select value={compareWithPeriod} onValueChange={setCompareWithPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select comparison period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Previous Available)</SelectItem>
                  {availablePeriods
                    .sort((a, b) => {
                      const dateA = parsePeriodToDate(a.period);
                      const dateB = parsePeriodToDate(b.period);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .map((period) => (
                      <SelectItem key={period.id} value={period.period}>
                        {period.period} ({period.total_tools} tools)
                      </SelectItem>
                    ))}
                  <SelectItem value="none">No Comparison</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Base period for movement comparison</p>
            </div>

            {/* Live Ranking */}
            <div className="space-y-2">
              <Label>Current Live Ranking</Label>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="flex-1 justify-center">
                  {currentLiveRanking || "None Set"}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadAvailablePeriods}
                  disabled={isLoadingPeriods}
                >
                  <RefreshCw className={cn("h-3 w-3", isLoadingPeriods && "animate-spin")} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Currently displayed on the site</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePreviewRankings} disabled={isPreviewLoading} variant="outline">
              {isPreviewLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-2 h-4 w-4" />
              )}
              Preview Rankings
            </Button>

            <Button
              onClick={handleBuildRankings}
              disabled={isBuildingRanking || !preview}
              variant="default"
            >
              {isBuildingRanking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Build & Save Rankings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Rankings Management */}
      {availablePeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Rankings</CardTitle>
            <CardDescription>Manage existing ranking periods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(() => {
                const sorted = availablePeriods.sort((a, b) => {
                  const dateA = parsePeriodToDate(a.period);
                  const dateB = parsePeriodToDate(b.period);
                  return dateB.getTime() - dateA.getTime();
                });
                console.log(
                  "Sorted periods (newest first):",
                  sorted.map((p) => p.period)
                );
                return sorted;
              })().map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1">
                      <div
                        className="font-medium cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          setSelectedRanking(period);
                          loadRankingData(period.period);
                        }}
                      >
                        {period.period}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {period.total_tools} tools • {period.algorithm_version}
                      </div>
                    </div>
                    {period.is_current && (
                      <Badge variant="default">
                        <Globe className="mr-1 h-3 w-3" />
                        Live
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground">
                      {format(parseISO(period.created_at), "MMM d, yyyy")}
                    </div>
                    {!period.is_current && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetLiveRanking(period.period)}
                          disabled={isSavingLive}
                        >
                          {isSavingLive ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Database className="h-3 w-3" />
                          )}
                          Set Live
                        </Button>

                        {deleteConfirmPeriod === period.period ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Confirm delete?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRanking(period.period)}
                              disabled={isDeletingRanking === period.period}
                            >
                              {isDeletingRanking === period.period ? (
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
                            onClick={() => setDeleteConfirmPeriod(period.period)}
                            disabled={isDeletingRanking === period.period}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking Details Panel */}
      {selectedRanking && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ranking Details: {selectedRanking.period}</CardTitle>
                <CardDescription>
                  {selectedRanking.total_tools} tools • {selectedRanking.algorithm_version} •
                  Created {format(parseISO(selectedRanking.created_at), "MMM d, yyyy")}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedRanking(null)}>
                <X className="h-4 w-4" />
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Rename functionality */}
              <div className="space-y-2">
                <Label>Period Name</Label>
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      placeholder="Enter new name"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleRenameRanking}
                      disabled={
                        isRenamingRanking || !editingName || editingName === selectedRanking.period
                      }
                    >
                      {isRenamingRanking ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingName(false);
                        setEditingName("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{selectedRanking.period}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingName(true);
                        setEditingName(selectedRanking.period);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                      Rename
                    </Button>
                  </div>
                )}
              </div>

              {/* Rankings List */}
              <div className="space-y-2">
                <Label>Rankings List</Label>
                {isLoadingRankingData ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : selectedRankingData.length > 0 ? (
                  <div className="border rounded-lg max-h-96 overflow-y-auto">
                    <div className="space-y-1">
                      {selectedRankingData.map((ranking, index) => (
                        <div
                          key={ranking.tool_id || index}
                          className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="w-10 text-center font-mono text-sm font-medium">
                              #{ranking.position}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{ranking.tool_name}</div>
                              <div className="text-xs text-muted-foreground">
                                Score: {ranking.score.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="text-center">
                              <div className="text-muted-foreground">Agentic</div>
                              <div className="font-medium">
                                {ranking.factor_scores?.agentic_capability?.toFixed(1) || "-"}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Tech</div>
                              <div className="font-medium">
                                {ranking.factor_scores?.technical_performance?.toFixed(1) || "-"}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Market</div>
                              <div className="font-medium">
                                {ranking.factor_scores?.market_traction?.toFixed(1) || "-"}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-muted-foreground">Dev</div>
                              <div className="font-medium">
                                {ranking.factor_scores?.developer_adoption?.toFixed(1) || "-"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 text-muted-foreground">
                    No rankings data available
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
            <CardTitle className="flex items-center justify-between">
              <span>Ranking Preview</span>
              <div className="flex items-center gap-2">
                {preview.is_initial_ranking && <Badge variant="secondary">Initial Ranking</Badge>}
                <Badge variant="outline">{format(previewDate, "MMM d, yyyy")}</Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Period: {preview.period} | Algorithm: {preview.algorithm_version} | Tools:{" "}
              {preview.total_tools}
              {preview.comparison_period && ` | Compared with: ${preview.comparison_period}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="up">Moved Up ({preview.summary.tools_moved_up})</TabsTrigger>
                <TabsTrigger value="down">
                  Moved Down ({preview.summary.tools_moved_down})
                </TabsTrigger>
                <TabsTrigger value="new">New ({preview.new_entries})</TabsTrigger>
                <TabsTrigger value="all">All Rankings</TabsTrigger>
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
                        {preview.summary.average_score_change?.toFixed(1) || "0.0"}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Score Range</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {preview.summary.lowest_score?.toFixed(1) || "0.0"} -{" "}
                        {preview.summary.highest_score?.toFixed(1) || "0.0"}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Stability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {preview.summary.tools_stayed_same} unchanged
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {preview.is_initial_ranking && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This is an initial ranking calculation as no previous rankings exist for
                      comparison. All tools will be ranked based on their scores up to{" "}
                      {format(previewDate, "MMM d, yyyy")}.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                {preview.change_report ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Movement Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{preview.change_report.narrativeSummary}</p>
                      </CardContent>
                    </Card>

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
                  </>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {preview.is_initial_ranking
                        ? "This is an initial ranking - no movement analysis available."
                        : "No detailed analysis available for this comparison."}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="up">
                <div className="space-y-2">
                  {preview.rankings_comparison
                    .filter((tool) => tool.movement === "up")
                    .sort((a, b) => b.position_change - a.position_change)
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getMovementIcon(tool.movement, tool.position_change)}
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
                          {getChangeBadge(tool.position_change, tool.movement)}
                          <div className="text-sm text-muted-foreground">
                            Score: {tool.new_score?.toFixed(2) || "0.00"}
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
                    .sort((a, b) => a.position_change - b.position_change)
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getMovementIcon(tool.movement, tool.position_change)}
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
                          {getChangeBadge(tool.position_change, tool.movement)}
                          <div className="text-sm text-muted-foreground">
                            Score: {tool.new_score?.toFixed(2) || "0.00"}
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
                    .sort((a, b) => a.new_position - b.new_position)
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg bg-green-50"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          {getMovementIcon(tool.movement, tool.position_change)}
                          <div className="flex-1">
                            <div className="font-medium">{tool.tool_name}</div>
                            <div className="text-sm text-muted-foreground">
                              New at position {tool.new_position}
                            </div>
                            {tool.change_analysis && (
                              <div className="mt-1 text-sm text-muted-foreground italic">
                                Initial ranking based on current metrics
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">NEW</Badge>
                          <div className="text-sm text-muted-foreground">
                            Score: {tool.new_score?.toFixed(2) || "0.00"}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="all">
                <div className="space-y-2">
                  {preview.rankings_comparison
                    .sort((a, b) => a.new_position - b.new_position)
                    .map((tool, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-8 text-center font-mono text-sm text-muted-foreground">
                            #{tool.new_position}
                          </div>
                          {getMovementIcon(tool.movement, tool.position_change)}
                          <div className="flex-1">
                            <div className="font-medium">{tool.tool_name}</div>
                            <div className="text-sm text-muted-foreground">
                              {tool.movement === "new"
                                ? `New entry at position ${tool.new_position}`
                                : tool.movement === "dropped"
                                  ? `Previously at position ${tool.current_position}`
                                  : `Position: ${tool.current_position} → ${tool.new_position}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getChangeBadge(tool.position_change, tool.movement)}
                          <div className="text-sm text-muted-foreground">
                            Score: {tool.new_score?.toFixed(2) || "0.00"}
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
