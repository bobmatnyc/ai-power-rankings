"use client";

import { Edit, Loader2, Plus, Search, Trash2 } from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  content: string;
  author?: string;
  publishedDate: string;
  sourceName?: string;
  sourceUrl?: string;
  tags?: string[];
  toolMentions?: (string | { tool: string; context?: string; relevance?: number; sentiment?: number })[];
  createdAt: string;
  updatedAt: string;
  category?: string;
  importanceScore?: number;
}

export default function NewsListPage() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalArticles, setTotalArticles] = useState(0);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await fetch(`/api/admin/news/list?limit=${pageSize}&offset=${offset}`);

      // Check for specific error responses
      if (response.status === 401) {
        throw new Error("Unauthorized - Please sign in to access this page");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || errorData.message || "Failed to load articles");
      }

      const data = await response.json();
      setArticles(data.articles || []);
      setTotalArticles(data.total || 0);
    } catch (err) {
      console.error("Error loading articles:", err);
      setError(err instanceof Error ? err.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleDeleteClick = (id: string) => {
    setArticleToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!articleToDelete) return;

    setDeletingId(articleToDelete);
    try {
      const response = await fetch(`/api/admin/news?id=${articleToDelete}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      // Remove from local state and reload
      setArticles(articles.filter((article) => article.id !== articleToDelete));
      setTotalArticles(totalArticles - 1);
      setDeleteDialogOpen(false);
      setArticleToDelete(null);

      // Reload articles to get updated list
      await loadArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredArticles = articles.filter((article) => {
    const query = searchQuery.toLowerCase();
    const toolMatches = article.toolMentions?.some((toolItem) => {
      const toolName = typeof toolItem === 'string' ? toolItem : toolItem.tool;
      return toolName.toLowerCase().includes(query);
    });
    return (
      article.title.toLowerCase().includes(query) ||
      article.summary?.toLowerCase().includes(query) ||
      article.sourceName?.toLowerCase().includes(query) ||
      article.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
      toolMatches
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">News Articles</h1>
          <p className="text-muted-foreground mt-1">Manage and edit news articles</p>
        </div>
        <Link href={`/${lang}/admin`}>
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex-1 max-w-sm">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Link href={`/${lang}/admin/news/new`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* Pagination Controls - Top */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Articles per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {totalArticles === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalArticles)} of {totalArticles}
            </div>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No articles found matching your search" : "No articles yet"}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {filteredArticles.map((article) => (
                <Card key={article.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">{article.title}</h3>
                        {article.summary && (
                          <p className="text-sm text-muted-foreground mb-3">{article.summary}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {article.sourceName && <Badge variant="outline">{article.sourceName}</Badge>}
                          {article.category && (
                            <Badge variant="secondary">{article.category}</Badge>
                          )}
                          {article.importanceScore && (
                            <Badge>Score: {article.importanceScore}</Badge>
                          )}
                          {article.toolMentions?.map((toolItem, idx) => {
                            const toolName = typeof toolItem === 'string' ? toolItem : toolItem.tool;
                            return (
                              <Badge key={`${toolName}-${idx}`} variant="default">
                                {toolName}
                              </Badge>
                            );
                          })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Published: {new Date(article.publishedDate || article.createdAt).toLocaleDateString()}
                          {article.author && ` • By ${article.author}`}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Link href={`/${lang}/admin/news/edit/${article.id}`}>
                          <Button size="sm" variant="outline">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteClick(article.id)}
                          disabled={deletingId === article.id}
                        >
                          {deletingId === article.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              </div>

              {/* Pagination Controls - Bottom */}
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {(() => {
                    const totalPages = Math.ceil(totalArticles / pageSize);
                    const pages = [];

                    // Always show first page
                    if (totalPages > 0) {
                      pages.push(
                        <Button
                          key={1}
                          size="sm"
                          variant={currentPage === 1 ? "default" : "outline"}
                          onClick={() => setCurrentPage(1)}
                        >
                          1
                        </Button>
                      );
                    }

                    // Show ellipsis if needed
                    if (currentPage > 3) {
                      pages.push(<span key="start-ellipsis" className="px-2">...</span>);
                    }

                    // Show pages around current page
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                      pages.push(
                        <Button
                          key={i}
                          size="sm"
                          variant={currentPage === i ? "default" : "outline"}
                          onClick={() => setCurrentPage(i)}
                        >
                          {i}
                        </Button>
                      );
                    }

                    // Show ellipsis if needed
                    if (currentPage < totalPages - 2) {
                      pages.push(<span key="end-ellipsis" className="px-2">...</span>);
                    }

                    // Always show last page
                    if (totalPages > 1) {
                      pages.push(
                        <Button
                          key={totalPages}
                          size="sm"
                          variant={currentPage === totalPages ? "default" : "outline"}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          {totalPages}
                        </Button>
                      );
                    }

                    return pages;
                  })()}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= Math.ceil(totalArticles / pageSize)}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Article"
        description="Are you sure you want to delete this article? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
