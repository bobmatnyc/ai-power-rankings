"use client";

import {
  AlertCircle,
  Bot,
  Bug,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  History,
  Loader2,
  Mail,
  Newspaper,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { SubscribersPage } from "@/components/admin/subscribers-page";
import { ArticleManagement } from "@/components/admin/article-management";
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
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

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

export default function UnifiedAdminDashboard() {
  const [activeTab, setActiveTab] = useState("news");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    type?: string;
    troubleshooting?: string[];
  } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    processingTime?: string;
    method?: string;
    timestamp?: string;
  } | null>(null);

  // News upload state
  const [newsInput, setNewsInput] = useState("");
  const [newsInputType, setNewsInputType] = useState<"url" | "text" | "file">("url");
  const [newsAnalysis, setNewsAnalysis] = useState<NewsAnalysis | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verboseLogging, setVerboseLogging] = useState(false);

  // Ranking state
  const [rankingPreview, setRankingPreview] = useState<RankingPreview | null>(null);
  const [rankingVersions, setRankingVersions] = useState<RankingVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["text/plain", "text/markdown", "application/pdf", "application/json"];

      const allowedExtensions = [".txt", ".md", ".pdf", ".json"];
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;

      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setError(`Unsupported file type. Please upload: ${allowedExtensions.join(", ")}`);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        setError("File too large. Maximum size is 10MB.");
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix (e.g., "data:text/plain;base64,")
        const base64Content = base64.split(",")[1];
        resolve(base64Content);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle news upload and analysis
  const handleNewsUpload = async () => {
    setIsProcessing(true);
    setError(null);
    setErrorDetails(null);
    setSuccess(null);
    setNewsAnalysis(null);
    setDebugInfo(null);

    try {
      let input = newsInput;
      let filename: string | undefined;
      let mimeType: string | undefined;

      // Handle file upload
      if (newsInputType === "file") {
        if (!selectedFile) {
          throw new Error("Please select a file to upload");
        }
        input = await fileToBase64(selectedFile);
        filename = selectedFile.name;
        mimeType = selectedFile.type || "text/plain";
      }

      const response = await fetch("/api/admin/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          type: newsInputType,
          filename,
          mimeType,
          verbose: verboseLogging,
          saveAsArticle: true, // Automatically save as article
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorDetails({
          type: data.type,
          troubleshooting: data.troubleshooting,
        });
        throw new Error(data.error || `Failed to analyze news: ${response.statusText}`);
      }

      setNewsAnalysis(data.analysis);
      setDebugInfo(data.debug);

      if (data.warning) {
        setError(data.warning);
      }

      // Show success message with saved article info
      if (data.savedArticle) {
        setSuccess(`News analyzed and saved! Article ID: ${data.savedArticle.id}`);
      }

      // Automatically generate ranking preview
      await generateRankingPreview(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze news");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate ranking preview based on news analysis
  const generateRankingPreview = async (analysis: NewsAnalysis) => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/admin/rankings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ news_analysis: analysis }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate ranking preview");
      }

      const data = await response.json();
      setRankingPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setIsProcessing(false);
    }
  };

  // Commit ranking changes
  const commitRankingChanges = async () => {
    if (!rankingPreview || !newsAnalysis) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/rankings/commit", {
        method: "POST",
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
      setNewsInput("");

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
      const response = await fetch("/api/admin/rankings/versions");
      if (response.ok) {
        const data = await response.json();
        setRankingVersions(data.versions);
      }
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

  // Load ranking versions on component mount
  useEffect(() => {
    loadRankingVersions();
  }, [loadRankingVersions]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI-Powered Admin Dashboard</h1>
          <p className="text-gray-600">Streamlined news ingestion and ranking management</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
            className="flex items-center gap-2"
          >
            <span>← Exit Admin</span>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              // Call logout API
              await fetch("/api/admin/auth", { method: "DELETE" });
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="news">
            <FileText className="mr-2 h-4 w-4" />
            News Upload
          </TabsTrigger>
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

        <TabsContent value="news" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Upload & Analyze News</CardTitle>
                  <CardDescription>
                    Add news via URL or text for AI-powered analysis and ranking updates
                  </CardDescription>
                </div>
                <a href="/admin/news" target="_blank" rel="noopener">
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    View All Articles
                  </Button>
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select
                  value={newsInputType}
                  onValueChange={(v) => {
                    setNewsInputType(v as "url" | "text" | "file");
                    setSelectedFile(null);
                    setNewsInput("");
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="url">
                      <Globe className="mr-2 h-4 w-4 inline" />
                      URL
                    </SelectItem>
                    <SelectItem value="text">
                      <FileText className="mr-2 h-4 w-4 inline" />
                      Text
                    </SelectItem>
                    <SelectItem value="file">
                      <Upload className="mr-2 h-4 w-4 inline" />
                      File
                    </SelectItem>
                  </SelectContent>
                </Select>

                {newsInputType === "url" ? (
                  <Input
                    placeholder="https://example.com/article"
                    value={newsInput}
                    onChange={(e) => setNewsInput(e.target.value)}
                    className="flex-1"
                  />
                ) : newsInputType === "text" ? (
                  <Textarea
                    placeholder="Paste article text here..."
                    value={newsInput}
                    onChange={(e) => setNewsInput(e.target.value)}
                    className="flex-1 min-h-[200px]"
                  />
                ) : (
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".txt,.md,.pdf,.json"
                        onChange={handleFileSelect}
                        className="flex-1"
                      />
                      {selectedFile && (
                        <Badge variant="secondary">
                          {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supported: .txt, .md, .pdf, .json (max 10MB)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="verbose"
                    checked={verboseLogging}
                    onChange={(e) => setVerboseLogging(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="verbose" className="text-sm font-normal cursor-pointer">
                    <Bug className="inline h-3 w-3 mr-1" />
                    Verbose logging (debugging)
                  </Label>
                </div>
              </div>

              <Button
                onClick={handleNewsUpload}
                disabled={(newsInputType === "file" ? !selectedFile : !newsInput) || isProcessing}
                className="w-full"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing with AI...
                  </>
                ) : (
                  <>
                    <Bot className="mr-2 h-4 w-4" />
                    Analyze News
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {newsAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <p className="text-lg font-medium">{newsAnalysis.title}</p>
                </div>

                <div>
                  <Label>Summary</Label>
                  <p className="text-gray-700">{newsAnalysis.summary}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Source</Label>
                    <p>{newsAnalysis.source}</p>
                  </div>
                  <div>
                    <Label>Published</Label>
                    <p>{new Date(newsAnalysis.published_date).toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <Label>Tool-by-Tool Rankings Impact</Label>
                  <div className="mt-3 space-y-3">
                    {newsAnalysis.tool_mentions.map((mention) => (
                      <div
                        key={`${mention.tool}-${mention.context.substring(0, 10)}`}
                        className="border rounded-lg p-3 bg-gray-50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{mention.tool}</span>
                            <Badge
                              variant={
                                mention.sentiment > 0
                                  ? "default"
                                  : mention.sentiment < 0
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="text-xs"
                            >
                              {mention.sentiment > 0 ? "+" : ""}
                              {(mention.sentiment * 100).toFixed(0)}% impact
                            </Badge>
                          </div>
                        </div>
                        {mention.context && (
                          <p className="text-xs text-gray-600 italic mb-2">
                            Context: "{mention.context.substring(0, 150)}
                            {mention.context.length > 150 ? "..." : ""}"
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Sentiment Impact:</span>
                            <span
                              className={`ml-1 font-medium ${
                                mention.sentiment > 0
                                  ? "text-green-600"
                                  : mention.sentiment < 0
                                    ? "text-red-600"
                                    : "text-gray-600"
                              }`}
                            >
                              {mention.sentiment > 0 ? "+" : ""}
                              {(mention.sentiment * 100).toFixed(0)}%
                            </span>
                          </div>
                          {mention.relevance !== undefined && (
                            <div>
                              <span className="text-gray-500">Relevance:</span>
                              <span className="ml-1 font-medium">
                                {(mention.relevance * 100).toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Key Topics</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newsAnalysis.key_topics.map((topic) => (
                      <Badge key={topic} variant="outline">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Overall Sentiment</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${newsAnalysis.overall_sentiment > 0 ? "bg-green-500" : "bg-red-500"}`}
                          style={{ width: `${Math.abs(newsAnalysis.overall_sentiment) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {(newsAnalysis.overall_sentiment * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label>Importance Score</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${newsAnalysis.importance_score * 10}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {newsAnalysis.importance_score}/10
                      </span>
                    </div>
                  </div>
                </div>

                {newsAnalysis.qualitative_metrics && (
                  <div>
                    <Label>Qualitative Metrics</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="text-sm">
                        <span className="text-gray-600">Innovation:</span>{" "}
                        <span className="font-medium">
                          +{newsAnalysis.qualitative_metrics.innovation_boost.toFixed(1)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Business:</span>{" "}
                        <span className="font-medium">
                          {newsAnalysis.qualitative_metrics.business_sentiment > 0 ? "+" : ""}
                          {newsAnalysis.qualitative_metrics.business_sentiment.toFixed(1)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Development:</span>{" "}
                        <span className="font-medium">
                          +{newsAnalysis.qualitative_metrics.development_velocity.toFixed(1)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Market:</span>{" "}
                        <span className="font-medium">
                          +{newsAnalysis.qualitative_metrics.market_traction.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {debugInfo && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-xs font-mono">Debug Information</Label>
                    <div className="mt-1 text-xs font-mono text-gray-600">
                      <p>Processing time: {debugInfo.processingTime}</p>
                      <p>Method: {debugInfo.method}</p>
                      <p>Timestamp: {debugInfo.timestamp}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

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
                          <span className="text-gray-500">{item.score.toFixed(1)}</span>
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
                          <span className="text-gray-500">{item.score.toFixed(1)}</span>
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
                                    {impact.scoreChange.toFixed(2)}
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
                                          {impact.impacts.sentiment.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.innovation !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Innovation:</span>{" "}
                                        <span className="text-blue-600">
                                          +{impact.impacts.innovation.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.business !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Business:</span>{" "}
                                        <span className="text-blue-600">
                                          +{impact.impacts.business.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.development !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Development:</span>{" "}
                                        <span className="text-blue-600">
                                          +{impact.impacts.development.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {impact.impacts.market !== 0 && (
                                      <div>
                                        <span className="text-gray-600">Market:</span>{" "}
                                        <span className="text-blue-600">
                                          +{impact.impacts.market.toFixed(2)}
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
