"use client";

import { Calendar, Clock, Newspaper, Sparkles, TrendingUp, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoShow?: boolean;
}

interface ToolUpdate {
  id: string;
  name: string;
  slug: string;
  description: string;
  updatedAt: string;
  category: string;
}

interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  summary: string;
  published_at: string;
  source: string;
}

interface ChangelogItem {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  type: "feature" | "improvement" | "fix" | "news";
  version: string;
}

export function WhatsNewModal({
  open,
  onOpenChange,
  autoShow = false,
}: WhatsNewModalProps): React.JSX.Element {
  const params = useParams();
  const lang = (params?.lang as string) || "en";
  const [toolUpdates, setToolUpdates] = useState<ToolUpdate[]>([]);
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [changelogItems, setChangelogItems] = useState<ChangelogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ESC key handler to dismiss modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        handleDismiss();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open]);

  // Fetch all data from three endpoints (past 7 days)
  useEffect(() => {
    const fetchAllUpdates = async () => {
      try {
        setLoading(true);

        // Fetch all three endpoints in parallel
        const [toolsResponse, newsResponse, changelogResponse] = await Promise.all([
          fetch("/api/tools/recent-updates?days=7"),
          fetch("/api/news/recent?days=7"),
          fetch("/api/changelog"),
        ]);

        // Process tools updates
        if (toolsResponse.ok) {
          const toolsData = await toolsResponse.json();
          setToolUpdates(toolsData.tools || []);
        } else {
          setToolUpdates([]);
        }

        // Process news articles
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          setNewsArticles(newsData.news || []);
        } else {
          setNewsArticles([]);
        }

        // Process changelog items
        if (changelogResponse.ok) {
          const changelogData = await changelogResponse.json();
          setChangelogItems(changelogData.slice(0, 10) || []);
        } else {
          setChangelogItems([]);
        }
      } catch (error) {
        console.error("Error fetching updates:", error);
        setToolUpdates([]);
        setNewsArticles([]);
        setChangelogItems([]);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchAllUpdates();
    }
  }, [open]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "feature":
        return <Sparkles className="h-4 w-4" />;
      case "improvement":
        return <TrendingUp className="h-4 w-4" />;
      case "fix":
        return <Calendar className="h-4 w-4" />;
      case "news":
        return <Newspaper className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "feature":
        return "bg-green-100 text-green-800 border-green-200";
      case "improvement":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "fix":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "news":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 48) {
      return "Yesterday";
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  const handleDismiss = () => {
    // Just close the modal - sessionStorage handles single-session tracking
    onOpenChange(false);
  };

  const handleDontShowAgain = () => {
    // Disable auto-show functionality permanently
    localStorage.setItem("autoShowDisabled", "true");
    onOpenChange(false);
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              What's New
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4 scroll-smooth">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            What's New
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Updates from the past week
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scroll-smooth px-1">
          <div className="space-y-6 py-4">
            {toolUpdates.length === 0 && newsArticles.length === 0 && changelogItems.length === 0 ? (
              <div className="text-center py-8">
                <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No recent updates to show</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Check back soon for the latest news and improvements
                </p>
              </div>
            ) : (
              <>
                {/* Section 1: Tools Updated This Week */}
                {toolUpdates.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wrench className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Tools Updated This Week</h3>
                    </div>
                    <div className="space-y-3">
                      {toolUpdates.map((tool) => (
                        <Link
                          key={tool.id}
                          href={`/${lang}/tools/${tool.slug}`}
                          className="block"
                          onClick={handleDismiss}
                        >
                          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                            <Wrench className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-medium text-sm hover:text-primary transition-colors">{tool.name}</h4>
                                <Badge variant="secondary" className="text-xs">
                                  {tool.category}
                                </Badge>
                              </div>
                              {tool.description && (
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {tool.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(tool.updatedAt)}</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section 2: Recent News & Articles */}
                {newsArticles.length > 0 && (
                  <>
                    {toolUpdates.length > 0 && <Separator />}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Newspaper className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Recent News & Articles</h3>
                      </div>
                      <div className="space-y-3">
                        {newsArticles.map((article) => (
                          <Link
                            key={article.id}
                            href={`/${lang}/news/${article.slug}`}
                            className="block"
                            onClick={handleDismiss}
                          >
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                              <Newspaper className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm mb-1 hover:text-primary transition-colors">{article.title}</h4>
                                {article.summary && (
                                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                    {article.summary}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  <span>{formatDate(article.published_at)}</span>
                                  {article.source && (
                                    <>
                                      <span>•</span>
                                      <span>{article.source}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Section 3: Platform Updates (Changelog) */}
                {changelogItems.length > 0 && (
                  <>
                    {(toolUpdates.length > 0 || newsArticles.length > 0) && <Separator />}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Platform Updates</h3>
                      </div>
                      <div className="space-y-3">
                        {changelogItems.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                            <div className="flex-shrink-0 mt-1">
                              {getTypeIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-medium text-sm">{item.title}</h4>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${getTypeColor(item.type)}`}
                                >
                                  {item.type}
                                </Badge>
                                {item.version && (
                                  <Badge variant="outline" className="text-xs">
                                    v{item.version}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {item.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(item.date)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Stay updated with the latest AI tool rankings and platform improvements
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDontShowAgain}>
              <X className="h-4 w-4 mr-1" />
              Don't show again
            </Button>
            <Button size="sm" onClick={handleDismiss}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
