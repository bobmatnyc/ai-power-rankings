import Link from 'next/link';
import { Calendar, Newspaper, Wrench, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import { type ListLoadResult, loadList } from '@/lib/load-list';
import { siteOrigin } from '@/lib/site-origin';
import type { Metadata } from 'next';
import { whatsNewPageMetadata } from '../page-metadata';

// #156: English canonical, no hreflang (see whatsNewPageMetadata); the layout sets no alternates.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return whatsNewPageMetadata(lang, "/whats-new/recent");
}

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

// #152: a failed read is `{ ok: false }`, never an empty feed; `no-store` as before.
function getRecentUpdates(): Promise<ListLoadResult<UnifiedFeedItem>> {
  // #219: the env var is unset in production, so a localhost fallback always failed.
  return loadList<UnifiedFeedItem>(`${siteOrigin()}/api/whats-new?days=7`, 'feed', {
    cache: 'no-store', // Always fetch fresh data
  });
}

function getItemTypeIcon(item: UnifiedFeedItem) {
  if (item.type === 'news') {
    return <Newspaper className="h-5 w-5 text-ds-accent-cat-purple-strong" />;
  } else if (item.type === 'tool') {
    return <Wrench className="h-5 w-5 text-ds-accent-fixed" />;
  } else {
    // Platform updates
    switch (item.changeType) {
      case 'feature':
        return <Sparkles className="h-5 w-5 text-ds-accent-cat-green-strong" />;
      case 'improvement':
        return <TrendingUp className="h-5 w-5 text-ds-accent-fixed" />;
      case 'fix':
        return <Wrench className="h-5 w-5 text-ds-accent-cat-orange-strong" />;
      case 'news':
        return <Newspaper className="h-5 w-5 text-ds-accent-cat-purple-strong" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  }
}

function getItemTypeBadge(item: UnifiedFeedItem) {
  if (item.type === 'news') {
    return (
      <Badge variant="secondary" className="bg-ds-surface-tag-purple text-ds-text-tag-purple border-ds-border-tag-purple">
        News
      </Badge>
    );
  } else if (item.type === 'tool') {
    return (
      <Badge variant="secondary" className="bg-ds-surface-tag-blue text-ds-text-tag-blue border-ds-border-tag-blue">
        Tool Update
      </Badge>
    );
  } else {
    // Platform updates
    const typeColors = {
      feature: 'bg-ds-surface-tag-green text-ds-text-tag-green border-ds-border-tag-green',
      improvement: 'bg-ds-surface-tag-blue text-ds-text-tag-blue border-ds-border-tag-blue',
      fix: 'bg-ds-surface-tag-orange text-ds-text-tag-orange border-ds-border-tag-orange',
      news: 'bg-ds-surface-tag-purple text-ds-text-tag-purple border-ds-border-tag-purple',
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
  const result = await getRecentUpdates();

  if (!result.ok) {
    // #152: a failed read is an error with a retry, never "No Recent Updates".
    console.error('Failed to fetch recent updates:', result.reason);
    const dict = await getDictionary(lang as Locale);
    return (
      <Card className="p-8 text-center" role="alert">
        <p className="text-muted-foreground mb-4">{dict.common.error}</p>
        <Button asChild variant="outline" size="sm">
          <a href={`/${lang}/whats-new/recent`}>{dict.common.tryAgain}</a>
        </Button>
      </Card>
    );
  }

  const feedItems = result.items;
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
              <div className="flex items-start gap-4 p-4 rounded-lg border border-ds-border-neutral bg-card hover:bg-muted/50 transition-colors">
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
              <div className="flex items-start gap-4 p-4 rounded-lg border border-ds-border-neutral bg-card hover:bg-muted/50 transition-colors">
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
              className="flex items-start gap-4 p-4 rounded-lg border border-ds-border-neutral bg-card"
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
