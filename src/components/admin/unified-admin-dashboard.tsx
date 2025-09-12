"use client";

import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  History,
  Loader2,
  Mail,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { SubscribersPage } from "@/components/admin/subscribers-page";
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
  const [success, setSuccess] = useState<string | null>(null);

  // News upload state
  const [newsInput, setNewsInput] = useState("");
  const [newsInputType, setNewsInputType] = useState<"url" | "text">("url");
  const [newsAnalysis, setNewsAnalysis] = useState<NewsAnalysis | null>(null);

  // Ranking state
  const [rankingPreview, setRankingPreview] = useState<RankingPreview | null>(null);
  const [rankingVersions, setRankingVersions] = useState<RankingVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  // Handle news upload and analysis
  const handleNewsUpload = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    setNewsAnalysis(null);

    try {
      const response = await fetch("/api/admin/news/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: newsInput,
          type: newsInputType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to analyze news: ${response.statusText}`);
      }

      const data = await response.json();
      setNewsAnalysis(data.analysis);

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
  const loadRankingVersions = async () => {
    try {
      const response = await fetch("/api/admin/rankings/versions");
      if (response.ok) {
        const data = await response.json();
        setRankingVersions(data.versions);
      }
    } catch (err) {
      console.error("Failed to load ranking versions:", err);
    }
  };

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

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI-Powered Admin Dashboard</h1>
        <p className="text-gray-600">Streamlined news ingestion and ranking management</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="news">
            <FileText className="mr-2 h-4 w-4" />
            News Upload
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
              <CardTitle>Upload & Analyze News</CardTitle>
              <CardDescription>
                Add news via URL or text for AI-powered analysis and ranking updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select
                  value={newsInputType}
                  onValueChange={(v) => setNewsInputType(v as "url" | "text")}
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
                  </SelectContent>
                </Select>

                {newsInputType === "url" ? (
                  <Input
                    placeholder="https://example.com/article"
                    value={newsInput}
                    onChange={(e) => setNewsInput(e.target.value)}
                    className="flex-1"
                  />
                ) : (
                  <Textarea
                    placeholder="Paste article text here..."
                    value={newsInput}
                    onChange={(e) => setNewsInput(e.target.value)}
                    className="flex-1 min-h-[200px]"
                  />
                )}
              </div>

              <Button
                onClick={handleNewsUpload}
                disabled={!newsInput || isProcessing}
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
                  <Label>Tool Mentions</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newsAnalysis.tool_mentions.map((mention) => (
                      <Badge
                        key={`${mention.tool}-${mention.context.substring(0, 10)}`}
                        variant={
                          mention.sentiment > 0
                            ? "default"
                            : mention.sentiment < 0
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {mention.tool} ({mention.sentiment > 0 ? "+" : ""}
                        {(mention.sentiment * 100).toFixed(0)}%)
                      </Badge>
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
              </CardContent>
            </Card>
          )}
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

                {rankingPreview.summary.major_movers.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Major Changes</h3>
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
