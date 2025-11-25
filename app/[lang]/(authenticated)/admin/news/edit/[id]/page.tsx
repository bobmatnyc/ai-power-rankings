"use client";

import { ArrowLeft, Eye, EyeOff, Loader2, Save, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

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
  contentMarkdown?: string;
}

export default function EditNewsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params["id"] as string;

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
  const [showPreview, setShowPreview] = useState(false);

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
  const [contentError, setContentError] = useState<string | null>(null);

  // Client-side markdown validation
  const validateMarkdown = (value: string): boolean => {
    const MAX_SIZE = 50 * 1024; // 50KB
    const MIN_SIZE = 10;

    if (!value || value.length < MIN_SIZE) {
      setContentError(`Article must be at least ${MIN_SIZE} characters`);
      return false;
    }

    if (value.length > MAX_SIZE) {
      setContentError(`Article too large (max ${MAX_SIZE / 1024}KB)`);
      return false;
    }

    // Check for unclosed code blocks
    const codeBlockCount = (value.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      setContentError("Invalid markdown: unclosed code block (```). Make sure all code blocks are closed.");
      return false;
    }

    // Check for malformed headers
    const malformedHeaders = /#{1,6}[a-zA-Z]/g;
    if (malformedHeaders.test(value)) {
      setContentError("Invalid markdown: headers should have a space after # (e.g., '# Header' not '#Header')");
      return false;
    }

    setContentError(null);
    return true;
  };

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
      setContent(article.contentMarkdown || article.content || "");
      setSummary(article.summary || "");
      setAuthor(article.author || "");
      // Format published_date for date input (YYYY-MM-DD)
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
      // New article - set defaults including author
      setLoading(false);
      const now = new Date().toISOString();
      const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      setArticle({
        id: "",
        slug: "",
        title: "",
        content: "",
        contentMarkdown: "",
        published_date: now,
        created_at: now,
        updated_at: now,
      });
      // Set default author and published date for new articles
      setAuthor("Robert Matsuoka");
      setPublishedDate(todayDate);
    }
  }, [id, loadArticle]);

  const handleAnalyzeContent = async () => {
    if (!content || analyzing) return;

    setAnalyzing(true);
    setError(null);

    try {
      // Call the analyze endpoint to extract category and tags
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

      // Update form fields with extracted data
      if (analysis.key_topics && Array.isArray(analysis.key_topics)) {
        // Extract category from topics if not already set
        if (!category && analysis.key_topics.length > 0) {
          // Map common topics to categories
          const topicsLower = analysis.key_topics.map((t: string) => t.toLowerCase());
          let extractedCategory = "AI News"; // Default

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

        // Set tags from key topics
        setTags(analysis.key_topics.join(", "));
      }

      // Extract tool mentions
      if (analysis.tool_mentions && Array.isArray(analysis.tool_mentions)) {
        const tools = analysis.tool_mentions.map((tm: { tool: string }) => tm.tool);
        setToolMentions(tools.join(", "));
      }

      // Update other fields if not set
      if (!title && analysis.title) {
        setTitle(analysis.title);
      }

      if (!summary && analysis.summary) {
        setSummary(analysis.summary);
      }

      if (analysis.importance_score !== undefined) {
        setImportanceScore(analysis.importance_score);
      }

      // Set author to default if not already set
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

    // Validate content before saving
    if (!validateMarkdown(content)) {
      setSaving(false);
      setError("Please fix validation errors before saving");
      return;
    }

    try {
      const updatedArticle = {
        ...article,
        title,
        content,
        contentMarkdown: content,
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
        // Redirect to edit page for the new article
        router.push(`/admin/news/edit/${result.article.id}`);
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide Preview
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show Preview
              </>
            )}
          </Button>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Article Details</CardTitle>
            <CardDescription>Edit the article content using markdown syntax</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor={titleId}>Title *</Label>
              <Input
                id={titleId}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                required
              />
            </div>

            <div>
              <Label htmlFor={summaryId}>Summary</Label>
              <Textarea
                id={summaryId}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief summary of the article"
                rows={3}
              />
            </div>

            <Tabs defaultValue="edit" className="w-full">
              <TabsList>
                <TabsTrigger value="edit">Edit Content</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <div>
                  <Label htmlFor={contentId}>Content (Markdown) *</Label>
                  <Textarea
                    id={contentId}
                    value={content}
                    onChange={(e) => {
                      const value = e.target.value;
                      setContent(value);
                      // Validate on change (debounced by user typing)
                      if (value.length > 10) {
                        validateMarkdown(value);
                      }
                    }}
                    onBlur={(e) => {
                      // Validate on blur (when user leaves field)
                      validateMarkdown(e.target.value);
                    }}
                    placeholder="Article content in markdown format..."
                    rows={20}
                    className={`font-mono text-sm ${contentError ? "border-red-500" : ""}`}
                    required
                  />
                  {contentError && (
                    <p className="text-red-500 text-sm mt-1">{contentError}</p>
                  )}
                  {!contentError && content.length > 0 && (
                    <p className="text-green-600 text-sm mt-1">
                      ✓ Valid markdown ({content.length} chars, {Math.round(content.length / 1024)}KB)
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports markdown: **bold**, *italic*, [links](url), # headers, etc.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md p-4 min-h-[400px] prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      a: ({ node, ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        />
                      ),
                    }}
                  >
                    {content || "Nothing to preview yet."}
                  </ReactMarkdown>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Additional information about the article</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                  {analyzing ? "Analyzing..." : "AI Extract"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use AI Extract to automatically derive category and tags from content
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

      {showPreview && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Full Article Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <article className="prose prose-lg max-w-none">
              <h1>{title || "Untitled Article"}</h1>
              {summary && <p className="lead">{summary}</p>}
              <ReactMarkdown
                components={{
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    />
                  ),
                }}
              >
                {content || "Nothing to preview yet."}
              </ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
