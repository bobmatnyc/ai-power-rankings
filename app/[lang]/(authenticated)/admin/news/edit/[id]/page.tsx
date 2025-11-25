"use client";

import { ArrowLeft, CheckCircle2, Loader2, Save, Sparkles, Clock, BarChart, AlertCircle, ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CharacterCounter } from "@/components/admin/character-counter";
import { ImageUploader } from "@/components/admin/image-uploader";
import { MarkdownToolbar } from "@/components/admin/markdown-toolbar";
import { EnhancedMarkdownPreview } from "@/components/admin/enhanced-markdown-preview";
import { useAutoSave, formatTimeSince } from "@/hooks/use-auto-save";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  content: string;
  author?: string;
  published_date: string;
  source?: string;
  source_url?: string;
  tags?: string[];
  tool_mentions?: string[];
  created_at: string;
  updated_at: string;
  category?: string;
  importance_score?: number;
}

interface RankingPreviewData {
  articleId: string;
  toolChanges: Array<{
    tool: string;
    oldScore: number;
    newScore: number;
    change: number;
  }>;
  summary: {
    totalToolsAffected: number;
    averageScoreChange: number;
  };
  isPreview?: boolean;
}

export default function EditNewsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params["id"] as string;

  // Refs for textarea
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Generate unique IDs for form inputs
  const titleId = useId();
  const summaryId = useId();
  const contentId = useId();
  const authorId = useId();
  const publishedDateId = useId();
  const sourceId = useId();
  const sourceUrlId = useId();
  const categoryId = useId();
  const tagsId = useId();
  const toolMentionsId = useId();
  const importanceScoreId = useId();

  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // Ranking preview state
  const [recalculating, setRecalculating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<RankingPreviewData | null>(null);
  const [recalculationProgress, setRecalculationProgress] = useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [toolMentions, setToolMentions] = useState("");
  const [importanceScore, setImportanceScore] = useState(5);
  const [analyzing, setAnalyzing] = useState(false);

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Unsaved changes warning
  useUnsavedChangesWarning(hasUnsavedChanges);

  // Auto-save hook
  const { lastSaved, saving: autoSaving, error: autoSaveError, manualSave } = useAutoSave({
    interval: 30000, // 30 seconds
    enabled: id !== "new" && hasUnsavedChanges,
    data: article ? {
      ...article,
      title,
      content,
      summary,
      author,
      published_date: publishedDate ? new Date(publishedDate).toISOString() : new Date().toISOString(),
      source,
      source_url: sourceUrl || null,
      category,
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      tool_mentions: toolMentions
        ? toolMentions
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      importance_score: importanceScore,
    } : undefined,
    onSave: async (data) => {
      if (id === "new") return; // Don't auto-save new articles

      const response = await fetch(`/api/admin/news/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to auto-save");
      }

      setHasUnsavedChanges(false);
    },
    storageKey: `news-draft-${id}`,
  });

  const loadArticle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/news/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load article");
      }
      const data = await response.json();
      const article = data.article;

      setArticle(article);
      setTitle(article.title || "");
      setContent(article.content || "");
      setSummary(article.summary || "");
      setAuthor(article.author || "");
      const publishedDateValue = article.published_date
        ? new Date(article.published_date).toISOString().split('T')[0]
        : "";
      setPublishedDate(publishedDateValue);
      setSource(article.source || "");
      setSourceUrl(article.source_url || "");
      setCategory(article.category || "");
      setTags(article.tags?.join(", ") || "");
      setToolMentions(article.tool_mentions?.join(", ") || "");
      setImportanceScore(article.importance_score || 5);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load article");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id !== "new") {
      loadArticle();
    } else {
      setLoading(false);
      const now = new Date().toISOString();
      const todayDate = new Date().toISOString().split('T')[0];
      setArticle({
        id: "",
        slug: "",
        title: "",
        content: "",
        published_date: now,
        created_at: now,
        updated_at: now,
      });
      setAuthor("Robert Matsuoka");
      setPublishedDate(todayDate);
      setHasUnsavedChanges(false);
    }
  }, [id, loadArticle]);

  // Mark as unsaved when fields change
  useEffect(() => {
    if (!loading) {
      setHasUnsavedChanges(true);
    }
  }, [title, content, summary, author, publishedDate, source, sourceUrl, category, tags, toolMentions, importanceScore, loading]);

  const handleAnalyzeContent = async () => {
    if (!content || analyzing) return;

    setAnalyzing(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/news/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: content,
          type: "text",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze content");
      }

      const result = await response.json();
      const analysis = result.analysis;

      if (analysis.key_topics && Array.isArray(analysis.key_topics)) {
        if (!category && analysis.key_topics.length > 0) {
          const topicsLower = analysis.key_topics.map((t: string) => t.toLowerCase());
          let extractedCategory = "AI News";

          if (
            topicsLower.some(
              (t: string) =>
                t.includes("code") || t.includes("programming") || t.includes("developer")
            )
          ) {
            extractedCategory = "Code Assistant";
          } else if (
            topicsLower.some((t: string) => t.includes("llm") || t.includes("language model"))
          ) {
            extractedCategory = "LLM";
          } else if (
            topicsLower.some(
              (t: string) => t.includes("image") || t.includes("visual") || t.includes("art")
            )
          ) {
            extractedCategory = "Image Generation";
          } else if (
            topicsLower.some((t: string) => t.includes("research") || t.includes("paper"))
          ) {
            extractedCategory = "Research";
          } else if (
            topicsLower.some((t: string) => t.includes("business") || t.includes("enterprise"))
          ) {
            extractedCategory = "Enterprise";
          }

          setCategory(extractedCategory);
        }

        setTags(analysis.key_topics.join(", "));
      }

      if (analysis.tool_mentions && Array.isArray(analysis.tool_mentions)) {
        const tools = analysis.tool_mentions.map((tm: { tool: string }) => tm.tool);
        setToolMentions(tools.join(", "));
      }

      if (!title && analysis.title) {
        setTitle(analysis.title);
      }

      if (!summary && analysis.summary) {
        setSummary(analysis.summary);
      }

      if (analysis.importance_score !== undefined) {
        setImportanceScore(analysis.importance_score);
      }

      if (!author) {
        setAuthor("Robert Matsuoka");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to analyze content:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze content");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updatedArticle = {
        ...article,
        title,
        content,
        summary,
        author,
        published_date: publishedDate ? new Date(publishedDate).toISOString() : new Date().toISOString(),
        source,
        source_url: sourceUrl || null,
        category,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        tool_mentions: toolMentions
          ? toolMentions
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        importance_score: importanceScore,
        updated_at: new Date().toISOString(),
      };

      const method = id === "new" ? "POST" : "PUT";
      const url = id === "new" ? "/api/admin/news" : `/api/admin/news/${id}`;

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          id === "new" ? { action: "manual-ingest", ...updatedArticle } : updatedArticle
        ),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save article");
      }

      const result = await response.json();

      if (id === "new" && result.article?.id) {
        router.push(`/admin/news/edit/${result.article.id}`);
      } else {
        setSuccess(true);
        setHasUnsavedChanges(false);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculateRankings = useCallback(async (
    articleId: string,
    dryRun: boolean = false,
    useCachedAnalysis: boolean = false
  ) => {
    if (dryRun) {
      setRecalculating(true);
    } else {
      setApplying(true);
    }

    setRecalculationProgress("");
    setError(null);

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // Check if EventSource is available
      if (typeof window === "undefined" || !window.EventSource) {
        // Fallback to regular POST without SSE
        const response = await fetch(`/api/admin/articles/${articleId}/recalculate`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun, useCachedAnalysis }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to calculate rankings");
        }

        const data = await response.json();

        if (dryRun) {
          setPreviewData({
            articleId,
            toolChanges: data.changes || [],
            summary: data.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
            isPreview: true,
          });
          setShowPreviewModal(true);
          setRecalculating(false);
        } else {
          setApplying(false);
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        }
        return;
      }

      // Use EventSource for real-time progress updates
      const eventSource = new EventSource(
        `/api/admin/articles/${articleId}/recalculate?stream=true&dryRun=${dryRun}&useCachedAnalysis=${useCachedAnalysis}`,
        { withCredentials: true } as EventSourceInit
      );

      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          setRecalculationProgress(data.step || data.progress || "");
        } else if (data.type === "complete" || data.type === "preview") {
          if (dryRun) {
            // Preview complete, show modal
            setPreviewData({
              articleId,
              toolChanges: data.changes || [],
              summary: data.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
              isPreview: true,
            });
            setShowPreviewModal(true);
            setRecalculating(false);
          } else {
            // Application complete
            setApplying(false);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
          }

          eventSource.close();
          eventSourceRef.current = null;
        } else if (data.type === "error") {
          throw new Error(data.message || "Failed to calculate rankings");
        }
      };

      eventSource.onerror = () => {
        console.error("EventSource error");
        eventSource.close();
        eventSourceRef.current = null;

        // Fallback to regular POST if SSE fails
        fetch(`/api/admin/articles/${articleId}/recalculate`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun, useCachedAnalysis }),
        })
          .then(async (response) => {
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || "Failed to calculate rankings");
            }
            const data = await response.json();

            if (dryRun) {
              setPreviewData({
                articleId,
                toolChanges: data.changes || [],
                summary: data.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
                isPreview: true,
              });
              setShowPreviewModal(true);
              setRecalculating(false);
            } else {
              setApplying(false);
              setSuccess(true);
              setTimeout(() => setSuccess(false), 3000);
            }
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Connection error during ranking calculation");
            setRecalculating(false);
            setApplying(false);
          });
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate rankings");
      setRecalculating(false);
      setApplying(false);

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  }, []);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Handle image insertion from uploader
  const handleImageInsert = useCallback((markdown: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const newText = text.substring(0, start) + "\n" + markdown + "\n" + text.substring(end);
    setContent(newText);

    // Set focus back to textarea
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + markdown.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 100);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/${params?.["lang"] || "en"}/admin/news`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to News
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{id === "new" ? "Create Article" : "Edit Article"}</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-save status */}
          {id !== "new" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {autoSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : autoSaveError ? (
                <>
                  <span className="text-red-600">Failed to auto-save</span>
                </>
              ) : lastSaved ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  {formatTimeSince(lastSaved)}
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <Clock className="h-4 w-4" />
                  Unsaved changes
                </>
              ) : null}
            </div>
          )}

          {/* Preview Ranking Impact button */}
          {id !== "new" && article?.id && (
            <Button
              onClick={() => handleRecalculateRankings(article.id, true)}
              disabled={recalculating || !article.id}
              variant="outline"
            >
              {recalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {recalculationProgress || "Calculating..."}
                </>
              ) : (
                <>
                  <BarChart className="mr-2 h-4 w-4" />
                  Preview Impact
                </>
              )}
            </Button>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Article
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4">
          <AlertDescription>Article saved successfully!</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2 columns on desktop */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
              <CardDescription>Edit the article using markdown syntax</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor={titleId}>Title *</Label>
                  <CharacterCounter current={title.length} max={200} />
                </div>
                <Input
                  id={titleId}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title"
                  required
                  maxLength={200}
                />
              </div>

              {/* Summary */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor={summaryId}>Summary</Label>
                  <CharacterCounter current={summary.length} max={500} />
                </div>
                <Textarea
                  id={summaryId}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Brief summary of the article"
                  rows={3}
                  maxLength={500}
                />
              </div>

              {/* Content Editor with Tabs */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">Edit Content</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label htmlFor={contentId}>Content (Markdown) *</Label>
                    <CharacterCounter
                      current={content.length}
                      max={51200}
                      label="Content"
                    />
                  </div>

                  {/* Markdown Toolbar */}
                  <MarkdownToolbar
                    textareaRef={contentTextareaRef}
                    onInsert={(newText) => setContent(newText)}
                  />

                  {/* Content Textarea */}
                  <Textarea
                    ref={contentTextareaRef}
                    id={contentId}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Article content in markdown format..."
                    rows={20}
                    className="font-mono text-sm"
                    required
                    maxLength={51200}
                  />

                  <p className="text-xs text-muted-foreground">
                    Supports GitHub Flavored Markdown: **bold**, *italic*, [links](url), # headers, tables, task lists, code blocks with syntax highlighting
                  </p>
                </TabsContent>

                <TabsContent value="preview">
                  <div className="border rounded-md p-6 min-h-[400px] max-h-[600px] overflow-y-auto bg-background">
                    <EnhancedMarkdownPreview content={content} />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Image Uploader */}
              <div>
                <Label className="mb-2 block">Insert Image</Label>
                <ImageUploader onImageInsert={handleImageInsert} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metadata Sidebar - 1 column */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>Additional information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor={authorId}>Author</Label>
                  <Input
                    id={authorId}
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Author name"
                  />
                </div>

                <div>
                  <Label htmlFor={publishedDateId}>Published Date</Label>
                  <Input
                    id={publishedDateId}
                    type="date"
                    value={publishedDate}
                    onChange={(e) => setPublishedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor={sourceId}>Source</Label>
                  <Input
                    id={sourceId}
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Publication source"
                  />
                </div>

                <div>
                  <Label htmlFor={sourceUrlId}>Source URL</Label>
                  <Input
                    id={sourceUrlId}
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.com/article"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor={categoryId}>Category</Label>
                <div className="flex gap-2">
                  <Input
                    id={categoryId}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., AI News, Technical Analysis"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAnalyzeContent}
                    disabled={!content || analyzing}
                    title="Analyze content to extract category and tags"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use AI Extract to auto-generate metadata
                </p>
              </div>

              <div>
                <Label htmlFor={tagsId}>Tags (comma-separated)</Label>
                <Input
                  id={tagsId}
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ai, machine-learning, gpt"
                />
              </div>

              <div>
                <Label htmlFor={toolMentionsId}>Tool Mentions (comma-separated)</Label>
                <Input
                  id={toolMentionsId}
                  value={toolMentions}
                  onChange={(e) => setToolMentions(e.target.value)}
                  placeholder="GPT-4, Claude, Copilot"
                />
              </div>

              <div>
                <Label htmlFor={importanceScoreId}>Importance Score (0-10)</Label>
                <Input
                  id={importanceScoreId}
                  type="number"
                  min="0"
                  max="10"
                  value={importanceScore}
                  onChange={(e) => setImportanceScore(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              {article && (
                <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                  <p>ID: {article.id || "Will be generated"}</p>
                  <p>
                    Created:{" "}
                    {article.created_at ? new Date(article.created_at).toLocaleString() : "N/A"}
                  </p>
                  <p>
                    Updated:{" "}
                    {article.updated_at ? new Date(article.updated_at).toLocaleString() : "N/A"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Ranking Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>Preview Ranking Changes</CardTitle>
              <CardDescription>
                These are the predicted changes to tool rankings if this article affects global scoring.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto space-y-4">
              {/* Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Impact Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Tools Affected</p>
                      <p className="text-2xl font-bold">
                        {previewData.summary.totalToolsAffected}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Avg Score Change</p>
                      <p className="text-2xl font-bold">
                        {previewData.summary.averageScoreChange > 0 ? "+" : ""}
                        {previewData.summary.averageScoreChange.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tool Changes */}
              {previewData.toolChanges.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Proposed Tool Score Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {previewData.toolChanges.map((change, index) => (
                        <div
                          key={`${change.tool}-${index}`}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <span className="font-medium">{change.tool}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">
                                Score: {change.oldScore.toFixed(1)}
                              </span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="font-medium">{change.newScore.toFixed(1)}</span>
                            </div>
                            <Badge
                              variant={
                                change.change > 0
                                  ? "default"
                                  : change.change < 0
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {change.change > 0 ? "+" : ""}
                              {change.change.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No Changes */}
              {previewData.toolChanges.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No ranking changes detected. The article&apos;s current impact on rankings is accurate.
                  </AlertDescription>
                </Alert>
              )}

              {/* Info about caching */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The AI analysis has been cached. Clicking &quot;Apply Changes&quot; will use this cached analysis for faster processing.
                </AlertDescription>
              </Alert>
            </CardContent>

            <div className="p-6 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreviewModal(false);
                  setPreviewData(null);
                }}
                disabled={applying}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (previewData?.articleId) {
                    handleRecalculateRankings(previewData.articleId, false, true);
                    setShowPreviewModal(false);
                  }
                }}
                disabled={applying || previewData.toolChanges.length === 0}
              >
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
