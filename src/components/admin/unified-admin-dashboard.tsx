"use client";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  Loader2,
  Mail,
  Newspaper,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ArticleManagement } from "@/components/admin/article-management";
import { SubscribersPage } from "@/components/admin/subscribers-page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface NewsAnalysis {
  title: string;
  summary: string;
  source: string;
  url: string;
  published_date: string;
  tool_mentions: Array<{
    tool: string;
    context: string;
    sentiment: number;
    relevance?: number;
  }>;
  overall_sentiment: number;
  key_topics: string[];
  importance_score: number;
  qualitative_metrics?: {
    innovation_boost: number;
    business_sentiment: number;
    development_velocity: number;
    market_traction: number;
  };
}

interface RankingPreview {
  current: Array<{
    rank: number;
    tool: string;
    score: number;
    change: number;
  }>;
  proposed: Array<{
    rank: number;
    tool: string;
    score: number;
    change: number;
    reason?: string;
  }>;
  summary: {
    total_changes: number;
    major_movers: Array<{
      tool: string;
      from: number;
      to: number;
      reason: string;
    }>;
  };
  toolImpacts?: Array<{
    tool: string;
    currentRank: number;
    proposedRank: number;
    rankChange: number;
    scoreChange: number;
    mentioned: boolean;
    impacts: {
      sentiment: number;
      innovation: number;
      business: number;
      development: number;
      market: number;
    };
  }>;
}

interface RankingVersion {
  id: string;
  version: string;
  created_at: string;
  created_by: string;
  changes_summary: string;
  news_items_count: number;
  rankings_snapshot: Array<{
    rank: number;
    tool: string;
    score: number;
    change: number;
  }>;
}

interface DatabaseStatus {
  connected: boolean;
  enabled: boolean;
  configured: boolean;
  hasActiveInstance: boolean;
  environment: string;
  nodeEnv: string;
  database: string;
  host: string;
  maskedHost?: string;
  provider: string;
  timestamp: string;
  status: string;
  type?: "postgresql" | "json";
  displayEnvironment?: "development" | "production" | "local";
}

