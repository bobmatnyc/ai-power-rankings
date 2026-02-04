"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Play,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  FileText,
  DollarSign,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

// Types for ingestion runs (matches database schema)
interface IngestionRun {
  id: string;
  runType: "daily_news" | "monthly_summary" | "manual";
  status: "running" | "completed" | "failed";
  articlesDiscovered: number;
  articlesPassedQuality: number;
  articlesIngested: number;
  articlesSkipped: number;
  rankingChanges: number;
  estimatedCostUsd: string | number;
  startedAt: string;
  completedAt?: string;
  searchQuery?: string;
  errorLog?: string[];
  ingestedArticleIds?: string[];
  createdAt: string;
}

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

// Status badge component
function StatusBadge({ status }: { status: IngestionRun["status"] }) {
  switch (status) {
    case "running":
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Format duration in a human-readable way
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// Format date/time
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Truncate run ID for display
function truncateId(id: string): string {
  return id.length > 8 ? `${id.substring(0, 8)}...` : id;
}

// Run type display
function RunTypeLabel({ type }: { type: IngestionRun["runType"] }) {
  switch (type) {
    case "daily_news":
      return (
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-500" />
          Daily News
        </span>
      );
    case "monthly_summary":
      return (
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-purple-500" />
          Monthly
        </span>
      );
    case "manual":
      return (
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-orange-500" />
          Manual
        </span>
      );
    default:
      return <span>{type}</span>;
  }
}

export default function AutomatedIngestionClient() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";

  // State management
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<string>("20");

  // Manual trigger state
  const [isTriggering, setIsTriggering] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [triggerSuccess, setTriggerSuccess] = useState<string | null>(null);

  // Run details modal state
  const [selectedRun, setSelectedRun] = useState<IngestionRun | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Test search panel state
  const [showTestSearch, setShowTestSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<BraveSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Fetch ingestion runs
  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/automated-ingestion?limit=${limit}`, {
        credentials: "same-origin",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch ingestion runs");
      }

      const data = await response.json();
      setRuns(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Initial fetch
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Fetch run details
  const fetchRunDetails = async (runId: string) => {
    setDetailsLoading(true);

    try {
      const response = await fetch(`/api/admin/automated-ingestion/${runId}`, {
        credentials: "same-origin",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch run details");
      }

      const data = await response.json();
      setSelectedRun(data.data || data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Trigger manual ingestion
  const triggerIngestion = async () => {
    setIsTriggering(true);
    setError(null);
    setTriggerSuccess(null);

    try {
      const response = await fetch("/api/admin/automated-ingestion", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to trigger ingestion");
      }

      const data = await response.json();
      const result = data.data; // API returns { success: true, data: {...} }
      setTriggerSuccess(
        dryRun
          ? `Dry run completed: ${result?.articlesDiscovered || 0} articles discovered, ${result?.articlesPassedQuality || 0} passed quality filter`
          : `Ingestion completed: ${result?.articlesIngested || 0} articles ingested (Run ID: ${result?.runId?.substring(0, 8) || 'unknown'})`
      );

      // Refresh the list
      fetchRuns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger ingestion");
    } finally {
      setIsTriggering(false);
    }
  };

  // Test Brave Search
  const testSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a search query");
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch("/api/admin/brave-search/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Search failed");
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={`/${lang}/admin`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Automated Ingestion</h1>
          </div>
          <p className="text-muted-foreground">
            View and manage automated article ingestion runs
          </p>
        </div>
        <Button variant="outline" onClick={fetchRuns} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Success Display */}
      {triggerSuccess && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {triggerSuccess}
          </AlertDescription>
        </Alert>
      )}

      {/* Manual Trigger Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Run Ingestion
          </CardTitle>
          <CardDescription>
            Manually trigger an article ingestion run
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="dryRun"
                checked={dryRun}
                onCheckedChange={(checked) => setDryRun(checked === true)}
              />
              <label htmlFor="dryRun" className="text-sm font-medium cursor-pointer">
                Dry Run (discover articles without ingesting)
              </label>
            </div>
          </div>

          <Button
            onClick={triggerIngestion}
            disabled={isTriggering}
            className="w-full sm:w-auto"
          >
            {isTriggering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {dryRun ? "Testing..." : "Starting Ingestion..."}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {dryRun ? "Run Dry Test" : "Run Ingestion"}
              </>
            )}
          </Button>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Note:</strong> Ingestion searches for recent AI coding news, analyzes articles,
              and stores relevant ones. Dry runs show what would be ingested without saving.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Recent Runs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Ingestion Runs</CardTitle>
              <CardDescription>
                History of automated and manual ingestion runs
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No ingestion runs found</p>
              <p className="text-sm mt-1">Trigger a manual run or wait for scheduled automation</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Discovered</TableHead>
                  <TableHead className="text-center">Passed</TableHead>
                  <TableHead className="text-center">Ingested</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      fetchRunDetails(run.id);
                    }}
                  >
                    <TableCell className="font-mono text-xs">
                      {truncateId(run.id)}
                    </TableCell>
                    <TableCell>
                      <RunTypeLabel type={run.runType} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {run.articlesDiscovered ?? 0}
                    </TableCell>
                    <TableCell className="text-center">
                      {run.articlesPassedQuality ?? 0}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {run.articlesIngested ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {Number(run.estimatedCostUsd || 0).toFixed(3)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {run.startedAt ? formatDateTime(run.startedAt) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {run.completedAt && run.startedAt
                        ? formatDuration(new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime())
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Test Search Panel (Expandable) */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowTestSearch(!showTestSearch)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <CardTitle>Test Search</CardTitle>
            </div>
            {showTestSearch ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <CardDescription>
            Test Brave Search queries to preview what articles would be discovered
          </CardDescription>
        </CardHeader>
        {showTestSearch && (
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter search query (e.g., 'AI coding assistant news')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") testSearch();
                }}
                className="flex-1"
              />
              <Button onClick={testSearch} disabled={searchLoading}>
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {searchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Found {searchResults.length} results:
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        {result.title}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {result.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {result.url}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Run Details Modal */}
      <Dialog open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Run Details
              {selectedRun && <StatusBadge status={selectedRun.status} />}
            </DialogTitle>
            <DialogDescription>
              {selectedRun && (
                <span className="font-mono text-xs">{selectedRun.id}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : selectedRun ? (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Discovered</div>
                  <div className="text-2xl font-semibold">
                    {selectedRun.articlesDiscovered ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Passed Filter</div>
                  <div className="text-2xl font-semibold">
                    {selectedRun.articlesPassedQuality ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Ingested</div>
                  <div className="text-2xl font-semibold text-primary">
                    {selectedRun.articlesIngested ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground">Est. Cost</div>
                  <div className="text-2xl font-semibold">
                    ${Number(selectedRun.estimatedCostUsd || 0).toFixed(3)}
                  </div>
                </div>
              </div>

              {/* Timing Info */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Timing</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Started:</span>{" "}
                    {selectedRun.startedAt ? formatDateTime(selectedRun.startedAt) : "-"}
                  </div>
                  {selectedRun.completedAt && (
                    <div>
                      <span className="text-muted-foreground">Completed:</span>{" "}
                      {formatDateTime(selectedRun.completedAt)}
                    </div>
                  )}
                  {selectedRun.completedAt && selectedRun.startedAt && (
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{" "}
                      {formatDuration(new Date(selectedRun.completedAt).getTime() - new Date(selectedRun.startedAt).getTime())}
                    </div>
                  )}
                </div>
              </div>

              {/* Search Query */}
              {selectedRun.searchQuery && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Search Query</h4>
                  <code className="block p-2 bg-muted rounded text-sm">
                    {selectedRun.searchQuery}
                  </code>
                </div>
              )}

              {/* Error Log */}
              {selectedRun.errorLog && selectedRun.errorLog.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-destructive">Errors</h4>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <pre className="text-xs whitespace-pre-wrap">
                        {Array.isArray(selectedRun.errorLog)
                          ? selectedRun.errorLog.join("\n")
                          : selectedRun.errorLog}
                      </pre>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Ingested Article IDs */}
              {selectedRun.ingestedArticleIds && selectedRun.ingestedArticleIds.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">
                    Ingested Articles ({selectedRun.ingestedArticleIds.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {selectedRun.ingestedArticleIds.map((id) => (
                      <div
                        key={id}
                        className="font-mono text-xs p-2 bg-muted rounded flex items-center justify-between"
                      >
                        <span>{id}</span>
                        <Link
                          href={`/${lang}/admin/news/edit/${id}`}
                          className="text-primary hover:underline text-xs"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
