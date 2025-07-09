"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  Newspaper, 
  TrendingUp, 
  Clock, 
  X,
  Sparkles 
} from "lucide-react";

interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoShow?: boolean;
}

interface UpdateItem {
  id: string;
  type: "feature" | "improvement" | "fix" | "news";
  title: string;
  description: string;
  date: string;
  category?: string;
  isNew?: boolean;
}

export function WhatsNewModal({ open, onOpenChange, autoShow = false }: WhatsNewModalProps): React.JSX.Element {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto-show logic for first-time visitors
  useEffect(() => {
    if (!autoShow) return;

    const checkAutoShow = () => {
      const lastDismissed = localStorage.getItem('whatsNewDismissed');
      const autoShowDisabled = localStorage.getItem('autoShowDisabled');
      
      if (autoShowDisabled === 'true') return;
      
      if (!lastDismissed) {
        // First visit - show modal
        setTimeout(() => onOpenChange(true), 1000);
      } else {
        // Check if 24 hours have passed
        const lastDismissTime = parseInt(lastDismissed);
        const now = Date.now();
        const hoursSinceLastDismiss = (now - lastDismissTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastDismiss >= 24) {
          // Reset and show again
          localStorage.removeItem('whatsNewDismissed');
          setTimeout(() => onOpenChange(true), 1000);
        }
      }
    };

    checkAutoShow();
  }, [autoShow, onOpenChange]);

  // Fetch recent updates (past 3 days)
  useEffect(() => {
    const fetchRecentUpdates = async () => {
      try {
        setLoading(true);
        
        // Calculate 3 days ago
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        // Fetch recent news/updates
        const response = await fetch(`/api/news/recent?days=3`);
        const newsDataResponse = response.ok ? await response.json() : { articles: [] };
        const newsData = newsDataResponse.articles || [];
        
        // Transform news data to update format
        const newsUpdates: UpdateItem[] = newsData.slice(0, 5).map((item: any, index: number) => ({
          id: `news-${item.id || index}`,
          type: "news" as const,
          title: item.title || "New Update",
          description: item.summary || item.content?.substring(0, 150) + "..." || "Recent update to the platform",
          date: item.created_at || item.published_date || new Date().toISOString(),
          category: item.category || "General",
          isNew: true
        }));

        // Fetch real platform updates from changelog
        let platformUpdates: UpdateItem[] = [];
        try {
          const changelogResponse = await fetch('/api/changelog');
          if (changelogResponse.ok) {
            const changelogData = await changelogResponse.json();
            platformUpdates = changelogData.slice(0, 5).map((item: any, index: number) => ({
              id: `changelog-${item.id || index}`,
              type: "feature" as const,
              title: item.title || "Platform Update",
              description: item.description || "Recent platform improvement",
              date: item.date || new Date().toISOString(),
              category: item.category || "Platform",
              isNew: true
            }));
          }
        } catch (error) {
          console.error('Error fetching changelog:', error);
          // No fallback fake data - just use empty array
        }

        // Combine and sort updates - changelog first, then news  
        // Show recent changelog entries regardless of date, but filter news to past 3 days
        const filteredNewsUpdates = newsUpdates.filter(update => {
          const updateDate = new Date(update.date);
          return updateDate >= threeDaysAgo;
        });
        
        // Show top 10 most recent changelog entries regardless of date
        const recentChangelogUpdates = platformUpdates.slice(0, 10);
        
        const allUpdates = [...filteredNewsUpdates, ...recentChangelogUpdates];

        setUpdates(allUpdates);
      } catch (error) {
        console.error('Error fetching recent updates:', error);
        // No fallback fake data - just show empty state
        setUpdates([]);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      fetchRecentUpdates();
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
    // Store dismissal preference in localStorage
    localStorage.setItem('whatsNewDismissed', Date.now().toString());
    onOpenChange(false);
  };

  const handleDontShowAgain = () => {
    // Disable auto-show functionality
    localStorage.setItem('autoShowDisabled', 'true');
    localStorage.setItem('whatsNewDismissed', Date.now().toString());
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
            Updates from the past 3 days
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scroll-smooth px-1">
          <div className="space-y-6 py-4">
          {updates.length === 0 ? (
            <div className="text-center py-8">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No recent updates to show</p>
              <p className="text-sm text-muted-foreground mt-1">
                Check back soon for the latest news and improvements
              </p>
            </div>
          ) : (
            <>
              {/* Section 1: Rankings/Platform Updates */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Platform & Rankings Updates</h3>
                </div>
                {updates.filter(update => update.category === "Rankings" || update.category === "Performance").map((update) => (
                  <div key={update.id} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 mt-0.5">
                        {getTypeIcon(update.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{update.title}</h4>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getTypeColor(update.type)}`}
                          >
                            {update.type}
                          </Badge>
                          {update.isNew && (
                            <Badge variant="default" className="bg-red-100 text-red-800 text-xs">
                              NEW
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {update.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatDate(update.date)}</span>
                          {update.category && (
                            <>
                              <span>•</span>
                              <span>{update.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Section 2: News & Other Updates */}
              {updates.filter(update => update.category !== "Rankings" && update.category !== "Performance").length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Newspaper className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Latest News & Updates</h3>
                    </div>
                    {updates.filter(update => update.category !== "Rankings" && update.category !== "Performance").map((update) => (
                      <div key={update.id} className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center gap-2 mt-0.5">
                            {getTypeIcon(update.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm">{update.title}</h4>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getTypeColor(update.type)}`}
                              >
                                {update.type}
                              </Badge>
                              {update.isNew && (
                                <Badge variant="default" className="bg-red-100 text-red-800 text-xs">
                                  NEW
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {update.description}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatDate(update.date)}</span>
                              {update.category && (
                                <>
                                  <span>•</span>
                                  <span>{update.category}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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