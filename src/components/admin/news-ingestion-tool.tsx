"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Upload,
  FileText,
  Trash2,
  Eye,
  Download,
  Link,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface IngestionReport {
  id: string;
  filename: string;
  status: string;
  total_items: number;
  processed_items: number;
  failed_items: number;
  duplicate_items: number;
  new_tools_created: number;
  new_companies_created: number;
  createdAt: string;
}

interface RollbackPreview {
  filename: string;
  news_items_to_delete: number;
  tools_to_review: number;
  companies_to_review: number;
  warnings: string[];
}

interface ArticlePreview {
  title: string;
  content: string;
  summary: string;
  author: string;
  published_date: string;
  source: string;
  source_url: string;
  tags: string[];
  tool_mentions: string[];
}

export function NewsIngestionTool() {
  const [isUploading, setIsUploading] = useState(false);
  const [generatePreview, setGeneratePreview] = useState(true);
  const [uploadResult, setUploadResult] = useState<{
    message: string;
    report_id: string;
    warnings?: string[];
  } | null>(null);
  const [reports, setReports] = useState<IngestionReport[]>([]);
  const [rollbackPreview, setRollbackPreview] = useState<RollbackPreview | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  // Manual ingestion state
  const [manualUrl, setManualUrl] = useState("");
  const [isLoadingArticle, setIsLoadingArticle] = useState(false);
  const [isSavingArticle, setIsSavingArticle] = useState(false);
  const [articlePreview, setArticlePreview] = useState<ArticlePreview | null>(null);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualSuccessMessage, setManualSuccessMessage] = useState("");

  const handleFileUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUploading(true);
    setUploadResult(null);

    const formData = new FormData(event.currentTarget);
    formData.append("generate_preview", generatePreview.toString());

    try {
      const response = await fetch("/api/admin/ingest-news", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      setUploadResult(result);

      if (result.success) {
        // Refresh reports list
        await fetchReports();
      }
    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/admin/ingestion-reports");
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    }
  };

  const fetchRollbackPreview = async (reportId: string) => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`/api/admin/rollback-ingestion?id=${reportId}`);
      if (response.ok) {
        const data = await response.json();
        setRollbackPreview(data.preview);
      }
    } catch (error) {
      console.error("Failed to fetch rollback preview:", error);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const performRollback = async (reportId: string) => {
    setIsRollingBack(true);
    try {
      const response = await fetch("/api/admin/rollback-ingestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingestion_report_id: reportId,
          confirm_rollback: true,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchReports();
        setRollbackPreview(null);
        setSelectedReportId("");
      }
      setUploadResult(result);
    } catch (error) {
      setUploadResult({
        success: false,
        error: error instanceof Error ? error.message : "Rollback failed",
      });
    } finally {
      setIsRollingBack(false);
    }
  };

  const generateSampleFiles = () => {
    const newsItems = [
      {
        title: "Example AI Tool Raises $50M Series A",
        summary: "A new AI coding assistant has secured significant funding.",
        url: "https://example.com/news/ai-tool-funding",
        source: "TechCrunch",
        author: "Jane Reporter",
        published_at: new Date().toISOString(),
        category: "funding",
        importance_score: 8,
        related_tools: ["example-ai-tool"],
        primary_tool: "example-ai-tool",
        sentiment: 0.7,
        key_topics: ["funding", "ai", "coding"],
        is_featured: true,
      },
    ];

    const removalSpec = {
      news_items: {
        urls: ["https://example.com/news/outdated-article"],
        published_before: "2024-01-01T00:00:00.000Z",
      },
      tools: {
        names: ["Deprecated Tool"],
        created_after: "2024-06-01T00:00:00.000Z",
      },
    };

    return { newsItems, removalSpec };
  };

  const downloadSampleFile = (type: "news" | "removal") => {
    const samples = generateSampleFiles();
    const content = type === "news" ? samples.newsItems : samples.removalSpec;
    const filename = type === "news" ? "sample-news-items.json" : "sample-removal-spec.json";

    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Manual ingestion functions
  const handleFetchArticle = async () => {
    if (!manualUrl.trim()) {
      setManualError("Please enter a URL");
      return;
    }

    setIsLoadingArticle(true);
    setManualError(null);
    setArticlePreview(null);
    setManualSuccess(false);

    try {
      const response = await fetch("/api/admin/fetch-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: manualUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch article");
      }

      setArticlePreview(data);
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Failed to fetch article");
    } finally {
      setIsLoadingArticle(false);
    }
  };

  const handleSaveArticle = async () => {
    if (!articlePreview) {
      return;
    }

    setIsSavingArticle(true);
    setManualError(null);

    try {
      const response = await fetch("/api/admin/manual-ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(articlePreview),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save article");
      }

      setManualSuccess(true);
      setManualSuccessMessage(`Successfully ingested: ${articlePreview.title}`);
      setArticlePreview(null);
      setManualUrl("");
    } catch (err) {
      setManualError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleInputChange = (field: keyof ArticlePreview, value: string | string[]) => {
    if (!articlePreview) {
      return;
    }
    setArticlePreview({ ...articlePreview, [field]: value });
  };

  const handleTagsChange = (value: string) => {
    const tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    handleInputChange("tags", tags);
  };

  const handleToolMentionsChange = (value: string) => {
    const mentions = value
      .split(",")
      .map((mention) => mention.trim())
      .filter(Boolean);
    handleInputChange("tool_mentions", mentions);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">News Ingestion & Data Management</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadSampleFile("news")}>
            <Download className="mr-2 h-4 w-4" />
            Sample News JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadSampleFile("removal")}>
            <Download className="mr-2 h-4 w-4" />
            Sample Removal JSON
          </Button>
        </div>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="upload">Bulk Upload</TabsTrigger>
          <TabsTrigger value="manual">Manual Add</TabsTrigger>
          <TabsTrigger value="reports">View Reports</TabsTrigger>
          <TabsTrigger value="rollback">Rollback/Remove</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload News Items</CardTitle>
              <CardDescription>
                Upload a JSON file containing news items to be ingested into the database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div className="grid w-full max-w-sm items-center gap-1.5">
                  <Label htmlFor="file">JSON File</Label>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept=".json"
                    required
                    disabled={isUploading}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="generate_preview"
                    checked={generatePreview}
                    onCheckedChange={(checked) => setGeneratePreview(!!checked)}
                  />
                  <Label
                    htmlFor="generate_preview"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Generate ranking preview after ingestion
                  </Label>
                </div>

                <Button type="submit" disabled={isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload & Process
                    </>
                  )}
                </Button>
              </form>

              {uploadResult && (
                <Alert
                  className={`mt-4 ${uploadResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}
                >
                  <AlertDescription>
                    {uploadResult.success ? (
                      <div>
                        <p className="font-medium text-green-800">{uploadResult.message}</p>
                        {uploadResult.report && (
                          <div className="mt-2 text-sm text-green-700">
                            <p>
                              Processed: {uploadResult.report.processed_items}/
                              {uploadResult.report.total_items}
                            </p>
                            <p>New Tools: {uploadResult.report.new_tools_created}</p>
                            <p>New Companies: {uploadResult.report.new_companies_created}</p>
                            {uploadResult.report.failed_items > 0 && (
                              <p>Failed: {uploadResult.report.failed_items}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="font-medium text-red-800">
                        {uploadResult.error || uploadResult.message}
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Ingestion Reports</CardTitle>
              <CardDescription>
                View all previous news ingestion reports and their status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={fetchReports} className="mb-4">
                <FileText className="mr-2 h-4 w-4" />
                Refresh Reports
              </Button>

              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{report.filename}</h3>
                      <Badge
                        variant={
                          report.status === "completed"
                            ? "default"
                            : report.status === "failed"
                              ? "destructive"
                              : report.status === "partial"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {report.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>Total: {report.total_items}</div>
                      <div>Processed: {report.processed_items}</div>
                      <div>Tools Created: {report.new_tools_created}</div>
                      <div>Companies Created: {report.new_companies_created}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(report.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rollback">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rollback Ingestion</CardTitle>
                <CardDescription>
                  Rollback a previous news ingestion and remove created data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="report-select">Select Ingestion Report</Label>
                    <select
                      id="report-select"
                      value={selectedReportId}
                      onChange={(e) => setSelectedReportId(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-md"
                    >
                      <option value="">Select a report...</option>
                      {reports
                        .filter((r) => r.status === "completed" || r.status === "partial")
                        .map((report) => (
                          <option key={report.id} value={report.id}>
                            {report.filename} - {new Date(report.createdAt).toLocaleDateString()}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => selectedReportId && fetchRollbackPreview(selectedReportId)}
                      disabled={!selectedReportId || isLoadingPreview}
                      variant="outline"
                    >
                      {isLoadingPreview ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="mr-2 h-4 w-4" />
                      )}
                      Preview Rollback
                    </Button>

                    <Button
                      onClick={() => selectedReportId && performRollback(selectedReportId)}
                      disabled={!selectedReportId || isRollingBack || !rollbackPreview}
                      variant="destructive"
                    >
                      {isRollingBack ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Confirm Rollback
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remove Data by Specification</CardTitle>
                <CardDescription>Upload a JSON file specifying data to be removed.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="removal-file">Removal Specification JSON</Label>
                    <Input
                      id="removal-file"
                      name="removal-file"
                      type="file"
                      accept=".json"
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="confirm_removal" />
                    <Label
                      htmlFor="confirm_removal"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      I confirm this data removal operation
                    </Label>
                  </div>

                  <Button type="submit" variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Data
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {rollbackPreview && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Rollback Preview</CardTitle>
                <CardDescription>
                  Preview of what will be affected by the rollback operation.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {rollbackPreview.news_items_to_delete}
                    </div>
                    <div className="text-sm text-gray-600">News Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {rollbackPreview.tools_to_review}
                    </div>
                    <div className="text-sm text-gray-600">Tools to Review</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {rollbackPreview.companies_to_review}
                    </div>
                    <div className="text-sm text-gray-600">Companies to Review</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {rollbackPreview.warnings.length}
                    </div>
                    <div className="text-sm text-gray-600">Warnings</div>
                  </div>
                </div>

                {rollbackPreview.warnings.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Warnings:</h4>
                    <div className="space-y-2">
                      {rollbackPreview.warnings.map((warning, index) => (
                        <div
                          key={index}
                          className="text-sm bg-yellow-50 border border-yellow-200 rounded p-2"
                        >
                          <strong>{warning.name}</strong>: {warning.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="manual">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add Article from URL</CardTitle>
                <CardDescription>
                  Enter a URL to fetch and parse the article content
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Input
                    type="url"
                    placeholder="https://example.com/article"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    disabled={isLoadingArticle}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleFetchArticle}
                    disabled={isLoadingArticle || !manualUrl.trim()}
                  >
                    {isLoadingArticle ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Link className="mr-2 h-4 w-4" />
                        Fetch Article
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {manualError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{manualError}</AlertDescription>
              </Alert>
            )}

            {manualSuccess && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {manualSuccessMessage} You can add another article or view all articles in the{" "}
                  <Link href="/dashboard/news-ingestion" className="underline">
                    reports tab
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            )}

            {articlePreview && (
              <Card>
                <CardHeader>
                  <CardTitle>Article Preview</CardTitle>
                  <CardDescription>
                    Review and edit the article details before saving
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={articlePreview.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="summary">Summary</Label>
                    <Textarea
                      id="summary"
                      value={articlePreview.summary}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleInputChange("summary", e.target.value)
                      }
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={articlePreview.content}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleInputChange("content", e.target.value)
                      }
                      rows={10}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="author">Author</Label>
                      <Input
                        id="author"
                        value={articlePreview.author}
                        onChange={(e) => handleInputChange("author", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="published_date">Published Date</Label>
                      <Input
                        id="published_date"
                        type="datetime-local"
                        value={articlePreview.published_date}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleInputChange("published_date", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="source">Source</Label>
                      <Input
                        id="source"
                        value={articlePreview.source}
                        onChange={(e) => handleInputChange("source", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="source_url">Source URL</Label>
                      <Input
                        id="source_url"
                        value={articlePreview.source_url}
                        onChange={(e) => handleInputChange("source_url", e.target.value)}
                        disabled
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      value={articlePreview.tags.join(", ")}
                      onChange={(e) => handleTagsChange(e.target.value)}
                      placeholder="ai, technology, innovation"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tool_mentions">Tool Mentions (comma-separated tool IDs)</Label>
                    <Input
                      id="tool_mentions"
                      value={articlePreview.tool_mentions.join(", ")}
                      onChange={(e) => handleToolMentionsChange(e.target.value)}
                      placeholder="claude, chatgpt, gemini"
                    />
                    <p className="text-sm text-muted-foreground">
                      Enter tool IDs that are mentioned in this article
                    </p>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setArticlePreview(null);
                        setManualUrl("");
                        setManualSuccess(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveArticle} disabled={isSavingArticle}>
                      {isSavingArticle ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Article"
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
