"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DOMPurify from "dompurify";

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

// Safe markdown to HTML converter for preview
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML first to prevent XSS
  html = html.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#39;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links - unescape the URL part
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    const unescapedUrl = url.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    return `<a href="${unescapedUrl}" target="_blank" rel="noopener">${text}</a>`;
  });

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // Lists
  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Code blocks - unescape code content
  html = html.replace(/```([^`]+)```/g, (_match, code) => {
    const unescapedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    return `<pre><code>${unescapedCode}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    const unescapedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
    return `<code>${unescapedCode}</code>`;
  });

  // Sanitize the final HTML
  if (typeof window !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'blockquote', 'br'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false
    });
  }

  return html;
}

export default function EditNewsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params["id"] as string;

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
  const [source, setSource] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [toolMentions, setToolMentions] = useState("");
  const [importanceScore, setImportanceScore] = useState(5);

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
      // New article
      setLoading(false);
      const now = new Date().toISOString();
      setArticle({
        id: "",
        slug: "",
        title: "",
        content: "",
        published_date: now,
        created_at: now,
        updated_at: now,
      });
    }
  }, [id, loadArticle]);

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
        source,
        source_url: sourceUrl || null,
        category,
        tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        tool_mentions: toolMentions ? toolMentions.split(",").map(t => t.trim()).filter(Boolean) : [],
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
          id === "new"
            ? { action: "manual-ingest", ...updatedArticle }
            : updatedArticle
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
          <Link href="/admin/news">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to News
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">
            {id === "new" ? "Create Article" : "Edit Article"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
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
            <CardDescription>
              Edit the article content using markdown syntax
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                required
              />
            </div>

            <div>
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
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
                  <Label htmlFor="content">Content (Markdown) *</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Article content in markdown format..."
                    rows={20}
                    className="font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports markdown: **bold**, *italic*, [links](url), # headers, etc.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <div className="border rounded-md p-4 min-h-[400px] prose prose-sm max-w-none">
                  {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized with DOMPurify in markdownToHtml function */}
                  <div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              Additional information about the article
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="author">Author</Label>
                <Input
                  id="author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Author name"
                />
              </div>

              <div>
                <Label htmlFor="source">Source</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Publication source"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="sourceUrl">Source URL</Label>
              <Input
                id="sourceUrl"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., AI News, Technical Analysis"
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ai, machine-learning, gpt"
              />
            </div>

            <div>
              <Label htmlFor="toolMentions">Tool Mentions (comma-separated)</Label>
              <Input
                id="toolMentions"
                value={toolMentions}
                onChange={(e) => setToolMentions(e.target.value)}
                placeholder="GPT-4, Claude, Copilot"
              />
            </div>

            <div>
              <Label htmlFor="importanceScore">Importance Score (0-10)</Label>
              <Input
                id="importanceScore"
                type="number"
                min="0"
                max="10"
                value={importanceScore}
                onChange={(e) => setImportanceScore(parseInt(e.target.value) || 0)}
              />
            </div>

            {article && (
              <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
                <p>ID: {article.id || "Will be generated"}</p>
                <p>Created: {article.created_at ? new Date(article.created_at).toLocaleString() : "N/A"}</p>
                <p>Updated: {article.updated_at ? new Date(article.updated_at).toLocaleString() : "N/A"}</p>
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
              {/* biome-ignore lint/security/noDangerouslySetInnerHtml: Content is sanitized with DOMPurify in markdownToHtml function */}
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
            </article>
          </CardContent>
        </Card>
      )}
    </div>
  );
}