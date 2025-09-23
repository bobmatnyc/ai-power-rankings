"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  Link,
  Loader2,
  Newspaper,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface Article {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  content?: string;
  sourceUrl?: string;
  sourceName?: string;
  author?: string;
  publishedDate?: string | Date | null;
  ingestedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  category?: string;
  tags?: string[];
  toolMentions?:
    | Array<{
        tool: string;
        relevance: number;
        sentiment: number;
        context: string;
      }>
    | Record<string, unknown>[]
    | null;
  companyMentions?: Record<string, unknown>[] | null;
  rankingsSnapshot?: Record<string, unknown>;
  status: string;
  isProcessed?: boolean;
  processedAt?: string | Date | null;
  importanceScore?: number;
  sentimentScore?: string | number;
  ingestionType?: string;
  fileName?: string;
  fileType?: string;
  ingestedBy?: string;
}

interface ArticleStats {
  totalArticles: number;
  articlesThisMonth: number;
  articlesLastMonth: number;
  averageToolMentions: number;
  topCategories: Array<{ category: string; count: number }>;
}

interface IngestionPreview {
  article: Partial<Article> & {
    model?: string;
  };
  impactedTools: Array<{
    tool: string;
    currentScore: number;
    newScore: number;
    change: number;
  }>;
  newTools: string[];
  summary: {
    totalToolsAffected: number;
    totalNewTools: number;
    averageScoreChange: number;
  };
}

interface RecalcProgress {
  articleId: string;
  progress: number;
  step: string;
  isActive: boolean;
}

interface RecalcResult {
  articleId: string;
  toolChanges: Array<{
    tool: string;
    oldScore: number;
    newScore: number;
    change: number;
    oldRank?: number;
    newRank?: number;
  }>;
  summary: {
    totalToolsAffected: number;
    averageScoreChange: number;
  };
  isPreview?: boolean;
}

