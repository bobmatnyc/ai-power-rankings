"use client";

import { Edit, Loader2, Plus, Search, Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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

export default function NewsListPage() {
  const params = useParams();
  const lang = (params?.["lang"] as string) || "en";
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/news/list");
      if (!response.ok) {
        throw new Error("Failed to load articles");
      }
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/news?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete article");
      }

      // Remove from local state
      setArticles(articles.filter((article) => article.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredArticles = articles.filter((article) => {
    const query = searchQuery.toLowerCase();
    return (
      article.title.toLowerCase().includes(query) ||
      article.summary?.toLowerCase().includes(query) ||
      article.source?.toLowerCase().includes(query) ||
      article.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
      article.tool_mentions?.some((tool) => tool.toLowerCase().includes(query))
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
          {filteredArticles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No articles found matching your search" : "No articles yet"}
            </div>
          ) : (
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
                          {article.source && <Badge variant="outline">{article.source}</Badge>}
                          {article.category && (
                            <Badge variant="secondary">{article.category}</Badge>
                          )}
                          {article.importance_score && (
                            <Badge>Score: {article.importance_score}</Badge>
                          )}
                          {article.tool_mentions?.map((tool) => (
                            <Badge key={tool} variant="default">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Published: {new Date(article.published_date).toLocaleDateString()}
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
                          onClick={() => handleDelete(article.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