export default function UnifiedAdminDashboard() {
  const [activeTab, setActiveTab] = useState("articles");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails] = useState<{
    type?: string;
    troubleshooting?: string[];
  } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [showDbStatus, setShowDbStatus] = useState(true);
  const [isLoadingDbStatus, setIsLoadingDbStatus] = useState(true);

  // News upload state (kept for ranking preview functionality)
  const [newsAnalysis, setNewsAnalysis] = useState<NewsAnalysis | null>(null);

  // Ranking state
  const [rankingPreview, setRankingPreview] = useState<RankingPreview | null>(null);
  const [rankingVersions, setRankingVersions] = useState<RankingVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  // Removed unused file handling functions - file upload now handled in ArticleManagement component

  // Commit ranking changes
  const commitRankingChanges = async () => {
    if (!rankingPreview || !newsAnalysis) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/rankings/commit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: rankingPreview,
          news_analysis: newsAnalysis,
          commit_message: `Updated rankings based on news: ${newsAnalysis.title}`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to commit ranking changes");
      }

      const data = await response.json();
      setSuccess(`Successfully updated rankings (Version ${data.version})`);

      // Reset states
      setNewsAnalysis(null);
      setRankingPreview(null);

      // Reload versions
      await loadRankingVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to commit changes");
    } finally {
      setIsProcessing(false);
    }
  };

  // Load ranking versions
  const loadRankingVersions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/rankings/versions", {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Authentication required for ranking versions");
        } else {
          console.error(`Failed to load ranking versions: ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      setRankingVersions(data.versions);
    } catch (err) {
      console.error("Failed to load ranking versions:", err);
    }
  }, []);

  // Rollback to a specific version
  const rollbackToVersion = async (versionId: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/rankings/rollback/${versionId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to rollback rankings");
      }

      setSuccess(`Successfully rolled back to version ${versionId}`);
      await loadRankingVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rollback");
    } finally {
      setIsProcessing(false);
    }
  };

  // Load database status
  const loadDatabaseStatus = useCallback(async () => {
    setIsLoadingDbStatus(true);

    // Don't load DB status if we've already closed it
    if (!showDbStatus) {
      setIsLoadingDbStatus(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/db-status", {
        credentials: "include", // Include cookies for authentication
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Try to get the response as text for debugging
        const text = await response.text();

        // Check if it's an HTML error page
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          // This might be a 404 or routing issue - fallback to JSON mode
          setDbStatus({
            connected: false,
            enabled: false,
            configured: false,
            hasActiveInstance: false,
            environment: "local",
            nodeEnv: "development",
            database: "json",
            host: "localhost",
            maskedHost: "localhost",
            provider: "json",
            timestamp: new Date().toISOString(),
            status: "json_mode",
            type: "json" as const,
            displayEnvironment: "local" as const,
          });
        }
        return;
      }

      if (!response.ok) {
        // Handle errors silently
        if (response.status === 401) {
          // Authentication error - In production, this means user needs to authenticate
          // In local development, this shouldn't happen anymore as auth is skipped
          console.log("Database status authentication check (should not happen in local dev)");
          setIsLoadingDbStatus(false);
          return;
        } else if (response.status === 404) {
          // API route doesn't exist - use JSON mode
          setDbStatus({
            connected: false,
            enabled: false,
            configured: false,
            hasActiveInstance: false,
            environment: "local",
            nodeEnv: "development",
            database: "json",
            host: "localhost",
            maskedHost: "localhost",
            provider: "json",
            timestamp: new Date().toISOString(),
            status: "json_mode",
            type: "json" as const,
            displayEnvironment: "local" as const,
          });
        }
        return;
      }

      // Parse the successful JSON response
      try {
        const data = await response.json();
        setDbStatus(data);
      } catch (parseError) {
        console.error("Failed to parse database status response:", parseError);
      }
    } catch (err) {
      // Network error - fallback to JSON mode silently
      if (err instanceof TypeError && err.message.includes("fetch")) {
        setDbStatus({
          connected: false,
          enabled: false,
          configured: false,
          hasActiveInstance: false,
          environment: "local",
          nodeEnv: "development",
          database: "json",
          host: "localhost",
          maskedHost: "localhost",
          provider: "json",
          timestamp: new Date().toISOString(),
          status: "json_mode",
          type: "json" as const,
          displayEnvironment: "local" as const,
        });
      }
    } finally {
      setIsLoadingDbStatus(false);
    }
  }, [showDbStatus]);

  // Load ranking versions and database status on component mount
  useEffect(() => {
    loadRankingVersions();
    // Add a small delay before loading database status to ensure cookies are properly set
    if (showDbStatus) {
      const timer = setTimeout(() => {
        loadDatabaseStatus();
      }, 100); // Small delay to ensure authentication is ready

      return () => clearTimeout(timer);
    }
    return undefined; // Explicit return for when showDbStatus is false
  }, [loadRankingVersions, loadDatabaseStatus, showDbStatus]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Database Status Indicator */}
      {showDbStatus && (
        <Card
          className="mb-4 border-l-4"
          style={{
            borderLeftColor:
              dbStatus?.type === "json"
                ? "#3b82f6"
                : // Blue for JSON
                  dbStatus?.displayEnvironment === "development"
                  ? "#10b981"
                  : // Green for Dev
                    dbStatus?.displayEnvironment === "production"
                    ? "#ef4444"
                    : // Red for Prod
                      "#6b7280", // Gray for unknown
          }}
        >
          <CardContent className="py-3 px-4">
            {isLoadingDbStatus ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                <span className="text-sm text-gray-600">Loading database status...</span>
              </div>
            ) : dbStatus ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database
                      className={`h-5 w-5 ${
                        dbStatus.type === "json"
                          ? "text-blue-600"
                          : dbStatus.displayEnvironment === "development"
                            ? "text-green-600"
                            : dbStatus.displayEnvironment === "production"
                              ? "text-red-600"
                              : "text-gray-600"
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Database:</span>

                      {/* Environment Badge */}
                      <Badge
                        variant={
                          dbStatus.type === "json"
                            ? "secondary"
                            : dbStatus.displayEnvironment === "development"
                              ? "default"
                              : "destructive"
                        }
                        className={`text-xs ${
                          dbStatus.type === "json"
                            ? "bg-blue-100 text-blue-800 border-blue-200"
                            : dbStatus.displayEnvironment === "development"
                              ? "bg-green-100 text-green-800 border-green-200"
                              : "bg-red-100 text-red-800 border-red-200"
                        }`}
                      >
                        {dbStatus.type === "json"
                          ? "JSON Files"
                          : dbStatus.displayEnvironment === "development"
                            ? "Development"
                            : "Production"}
                      </Badge>

                      <span className="text-sm text-gray-600">|</span>

                      {/* Database Name */}
                      {dbStatus.type !== "json" && (
                        <>
                          <span className="text-sm font-mono text-gray-700">
                            {dbStatus.database}
                          </span>
                          <span className="text-sm text-gray-600">|</span>
                        </>
                      )}

                      {/* Host (masked) */}
                      {dbStatus.type !== "json" &&
                        dbStatus.maskedHost &&
                        dbStatus.maskedHost !== "N/A" && (
                          <>
                            <span className="text-sm font-mono text-gray-500">
                              {dbStatus.maskedHost}
                            </span>
                            <span className="text-sm text-gray-600">|</span>
                          </>
                        )}

                      {/* Connection Status */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${
                              dbStatus.type === "json"
                                ? "bg-blue-500"
                                : dbStatus.connected
                                  ? "bg-green-500"
                                  : "bg-red-500"
                            }`}
                          />
                          {dbStatus.type !== "json" && dbStatus.connected && (
                            <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-green-500 animate-ping" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {dbStatus.type === "json"
                            ? "JSON Mode"
                            : dbStatus.connected
                              ? "Connected"
                              : "Disconnected"}
                        </span>
                      </div>

                      {/* Provider Badge */}
                      {dbStatus.type !== "json" &&
                        dbStatus.provider &&
                        dbStatus.provider !== "N/A" && (
                          <>
                            <span className="text-sm text-gray-600">|</span>
                            <Badge variant="outline" className="text-xs uppercase">
                              {dbStatus.provider}
                            </Badge>
                          </>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadDatabaseStatus}
                      disabled={isLoadingDbStatus}
                      className="h-7 px-2"
                      title="Refresh database status"
                    >
                      {isLoadingDbStatus ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <History className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDbStatus(false)}
                      className="h-7 w-7 p-0"
                      title="Hide database status"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Status Messages */}
                {dbStatus.type === "json" && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                    <span className="text-xs text-blue-700">
                      Using local JSON file storage. Database features disabled.
                    </span>
                  </div>
                )}
                {dbStatus.type !== "json" && !dbStatus.connected && dbStatus.configured && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-red-500" />
                    <span className="text-xs text-red-600">
                      Database is configured but not connected. Check your connection settings.
                    </span>
                  </div>
                )}
                {dbStatus.type !== "json" && !dbStatus.configured && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-1 w-1 rounded-full bg-yellow-500" />
                    <span className="text-xs text-yellow-700">
                      Database not configured. Set DATABASE_URL to enable PostgreSQL.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">Database status pending...</span>
                </div>
                <Button variant="ghost" size="sm" onClick={loadDatabaseStatus} className="h-7 px-2">
                  <History className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI-Powered Admin Dashboard</h1>
          <p className="text-gray-600">Streamlined news ingestion and ranking management</p>
        </div>
        <div className="flex gap-2">
          {!showDbStatus && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDbStatus(true)}
              className="flex items-center gap-2"
              title="Show database status"
            >
              <Database className="h-4 w-4" />
              <span>DB Status</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
            className="flex items-center gap-2"
          >
            <span>← Exit Admin</span>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              // Call logout API
              await fetch("/api/admin/auth", {
                method: "DELETE",
                credentials: "include",
              });
              window.location.href = "/admin/auth/signin";
            }}
            className="flex items-center gap-2"
          >
            <span>Logout</span>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant={errorDetails?.type ? "destructive" : "default"} className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{error}</p>
              {errorDetails?.type && (
                <p className="text-sm text-muted-foreground">
                  Error type: {errorDetails.type.replace(/_/g, " ")}
                </p>
              )}
              {errorDetails?.troubleshooting && (
                <div className="mt-2">
                  <p className="text-sm font-medium">Troubleshooting steps:</p>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground">
                    {errorDetails.troubleshooting.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="articles">
            <Newspaper className="mr-2 h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="rankings">
            <TrendingUp className="mr-2 h-4 w-4" />
            Rankings
          </TabsTrigger>
          <TabsTrigger value="versions">
            <History className="mr-2 h-4 w-4" />
            Version History
          </TabsTrigger>
          <TabsTrigger value="subscribers">
            <Mail className="mr-2 h-4 w-4" />
            Subscribers
          </TabsTrigger>
        </TabsList>

        {/* Removed News Upload tab content - Article Management now handles file uploads */}

        <TabsContent value="articles" className="space-y-6">
          <ArticleManagement />
        </TabsContent>

        <TabsContent value="rankings" className="space-y-6">
          {rankingPreview ? (
            <Card>
              <CardHeader>
                <CardTitle>Ranking Preview</CardTitle>
                <CardDescription>Review changes before committing to the database</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Current Rankings</h3>
                    <div className="space-y-2">
                      {rankingPreview.current.slice(0, 10).map((item) => (
                        <div key={item.tool} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="w-8 text-center">
                              {item.rank}
                            </Badge>
                            {item.tool}
                          </span>
                          <span className="text-gray-500">{(item.score || 0).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Proposed Rankings</h3>
                    <div className="space-y-2">
                      {rankingPreview.proposed.slice(0, 10).map((item) => (
                        <div key={item.tool} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <Badge
                              variant={
                                item.change > 0
                                  ? "default"
                                  : item.change < 0
                                    ? "destructive"
                                    : "outline"
                              }
                              className="w-8 text-center"
                            >
                              {item.rank}
                            </Badge>
                            {item.tool}
                            {item.change !== 0 && (
                              <span
                                className={`text-xs ${item.change > 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                {item.change > 0 ? (
                                  <ChevronLeft className="h-3 w-3 inline" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 inline" />
                                )}
                                {Math.abs(item.change)}
                              </span>
                            )}
                          </span>
                          <span className="text-gray-500">{(item.score || 0).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {rankingPreview.toolImpacts && rankingPreview.toolImpacts.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Tool-by-Tool Impact Analysis</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Tool</th>
                            <th className="text-center py-2">Current</th>
                            <th className="text-center py-2">Proposed</th>
                            <th className="text-center py-2">Rank Change</th>
                            <th className="text-center py-2">Score Impact</th>
                            <th className="text-left py-2">Impact Breakdown</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rankingPreview.toolImpacts.map((impact) => (
                            <tr
                              key={impact.tool}
                              className={`border-b ${impact.mentioned ? "bg-blue-50" : ""}`}
                            >
                              <td className="py-2 font-medium">
                                {impact.tool}
                                {impact.mentioned && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    Mentioned
                                  </Badge>
                                )}
                              </td>
                              <td className="text-center py-2">
                                <Badge variant="outline">{impact.currentRank}</Badge>
                              </td>
                              <td className="text-center py-2">
                                <Badge
                                  variant={
                                    impact.rankChange > 0
                                      ? "default"
                                      : impact.rankChange < 0
                                        ? "destructive"
                                        : "outline"
                                  }
                                >
                                  {impact.proposedRank}
                                </Badge>
                              </td>
                              <td className="text-center py-2">
                                {impact.rankChange !== 0 && (
                                  <span
                                    className={
                                      impact.rankChange > 0 ? "text-green-600" : "text-red-600"
                                    }
                                  >
                                    {impact.rankChange > 0 ? "↑" : "↓"}{" "}
                                    {Math.abs(impact.rankChange)}
                                  </span>
                                )}
                                {impact.rankChange === 0 && (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="text-center py-2">
                                {impact.scoreChange !== 0 ? (
                                  <span
                                    className={
                                      impact.scoreChange > 0 ? "text-green-600" : "text-red-600"
                                    }
                                  >
                                    {impact.scoreChange > 0 ? "+" : ""}
                                    {(impact.scoreChange || 0).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="py-2">
                                {impact.mentioned ? (
                                  <div className="text-xs space-y-1">
                                    {impact.impacts.sentiment !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Sentiment:</span>{" "}
                                        <span
                                          className={
                                            impact.impacts.sentiment > 0
                                              ? "text-green-600"
                                              : "text-red-600"
                                          }
                                        >
                                          {impact.impacts.sentiment > 0 ? "+" : ""}
                                          {(impact.impacts.sentiment || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.innovation !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Innovation:</span>{" "}
                                        <span className="text-blue-600">
                                          +{(impact.impacts.innovation || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.business !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Business:</span>{" "}
                                        <span className="text-blue-600">
                                          +{(impact.impacts.business || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.development !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Development:</span>{" "}
                                        <span className="text-blue-600">
                                          +{(impact.impacts.development || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.market !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Market:</span>{" "}
                                        <span className="text-blue-600">
                                          +{(impact.impacts.market || 0).toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Indirect impact</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {rankingPreview.summary.major_movers.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Major Changes Summary</h3>
                    <div className="space-y-2">
                      {rankingPreview.summary.major_movers.map((mover) => (
                        <div
                          key={`${mover.tool}-${mover.from}-${mover.to}`}
                          className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded"
                        >
                          <span className="font-medium">{mover.tool}</span>
                          <span className="text-gray-600">
                            #{mover.from} → #{mover.to}
                          </span>
                          <span className="text-gray-500 text-xs">{mover.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator className="my-6" />

                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setRankingPreview(null)}>
                    Cancel
                  </Button>
                  <Button onClick={commitRankingChanges} disabled={isProcessing}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Committing...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Commit Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Ranking Preview</CardTitle>
                <CardDescription>
                  Upload and analyze news to generate a ranking preview
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="versions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ranking Version History</CardTitle>
              <CardDescription>View and rollback to previous ranking versions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={loadRankingVersions} variant="outline" className="mb-4">
                <History className="mr-2 h-4 w-4" />
                Load Versions
              </Button>

              {rankingVersions.length > 0 ? (
                <div className="space-y-4">
                  {rankingVersions.map((version) => (
                    <div
                      key={version.id}
                      className={`border rounded-lg p-4 ${selectedVersion === version.id ? "border-blue-500 bg-blue-50" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-semibold">Version {version.version}</h4>
                          <p className="text-sm text-gray-600">
                            {new Date(version.created_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{version.news_items_count} news items</Badge>
                          <Button
                            size="sm"
                            variant={selectedVersion === version.id ? "default" : "outline"}
                            onClick={() => setSelectedVersion(version.id)}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{version.changes_summary}</p>
                      <p className="text-xs text-gray-500 mt-1">By {version.created_by}</p>

                      {selectedVersion === version.id && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            onClick={() => rollbackToVersion(version.id)}
                            variant="destructive"
                            size="sm"
                            disabled={isProcessing}
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Rolling back...
                              </>
                            ) : (
                              <>
                                <History className="mr-2 h-4 w-4" />
                                Rollback to this version
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No version history available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscribers">
          <SubscribersPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
