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
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

interface RankingPreview {
  period: string;
  algorithm_version: string;
  tools_count: number;
  changes: {
    moved_up: Array<{
      tool_name: string;
      old_position: number;
      new_position: number;
      position_change: number;
      old_score: number;
      new_score: number;
    }>;
    moved_down: Array<{
      tool_name: string;
      old_position: number;
      new_position: number;
      position_change: number;
      old_score: number;
      new_score: number;
    }>;
    new_entries: Array<{
      tool_name: string;
      position: number;
      score: number;
    }>;
    dropped_out: Array<{
      tool_name: string;
      old_position: number;
    }>;
  };
  summary: {
    total_changes: number;
    average_position_change: number;
    biggest_gain: {
      tool: string;
      change: number;
    };
    biggest_drop: {
      tool: string;
      change: number;
    };
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
      const response = await fetch("/api/admin/preview-rankings");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to preview rankings");
      }

      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleGenerate = async () => {
    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        "Are you sure you want to generate new rankings? This will replace the current rankings."
      )
    ) {
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
          totalChanges: preview.summary.total_changes,
          movedUp: preview.changes.moved_up.length,
          movedDown: preview.changes.moved_down.length,
          newEntries: preview.changes.new_entries.length,
          lastUpdated: new Date(),
        });
      }

      // Auto-sync after generation
      await handleSync();
    } catch (err: any) {
      setError(err.message);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) {
      return <ArrowUp className="h-4 w-4 text-green-600" />;
    }
    if (change < 0) {
      return <ArrowDown className="h-4 w-4 text-red-600" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

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
              {preview.tools_count}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="up">Moved Up ({preview.changes.moved_up.length})</TabsTrigger>
                <TabsTrigger value="down">
                  Moved Down ({preview.changes.moved_down.length})
                </TabsTrigger>
                <TabsTrigger value="new">New ({preview.changes.new_entries.length})</TabsTrigger>
                <TabsTrigger value="dropped">
                  Dropped ({preview.changes.dropped_out.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Changes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{preview.summary.total_changes}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Avg Position Change</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {preview.summary.average_position_change.toFixed(1)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Biggest Gain</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium">{preview.summary.biggest_gain.tool}</div>
                      <div className="text-lg font-bold text-green-600">
                        +{preview.summary.biggest_gain.change}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Biggest Drop</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm font-medium">{preview.summary.biggest_drop.tool}</div>
                      <div className="text-lg font-bold text-red-600">
                        {preview.summary.biggest_drop.change}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="up">
                <div className="space-y-2">
                  {preview.changes.moved_up.map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="font-medium">{tool.tool_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Position: {tool.old_position} → {tool.new_position}
                          </div>
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
                  {preview.changes.moved_down.map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        <div>
                          <div className="font-medium">{tool.tool_name}</div>
                          <div className="text-sm text-muted-foreground">
                            Position: {tool.old_position} → {tool.new_position}
                          </div>
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
                  {preview.changes.new_entries.map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg bg-green-50"
                    >
                      <div>
                        <div className="font-medium">{tool.tool_name}</div>
                        <div className="text-sm text-muted-foreground">
                          New at position {tool.position}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Score: {tool.score.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="dropped">
                <div className="space-y-2">
                  {preview.changes.dropped_out.map((tool, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg bg-red-50"
                    >
                      <div>
                        <div className="font-medium">{tool.tool_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Was at position {tool.old_position}
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
