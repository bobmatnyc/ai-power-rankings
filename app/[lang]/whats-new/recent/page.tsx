import Link from 'next/link';
import { Calendar, Newspaper, Wrench, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type UnifiedFeedItem =
  | {
      type: 'news';
      date: string;
      id: string;
      slug: string;
      title: string;
      summary: string;
      published_at: string;
      source: string;
      source_url?: string;
    }
  | {
      type: 'tool';
      date: string;
      id: string;
      name: string;
      slug: string;
      description: string;
      updatedAt: string;
      category: string;
    }
  | {
      type: 'platform';
      date: string;
      id: string;
      title: string;
      description: string;
      category: string;
      changeType: 'feature' | 'improvement' | 'fix' | 'news';
      version: string;
    };

async function getRecentUpdates(): Promise<UnifiedFeedItem[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/whats-new?days=7`, {
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      console.error('Failed to fetch recent updates:', response.status);
      return [];
    }

    const data = await response.json();
    return data.feed || [];
  } catch (error) {
    console.error('Error fetching recent updates:', error);
    return [];
  }
}

function getItemTypeIcon(item: UnifiedFeedItem) {
  if (item.type === 'news') {
    return <Newspaper className="h-5 w-5 text-purple-600" />;
  } else if (item.type === 'tool') {
    return <Wrench className="h-5 w-5 text-blue-600" />;
  } else {
    // Platform updates
    switch (item.changeType) {
      case 'feature':
        return <Sparkles className="h-5 w-5 text-green-600" />;
      case 'improvement':
        return <TrendingUp className="h-5 w-5 text-blue-600" />;
      case 'fix':
        return <Wrench className="h-5 w-5 text-orange-600" />;
      case 'news':
        return <Newspaper className="h-5 w-5 text-purple-600" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  }
}

function getItemTypeBadge(item: UnifiedFeedItem) {
  if (item.type === 'news') {
    return (
      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
        News
      </Badge>
    );
  } else if (item.type === 'tool') {
    return (
      <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300">
        Tool Update
      </Badge>
    );
  } else {
    // Platform updates
    const typeColors = {
      feature: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300',
      improvement: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
      fix: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
      news: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return (
      <Badge variant="secondary" className={typeColors[item.changeType]}>
        Platform: {item.changeType}
      </Badge>
    );
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInHours < 48) {
    return 'Yesterday';
  } else {
    const days = Math.floor(diffInHours / 24);
    return `${days}d ago`;
  }
}

export default async function RecentUpdatesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const feedItems = await getRecentUpdates();

  if (feedItems.length === 0) {
    return (
      <div className="text-center py-16">
        <Newspaper className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Recent Updates</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Check back soon for the latest news, tool updates, and platform improvements.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedItems.map((item) => {
        if (item.type === 'news') {
          return (
            <Link
              key={item.id}
              href={`/${lang}/news/${item.slug}`}
              className="block group"
            >
              <div className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-card hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getItemTypeIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {getItemTypeBadge(item)}
                  </div>
                  {item.summary && (
                    <p className="text-muted-foreground mb-3 line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(item.date)}</span>
                    {item.source && (
                      <>
                        <span>•</span>
                        <span>{item.source}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        } else if (item.type === 'tool') {
          return (
            <Link
              key={item.id}
              href={`/${lang}/tools/${item.slug}`}
              className="block group"
            >
              <div className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-card hover:bg-muted/50 transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getItemTypeIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {item.name}
                    </h3>
                    {getItemTypeBadge(item)}
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-muted-foreground mb-3 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{formatDate(item.date)}</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        } else {
          // Platform update
          return (
            <div
              key={item.id}
              className="flex items-start gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-card"
            >
              <div className="flex-shrink-0 mt-1">
                {getItemTypeIcon(item)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="font-semibold text-lg">{item.title}</h3>
                  {getItemTypeBadge(item)}
                  {item.version && (
                    <Badge variant="outline" className="text-xs">
                      v{item.version}
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mb-3">
                  {item.description}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(item.date)}</span>
                  <span>•</span>
                  <span>{item.category}</span>
                </div>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