export function ArticleManagement() {
  const [activeTab, setActiveTab] = useState("add");
  const [articles, setArticles] = useState<Article[]>([]);
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Recalculation progress tracking
  const [recalcProgress, setRecalcProgress] = useState<Map<string, RecalcProgress>>(new Map());
  const [recalcResults, setRecalcResults] = useState<RecalcResult | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showRecalcPreviewModal, setShowRecalcPreviewModal] = useState(false);
  const [recalcPreviewData, setRecalcPreviewData] = useState<RecalcResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // EventSource references for cleanup
  const eventSourcesRef = useRef<Map<string, EventSource>>(new Map());

  // Add Article State
  const [ingestionType, setIngestionType] = useState<"url" | "text" | "file">("url");
  const [inputContent, setInputContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    author: "",
    category: "",
    tags: "",
    fileName: "",
    fileType: "",
  });
  const [preview, setPreview] = useState<IngestionPreview | null>(null);
  const [savedPreviewData, setSavedPreviewData] = useState<IngestionPreview | null>(null);
  const [workflowStep, setWorkflowStep] = useState<"input" | "preview" | "saved">("input");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState<string>("");

  // Edit Article State
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editContent, setEditContent] = useState({
    title: "",
    content: "",
    summary: "",
  });

  const loadArticles = useCallback(async () => {
    try {
      // Try new articles endpoint first
      let response = await fetch("/api/admin/articles?includeStats=true", {
        credentials: "include",
      });

      // If articles endpoint fails (503 = no database table), fallback to news endpoint
      if (response.status === 503 || response.status === 500) {
        console.log("Articles table not found, falling back to news endpoint");
        response = await fetch("/api/admin/news/list", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load articles from both endpoints");
        }

        const newsData = await response.json();
        // Map news data to article format
        const mappedArticles = (newsData.articles || []).map((article: any) => ({
          id: article.id,
          title: article.title,
          summary: article.summary,
          content: article.content,
          slug: article.slug,
          status: article.status || "active",
          publishedDate: article.publishedAt || article.published_date || article.created_at,
          // Add date fields that the UI expects
          createdAt: article.created_at || article.publishedAt || article.published_date,
          ingestedAt:
            article.ingested_at ||
            article.created_at ||
            article.publishedAt ||
            article.published_date,
          author: article.author,
          category: article.category,
          tags: article.tags || [],
          toolMentions: article.toolMentions || [],
        }));
        setArticles(mappedArticles);
        setStats(newsData.stats || null);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load articles");
      }

      const data = await response.json();
      setArticles(data.articles || []);
      setStats(data.stats || null);
    } catch (err) {
      setError("Failed to load articles");
      console.error(err);
    }
  }, []);

  // Load articles on mount and cleanup EventSources on unmount
  useEffect(() => {
    loadArticles();

    // Cleanup function to close all EventSources on unmount
    return () => {
      eventSourcesRef.current.forEach((eventSource, articleId) => {
        console.log(`Cleaning up EventSource for article ${articleId}`);
        eventSource.close();
      });
      eventSourcesRef.current.clear();
    };
  }, [loadArticles]);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProcessingProgress(0);
    setProcessingStep("Initializing...");

    try {
      // Simulate progress updates
      setProcessingProgress(10);
      setProcessingStep("Preparing content...");
      // Handle file upload if needed
      let finalInputContent = inputContent;
      if (ingestionType === "file" && selectedFile) {
        setProcessingProgress(20);
        setProcessingStep("Reading file...");
        finalInputContent = await readFileContent(selectedFile);
      }

      setProcessingProgress(30);
      setProcessingStep("Analyzing with AI...");

      setProcessingProgress(40);
      setProcessingStep("Sending to Claude AI...");

      const response = await fetch("/api/admin/articles/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: ingestionType === "file" ? "text" : ingestionType,
          input: finalInputContent,
          dryRun: true,
          metadata: {
            author: metadata.author || undefined,
            category: metadata.category || undefined,
            tags: metadata.tags ? metadata.tags.split(",").map((t) => t.trim()) : undefined,
            fileName: metadata.fileName || undefined,
            fileType: metadata.fileType || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to preview article");
      }

      setProcessingProgress(60);
      setProcessingStep("Processing AI response...");

      const data = await response.json();

      setProcessingProgress(80);
      setProcessingStep("Calculating ranking impacts...");

      // Extract the result from the response
      if (data.success && data.result) {
        // Map predictedChanges to impactedTools for the UI with correct field names
        const mappedResult = {
          ...data.result,
          impactedTools: (data.result.predictedChanges || []).map(
            (change: {
              toolName?: string;
              tool?: string;
              currentScore?: number;
              predictedScore?: number;
              newScore?: number;
            }) => ({
              tool: change.toolName || change.tool || "Unknown Tool",
              currentScore: change.currentScore || 0,
              newScore: change.predictedScore || change.newScore || 0,
              change: (change.predictedScore || change.newScore || 0) - (change.currentScore || 0),
            })
          ),
          newTools:
            data.result.newTools?.map((t: { name?: string; tool?: string } | string) =>
              typeof t === "string" ? t : t.name || t.tool
            ) || [],
        };
        setProcessingProgress(100);
        setProcessingStep("Complete!");
        setPreview(mappedResult);
        setSavedPreviewData(data.result); // Store the raw result for save operation
        setWorkflowStep("preview");
        setSuccess(data.message || "Preview generated successfully!");
      } else {
        throw new Error(data.error || "Failed to generate preview");
      }
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      setProcessingProgress(0);
      setProcessingStep("");
    } finally {
      setLoading(false);
      // Reset progress after a delay
      setTimeout(() => {
        setProcessingProgress(0);
        setProcessingStep("");
      }, 2000);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setProcessingProgress(0);
    setProcessingStep("Preparing article...");

    try {
      let response: Response;
      let data: { success?: boolean; message?: string; error?: string; result?: unknown };

      // Check if we have preprocessed data from preview
      if (savedPreviewData) {
        // Use the cached analysis - MUCH faster!
        setProcessingProgress(25);
        setProcessingStep("Using cached analysis...");

        const requestBody = {
          type: "preprocessed" as const,
          preprocessedData: savedPreviewData,
          dryRun: false,
          metadata: {
            author: metadata.author || undefined,
            category: metadata.category || undefined,
            tags: metadata.tags ? metadata.tags.split(",").map((t) => t.trim()) : undefined,
            fileName: metadata.fileName || undefined,
            fileType: metadata.fileType || undefined,
          },
        };

        setProcessingProgress(50);
        setProcessingStep("Saving to database...");

        response = await fetch("/api/admin/articles/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(requestBody),
        });

        // If articles table doesn't exist, fallback to news endpoint
        if (response.status === 503 || response.status === 500) {
          console.log("Articles table not found, falling back to news endpoint for save");

          // Extract article data from preprocessed data
          const articleData = savedPreviewData as any;

          // Prepare news article format
          const newsArticle = {
            title: articleData.title || "Untitled Article",
            summary: articleData.summary || "",
            content: articleData.content || "",
            author: metadata.author || articleData.author || "Unknown",
            category: metadata.category || articleData.category || "General",
            tags: metadata.tags
              ? metadata.tags.split(",").map((t) => t.trim())
              : articleData.tags || [],
            tool_mentions: articleData.tools || [],
            importance_score: 5, // Default importance
          };

          response = await fetch("/api/admin/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              action: "manual-ingest",
              article: newsArticle,
            }),
          });
        }

        setProcessingProgress(75);
        setProcessingStep("Updating rankings...");
      } else {
        // Fallback to full processing if no preview data
        let finalInputContent = inputContent;
        if (ingestionType === "file" && selectedFile) {
          setProcessingProgress(10);
          setProcessingStep("Extracting file content...");
          finalInputContent = await readFileContent(selectedFile);
        }

        setProcessingProgress(25);
        setProcessingStep("Analyzing with AI...");

        response = await fetch("/api/admin/articles/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            type: ingestionType === "file" ? "text" : ingestionType,
            input: finalInputContent,
            dryRun: false,
            metadata: {
              author: metadata.author || undefined,
              category: metadata.category || undefined,
              tags: metadata.tags ? metadata.tags.split(",").map((t) => t.trim()) : undefined,
              fileName: metadata.fileName || undefined,
              fileType: metadata.fileType || undefined,
            },
          }),
        });

        // If articles table doesn't exist, fallback to news endpoint
        if (response.status === 503 || response.status === 500) {
          console.log("Articles table not found, falling back to news endpoint for direct save");

          // For direct save without preview, we need to generate minimal article data
          const newsArticle = {
            title: finalInputContent.slice(0, 100) || "Untitled Article",
            summary: finalInputContent.slice(0, 200) || "",
            content: finalInputContent,
            author: metadata.author || "Unknown",
            category: metadata.category || "General",
            tags: metadata.tags ? metadata.tags.split(",").map((t) => t.trim()) : [],
            tool_mentions: [], // Would need AI to extract these
            importance_score: 5, // Default importance
          };

          response = await fetch("/api/admin/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              action: "manual-ingest",
              article: newsArticle,
            }),
          });
        }

        setProcessingProgress(50);
        setProcessingStep("Calculating ranking impacts...");
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save article");
      }

      data = await response.json();

      setProcessingProgress(85);
      setProcessingStep("Finalizing...");

      if ((data.success && data.result) || data.success) {
        // Map predictedChanges to impactedTools for the UI with correct field names
        // Handle both articles endpoint response and news endpoint response
        const result = data.result || (data as any);
        const mappedResult: IngestionPreview = {
          article: result.article || {},
          impactedTools: ((result.predictedChanges || []) as any[]).map(
            (change: {
              toolName?: string;
              tool?: string;
              currentScore?: number;
              predictedScore?: number;
              newScore?: number;
            }) => ({
              tool: change.toolName || change.tool || "Unknown Tool",
              currentScore: change.currentScore || 0,
              newScore: change.predictedScore || change.newScore || 0,
              change: (change.predictedScore || change.newScore || 0) - (change.currentScore || 0),
            })
          ),
          newTools: ((result.newTools || []) as any[]).map(
            (t: { name?: string; tool?: string } | string) =>
              typeof t === "string" ? t : t.name || t.tool || ""
          ),
          summary: result.summary || {
            totalToolsAffected: 0,
            totalNewTools: 0,
            averageScoreChange: 0,
          },
        };
        setPreview(mappedResult); // Keep the result for display
        setProcessingProgress(90);
        setProcessingStep("Updating rankings...");
        setSuccess(data.message || "Article saved successfully and rankings updated!");
        setProcessingProgress(100);
        setProcessingStep("Complete!");
        setWorkflowStep("saved");
      } else {
        throw new Error(data.error || "Failed to save article");
      }

      // Reload articles
      await loadArticles();

      // After 2 seconds, switch to manage tab
      setTimeout(() => {
        setActiveTab("manage");
        resetAddForm();
      }, 2000);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateArticle = async () => {
    if (!editingArticle) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/articles/${editingArticle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editContent),
      });

      if (!response.ok) {
        throw new Error("Failed to update article");
      }

      setSuccess("Article text updated successfully! (Rankings not changed)");
      setEditingArticle(null);
      await loadArticles();
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculatePreview = useCallback(async (articleId: string) => {
    setError(null);

    // Close any existing EventSource for this article
    const existingEventSource = eventSourcesRef.current.get(articleId);
    if (existingEventSource) {
      console.log(`Closing existing EventSource for article ${articleId}`);
      existingEventSource.close();
      eventSourcesRef.current.delete(articleId);
    }

    // Initialize progress for this article
    setRecalcProgress((prev) =>
      new Map(prev).set(articleId, {
        articleId,
        progress: 0,
        step: "Initializing preview...",
        isActive: true,
      })
    );

    try {
      // Check if we're in the browser and EventSource is available
      if (typeof window === "undefined" || !window.EventSource) {
        // Fallback to regular POST without SSE
        const response = await fetch(`/api/admin/articles/${articleId}/recalculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dryRun: true }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate preview");
        }

        const data = await response.json();
        setRecalcPreviewData({
          articleId,
          toolChanges: data.changes || [],
          summary: data.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
          isPreview: true,
        });
        setShowRecalcPreviewModal(true);

        // Clean up progress
        setRecalcProgress((prev) => {
          const newMap = new Map(prev);
          newMap.delete(articleId);
          return newMap;
        });
        return;
      }

      // Use EventSource for real-time progress updates with dry run
      const eventSource = new EventSource(
        `/api/admin/articles/${articleId}/recalculate?stream=true&dryRun=true`,
        { withCredentials: true } as EventSourceInit
      );

      // Store the EventSource for cleanup
      eventSourcesRef.current.set(articleId, eventSource);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "progress") {
          setRecalcProgress((prev) =>
            new Map(prev).set(articleId, {
              articleId,
              progress: data.progress,
              step: data.step,
              isActive: true,
            })
          );
        } else if (data.type === "complete") {
          // Preview complete, show modal
          setRecalcPreviewData({
            articleId,
            toolChanges: data.changes || [],
            summary: data.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
            isPreview: true,
          });
          setShowRecalcPreviewModal(true);

          // Clean up progress
          setTimeout(() => {
            setRecalcProgress((prev) => {
              const newMap = new Map(prev);
              newMap.delete(articleId);
              return newMap;
            });
          }, 1000);

          eventSource.close();
          eventSourcesRef.current.delete(articleId);
        } else if (data.type === "error") {
          throw new Error(data.message || "Failed to generate preview");
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        eventSource.close();
        eventSourcesRef.current.delete(articleId);

        // Fallback to regular POST if SSE fails
        fetch(`/api/admin/articles/${articleId}/recalculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dryRun: true }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Failed to generate preview");
            }
            const data = await response.json();

            setRecalcPreviewData({
              articleId,
              toolChanges: data.changes || [],
              summary: data.summary || { totalToolsAffected: 0, averageScoreChange: 0 },
              isPreview: true,
            });
            setShowRecalcPreviewModal(true);

            // Clean up progress
            setRecalcProgress((prev) => {
              const newMap = new Map(prev);
              newMap.delete(articleId);
              return newMap;
            });
          })
          .catch((err) => {
            throw err;
          });
      };
    } catch (err) {
      const error = err as Error;
      setError(error.message);

      // Clean up progress on error
      setRecalcProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(articleId);
        return newMap;
      });

      // Clean up EventSource reference on error
      const errorEventSource = eventSourcesRef.current.get(articleId);
      if (errorEventSource) {
        errorEventSource.close();
        eventSourcesRef.current.delete(articleId);
      }
    }
  }, []);

  const handleApplyRecalculation = useCallback(async () => {
    if (!recalcPreviewData) return;

    setIsApplying(true);
    setError(null);
    const articleId = recalcPreviewData.articleId;

    try {
      // Check if we're in the browser and EventSource is available
      if (typeof window === "undefined" || !window.EventSource) {
        // Fallback to regular POST without SSE
        const response = await fetch(`/api/admin/articles/${articleId}/recalculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dryRun: false, useCachedAnalysis: true }),
        });

        if (!response.ok) {
          throw new Error("Failed to apply changes");
        }

        await response.json();
        setShowRecalcPreviewModal(false);
        setRecalcPreviewData(null);
        setSuccess("Rankings updated successfully!");
        await loadArticles();
        return;
      }

      // Use EventSource for real-time progress updates with cached analysis
      const eventSource = new EventSource(
        `/api/admin/articles/${articleId}/recalculate?stream=true&dryRun=false&useCachedAnalysis=true`,
        { withCredentials: true } as EventSourceInit
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "complete") {
          // Application complete
          setShowRecalcPreviewModal(false);
          setRecalcPreviewData(null);
          setSuccess("Rankings updated successfully!");
          eventSource.close();
          loadArticles();
        } else if (data.type === "error") {
          throw new Error(data.message || "Failed to apply changes");
        }
      };

      eventSource.onerror = (error) => {
        console.error("EventSource error:", error);
        eventSource.close();

        // Fallback to regular POST if SSE fails
        fetch(`/api/admin/articles/${articleId}/recalculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ dryRun: false, useCachedAnalysis: true }),
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Failed to apply changes");
            }
            setShowRecalcPreviewModal(false);
            setRecalcPreviewData(null);
            setSuccess("Rankings updated successfully!");
            await loadArticles();
          })
          .catch((err) => {
            throw err;
          });
      };
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setIsApplying(false);
    }
  }, [recalcPreviewData, loadArticles]);

  const handleDelete = async (articleId: string) => {
    if (
      !confirm(
        "Are you sure? This will delete the article and automatically rollback any ranking changes it made."
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/articles/${articleId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      setSuccess("Article deleted and rankings rolled back successfully!");
      await loadArticles();
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetAddForm = () => {
    setInputContent("");
    setSelectedFile(null);
    setMetadata({ author: "", category: "", tags: "", fileName: "", fileType: "" });
    setPreview(null);
    setSavedPreviewData(null);
    setWorkflowStep("input");
    setError(null);
    setSuccess(null);
  };

  // File reading utilities
  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedExtensions = [".txt", ".md", ".json", ".pdf", ".docx"];
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`;

    if (!allowedExtensions.includes(fileExtension)) {
      setError(`Unsupported file type. Please upload: ${allowedExtensions.join(", ")}`);
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }

    setSelectedFile(file);
    setMetadata({
      ...metadata,
      fileName: file.name,
      fileType: fileExtension.substring(1),
    });
    setError(null);

    // For text-based files, read content immediately
    if ([".txt", ".md", ".json"].includes(fileExtension)) {
      try {
        const content = await readFileContent(file);
        setInputContent(content);
      } catch {
        setError("Failed to read file content");
      }
    } else {
      // For PDF and DOCX, we'll handle them specially
      setInputContent(`[File: ${file.name} - Processing will extract text content]`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            News Article Management
          </CardTitle>
          <CardDescription>
            Workflow: Add (Upload/Link/Enter) → Preview Impact → Save
          </CardDescription>
        </CardHeader>
        {stats && (
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Articles</p>
                <p className="text-2xl font-bold">{stats.totalArticles}</p>
              </div>
              <div>
                <p className="text-muted-foreground">This Month</p>
                <p className="text-2xl font-bold">{stats.articlesThisMonth}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Month</p>
                <p className="text-2xl font-bold">{stats.articlesLastMonth}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg Tool Mentions</p>
                <p className="text-2xl font-bold">
                  {stats.averageToolMentions?.toFixed(1) ?? "0.0"}
                </p>
              </div>
            </div>
          </CardContent>
        )}
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
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="add">
            <Plus className="mr-2 h-4 w-4" />
            Add News Article
          </TabsTrigger>
          <TabsTrigger value="manage">
            <Edit className="mr-2 h-4 w-4" />
            Edit / Delete Articles
          </TabsTrigger>
        </TabsList>

        {/* Add Article Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add News Article</CardTitle>
              {/* Workflow Progress Indicator */}
              <div className="flex items-center gap-2 mt-4">
                <div
                  className={`flex items-center gap-2 ${workflowStep === "input" ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${workflowStep === "input" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    1
                  </div>
                  <span className="text-sm font-medium">Input</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div
                  className={`flex items-center gap-2 ${workflowStep === "preview" ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${workflowStep === "preview" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    2
                  </div>
                  <span className="text-sm font-medium">Preview</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div
                  className={`flex items-center gap-2 ${workflowStep === "saved" ? "text-primary" : "text-muted-foreground"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${workflowStep === "saved" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                  >
                    3
                  </div>
                  <span className="text-sm font-medium">Save</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {workflowStep === "input" && (
                <>
                  {/* Input Method Selection */}
                  <div className="space-y-4">
                    <Label>Choose Input Method</Label>
                    <RadioGroup
                      value={ingestionType}
                      onValueChange={(v) => setIngestionType(v as "url" | "text" | "file")}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="url" id="url" />
                        <Label htmlFor="url" className="flex items-center gap-2 cursor-pointer">
                          <Link className="h-4 w-4" />
                          Link - Import from URL
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="text" id="text" />
                        <Label htmlFor="text" className="flex items-center gap-2 cursor-pointer">
                          <FileText className="h-4 w-4" />
                          Enter - Type or Paste Content
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="file" id="file" />
                        <Label htmlFor="file" className="flex items-center gap-2 cursor-pointer">
                          <Upload className="h-4 w-4" />
                          Upload - File Upload (.txt, .md, .json, .pdf, .docx)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Input Content */}
                  <div className="space-y-2">
                    <Label>Article Content</Label>
                    {ingestionType === "url" ? (
                      <Input
                        placeholder="https://example.com/article"
                        value={inputContent}
                        onChange={(e) => setInputContent(e.target.value)}
                      />
                    ) : ingestionType === "text" ? (
                      <Textarea
                        placeholder="Paste or type article content here..."
                        rows={10}
                        value={inputContent}
                        onChange={(e) => setInputContent(e.target.value)}
                        className="font-mono text-sm"
                      />
                    ) : (
                      <div className="space-y-4">
                        <div className="border-2 border-dashed rounded-lg p-6">
                          <input
                            type="file"
                            accept=".txt,.md,.json,.pdf,.docx"
                            onChange={handleFileSelect}
                            className="mb-3 w-full"
                          />
                          {selectedFile && (
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="font-medium">{selectedFile.name}</span>
                                <Badge variant="secondary">
                                  {(selectedFile.size / 1024).toFixed(1)} KB
                                </Badge>
                              </div>
                              {inputContent && (
                                <div className="mt-3 p-3 bg-muted rounded-md">
                                  <Label className="text-xs">File Content Preview</Label>
                                  <p className="text-xs mt-1 line-clamp-3 font-mono">
                                    {inputContent.substring(0, 200)}
                                    {inputContent.length > 200 ? "..." : ""}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                          {!selectedFile && (
                            <p className="text-muted-foreground text-sm">
                              Select a file to upload (.txt, .md, .json, .pdf, .docx - max 10MB)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Author (Optional)</Label>
                      <Input
                        placeholder="Article author"
                        value={metadata.author}
                        onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category (Optional)</Label>
                      <Input
                        placeholder="e.g., AI News"
                        value={metadata.category}
                        onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags (Optional)</Label>
                      <Input
                        placeholder="tag1, tag2, tag3"
                        value={metadata.tags}
                        onChange={(e) => setMetadata({ ...metadata, tags: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Preview Button with integrated progress */}
                  <div className="flex flex-col items-center pt-4">
                    <div className="relative">
                      <Button
                        onClick={handlePreview}
                        disabled={
                          (!inputContent && ingestionType !== "file") ||
                          (ingestionType === "file" && !selectedFile) ||
                          loading
                        }
                        size="lg"
                        className="relative min-w-[250px] overflow-hidden transition-all"
                      >
                        {/* Progress fill background */}
                        {loading && processingProgress > 0 && (
                          <div
                            className="absolute inset-0 bg-primary/20 transition-all duration-300"
                            style={{
                              width: `${processingProgress}%`,
                              background:
                                "linear-gradient(90deg, hsl(var(--primary) / 0.3) 0%, hsl(var(--primary) / 0.15) 100%)",
                            }}
                          />
                        )}
                        {/* Button content */}
                        <span className="relative z-10 flex items-center">
                          {loading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {processingProgress > 0
                                ? `Processing... ${processingProgress}%`
                                : "Processing..."}
                            </>
                          ) : (
                            <>
                              <Eye className="mr-2 h-4 w-4" />
                              Preview Impact
                            </>
                          )}
                        </span>
                      </Button>
                    </div>
                    {/* Progress step text below button */}
                    {loading && processingStep && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {processingStep}
                      </p>
                    )}
                  </div>
                </>
              )}

              {workflowStep === "preview" && preview && (
                <>
                  {/* Preview Results */}
                  <div className="space-y-4">
                    {/* Article Preview */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Article Preview</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div>
                          <Label>Title</Label>
                          <p className="font-medium">{preview?.article?.title || "Untitled"}</p>
                        </div>
                        {preview?.article?.summary && (
                          <div>
                            <Label>Summary</Label>
                            <p className="text-sm text-muted-foreground">
                              {preview?.article?.summary}
                            </p>
                          </div>
                        )}
                        {preview?.article?.model && (
                          <div>
                            <Label>AI Model Used</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Bot className="h-4 w-4 text-primary" />
                              <Badge variant="secondary" className="font-mono">
                                {preview.article.model === "anthropic/claude-sonnet-4"
                                  ? "Claude 4 Sonnet"
                                  : preview.article.model === "anthropic/claude-3-haiku"
                                    ? "Claude 3 Haiku"
                                    : preview.article.model}
                              </Badge>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Impact Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Ranking Impact Preview</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Tools Affected</p>
                            <p className="text-2xl font-bold">
                              {preview?.summary?.totalToolsAffected ?? 0}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">New Tools</p>
                            <p className="text-2xl font-bold">
                              {preview?.summary?.totalNewTools ?? 0}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground">Avg Score Change</p>
                            <p className="text-2xl font-bold">
                              {(preview?.summary?.averageScoreChange ?? 0) > 0 ? "+" : ""}
                              {preview?.summary?.averageScoreChange?.toFixed(1) ?? "0.0"}
                            </p>
                          </div>
                        </div>

                        {/* Impacted Tools List */}
                        {preview?.impactedTools && preview.impactedTools.length > 0 && (
                          <div className="space-y-2">
                            <Label>Tool Score Changes (Preview)</Label>
                            <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                              {preview?.impactedTools?.map((tool, index) => (
                                <div
                                  key={`${tool.tool}-${index}`}
                                  className="flex items-center justify-between text-sm py-1"
                                >
                                  <span className="font-medium">{tool.tool}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground">
                                      {tool.currentScore}
                                    </span>
                                    <ArrowRight className="h-3 w-3" />
                                    <span className="font-medium">{tool.newScore}</span>
                                    <Badge
                                      variant={tool.change > 0 ? "default" : "secondary"}
                                      className="ml-2"
                                    >
                                      {tool.change > 0 ? "+" : ""}
                                      {tool.change?.toFixed(1) ?? "0.0"}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* New Tools */}
                        {preview?.newTools && preview.newTools.length > 0 && (
                          <div className="space-y-2 mt-4">
                            <Label>New Tools to be Created</Label>
                            <div className="flex flex-wrap gap-2">
                              {preview?.newTools?.map((tool) => (
                                <Badge key={`new-tool-${tool}`} variant="outline">
                                  <Plus className="mr-1 h-3 w-3" />
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <div className="flex flex-col items-center">
                      <div className="flex gap-4 pt-4">
                        <Button variant="outline" onClick={() => setWorkflowStep("input")}>
                          <X className="mr-2 h-4 w-4" />
                          Back to Edit
                        </Button>

                        {/* Save Button with integrated progress */}
                        <div className="relative">
                          <Button
                            onClick={handleSave}
                            disabled={loading}
                            size="lg"
                            className="relative min-w-[250px] overflow-hidden transition-all"
                          >
                            {/* Progress fill background */}
                            {loading && processingProgress > 0 && (
                              <div
                                className="absolute inset-0 bg-primary/20 transition-all duration-300"
                                style={{
                                  width: `${processingProgress}%`,
                                  background:
                                    "linear-gradient(90deg, hsl(var(--primary) / 0.3) 0%, hsl(var(--primary) / 0.15) 100%)",
                                }}
                              />
                            )}
                            {/* Button content */}
                            <span className="relative z-10 flex items-center">
                              {loading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  {processingProgress > 0
                                    ? `Saving... ${processingProgress}%`
                                    : "Saving..."}
                                </>
                              ) : (
                                <>
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Article
                                </>
                              )}
                            </span>
                          </Button>
                        </div>
                      </div>

                      {/* Progress step text below buttons */}
                      {loading && processingStep && (
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          {processingStep}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {workflowStep === "saved" && (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Article Saved Successfully!</h3>
                  <p className="text-muted-foreground">Rankings have been updated.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manage Articles Tab */}
        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Edit / Delete Articles</CardTitle>
              <CardDescription>
                Edit: Update text without changing rankings | Delete: Remove article and rollback
                rankings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {articles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No articles found</p>
                  <p className="text-sm">Add your first article in the "Add News Article" tab</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {articles
                    .filter((article) => article && typeof article === "object")
                    .map((article) => (
                      <Card key={article.id} className="overflow-hidden">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg">
                                {article?.title || "Untitled Article"}
                              </h4>
                              {article.summary && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {article.summary}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                                {article.author && (
                                  <Badge variant="outline" className="font-normal">
                                    By {article.author}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="font-normal">
                                  <Clock className="mr-1 h-3 w-3" />
                                  {(() => {
                                    const dateToUse = article.ingestedAt || article.createdAt;
                                    if (
                                      dateToUse &&
                                      typeof dateToUse === "string" &&
                                      !Number.isNaN(Date.parse(dateToUse))
                                    ) {
                                      return format(new Date(dateToUse), "MMM d, yyyy");
                                    } else if (dateToUse instanceof Date) {
                                      return format(dateToUse, "MMM d, yyyy");
                                    }
                                    return "Unknown date";
                                  })()}
                                </Badge>
                                {article.category && (
                                  <Badge variant="secondary">{article.category}</Badge>
                                )}
                                {article.toolMentions && (
                                  <Badge>
                                    {Array.isArray(article.toolMentions)
                                      ? `${article.toolMentions.length} tools`
                                      : "Has tool mentions"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingArticle(article);
                                  setEditContent({
                                    title: article?.title || "",
                                    content: article.content || "",
                                    summary: article.summary || "",
                                  });
                                }}
                                title="Edit article text (won't change rankings)"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecalculatePreview(article.id)}
                                disabled={recalcProgress.has(article.id)}
                                title="Preview ranking changes before applying"
                                className="relative min-w-[90px]"
                              >
                                {recalcProgress.has(article.id) ? (
                                  <>
                                    {/* Progress fill background */}
                                    <div
                                      className="absolute inset-0 bg-primary/20 rounded transition-all duration-300"
                                      style={{
                                        width: `${recalcProgress.get(article.id)?.progress || 0}%`,
                                      }}
                                    />
                                    <span className="relative z-10 flex items-center">
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      {recalcProgress.get(article.id)?.progress || 0}%
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-1" />
                                    Preview
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(article.id)}
                                disabled={loading}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete article and rollback ranking changes"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </div>
                          {/* Progress step display */}
                          {recalcProgress.has(article.id) && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-muted-foreground text-center">
                                {recalcProgress.get(article.id)?.step}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recalculation Preview Modal */}
      {showRecalcPreviewModal && recalcPreviewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>Preview Ranking Changes</CardTitle>
              <CardDescription>
                Review the proposed ranking changes before applying them.
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
                        {recalcPreviewData.summary.totalToolsAffected}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Avg Score Change</p>
                      <p className="text-2xl font-bold">
                        {recalcPreviewData.summary.averageScoreChange > 0 ? "+" : ""}
                        {recalcPreviewData.summary.averageScoreChange.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tool Changes */}
              {recalcPreviewData.toolChanges.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Proposed Tool Score Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recalcPreviewData.toolChanges.map((change, index) => (
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
              {recalcPreviewData.toolChanges.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No ranking changes detected. The article's current impact on rankings is
                    accurate.
                  </AlertDescription>
                </Alert>
              )}

              {/* Info about caching */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The AI analysis has been cached. Clicking "Apply Changes" will use this cached
                  analysis for faster processing.
                </AlertDescription>
              </Alert>
            </CardContent>
            <div className="p-6 border-t flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRecalcPreviewModal(false);
                  setRecalcPreviewData(null);
                }}
                disabled={isApplying}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={handleApplyRecalculation}
                disabled={isApplying || recalcPreviewData.toolChanges.length === 0}
              >
                {isApplying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Apply Changes
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Results Modal (for backwards compatibility) */}
      {showResultsModal && recalcResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>Recalculation Results</CardTitle>
              <CardDescription>
                Rankings have been recalculated based on the current article content.
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
                        {recalcResults.summary.totalToolsAffected}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Avg Score Change</p>
                      <p className="text-2xl font-bold">
                        {recalcResults.summary.averageScoreChange > 0 ? "+" : ""}
                        {recalcResults.summary.averageScoreChange.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tool Changes */}
              {recalcResults.toolChanges.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Tool Score Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {recalcResults.toolChanges.map((change, index) => (
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
              {recalcResults.toolChanges.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No ranking changes detected after recalculation. The article's impact remains
                    the same.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <div className="p-6 border-t">
              <Button
                onClick={() => {
                  setShowResultsModal(false);
                  setRecalcResults(null);
                }}
                className="w-full"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Modal */}
      {editingArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <CardHeader>
              <CardTitle>Edit Article</CardTitle>
              <CardDescription>
                Update article text. Note: This will NOT recalculate rankings automatically. Use the
                "Recalc" button after saving if you want to update rankings.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={editContent.title}
                  onChange={(e) => setEditContent({ ...editContent, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                  rows={3}
                  value={editContent.summary}
                  onChange={(e) => setEditContent({ ...editContent, summary: e.target.value })}
                  placeholder="Brief summary of the article..."
                />
              </div>
              <div className="space-y-2">
                <Label>Content (Markdown supported)</Label>
                <Textarea
                  rows={15}
                  value={editContent.content}
                  onChange={(e) => setEditContent({ ...editContent, content: e.target.value })}
                  className="font-mono text-sm"
                  placeholder="Full article content..."
                />
              </div>
            </CardContent>
            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingArticle(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateArticle} disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
