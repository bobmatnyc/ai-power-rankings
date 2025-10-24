"use client";

import { Calendar, Clock, FileText, Newspaper, Sparkles, TrendingUp, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoShow?: boolean;
}

interface MonthlySummary {
  period: string;
  content: string;
  generatedAt: string;
  metadata: {
    model?: string;
    article_count?: number;
    ranking_change_count?: number;
    new_tool_count?: number;
    site_change_count?: number;
  };
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
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("recent");

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

  // Fetch all data from single optimized endpoint (past 7 days)
  useEffect(() => {
    const fetchAllUpdates = async () => {
      try {
        setLoading(true);

        // Fetch from single combined endpoint for better performance
        const response = await fetch("/api/whats-new?days=7");

        if (response.ok) {
          const data = await response.json();
          setToolUpdates(data.tools || []);
          setNewsArticles(data.news || []);
          setChangelogItems(data.changelog || []);
        } else {
          setToolUpdates([]);
          setNewsArticles([]);
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

  // Fetch monthly summary when switching to summary tab
  useEffect(() => {
    const fetchMonthlySummary = async () => {
      if (activeTab !== "summary" || monthlySummary) return;

      try {
        setSummaryLoading(true);
        const response = await fetch("/api/whats-new/summary");

        if (response.ok) {
          const data = await response.json();
          setMonthlySummary(data.summary);
        } else {
          console.error("Failed to fetch monthly summary:", response.status);
        }
      } catch (error) {
        console.error("Error fetching monthly summary:", error);
      } finally {
        setSummaryLoading(false);
      }
    };

    if (open && activeTab === "summary") {
      fetchMonthlySummary();
    }
  }, [open, activeTab, monthlySummary]);

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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            What's New
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="recent" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent (7 Days)
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Monthly Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="flex-1 overflow-y-auto scroll-smooth px-1 mt-4">
            <div className="space-y-6 py-2">
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
          </TabsContent>

          <TabsContent value="summary" className="flex-1 overflow-y-auto scroll-smooth px-1 mt-4">
            <div className="space-y-4 py-2">
              {summaryLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                </div>
              ) : monthlySummary ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {new Date(monthlySummary.period + "-01").toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                        })}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Generated {new Date(monthlySummary.generatedAt).toLocaleDateString()}
                        </span>
                        {monthlySummary.metadata.article_count !== undefined && (
                          <>
                            <span>•</span>
                            <span>{monthlySummary.metadata.article_count} articles analyzed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div
                    className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary hover:prose-a:underline prose-p:leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: monthlySummary.content
                        .replace(/\n\n/g, "</p><p>")
                        .replace(/\n/g, "<br/>")
                        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
                        .replace(/^(.+)$/, "<p>$1</p>"),
                    }}
                  />

                  {monthlySummary.metadata && (
                    <div className="mt-6 pt-4 border-t">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {monthlySummary.metadata.article_count !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {monthlySummary.metadata.article_count}
                            </div>
                            <div className="text-xs text-muted-foreground">Articles</div>
                          </div>
                        )}
                        {monthlySummary.metadata.new_tool_count !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {monthlySummary.metadata.new_tool_count}
                            </div>
                            <div className="text-xs text-muted-foreground">New Tools</div>
                          </div>
                        )}
                        {monthlySummary.metadata.ranking_change_count !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {monthlySummary.metadata.ranking_change_count}
                            </div>
                            <div className="text-xs text-muted-foreground">Ranking Updates</div>
                          </div>
                        )}
                        {monthlySummary.metadata.site_change_count !== undefined && (
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">
                              {monthlySummary.metadata.site_change_count}
                            </div>
                            <div className="text-xs text-muted-foreground">Site Updates</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No monthly summary available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Summary will be generated automatically based on recent activity
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t mt-4">
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
