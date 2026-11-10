import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AnchorHTMLAttributes } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractExternalLinks, filterChromeLinks, stripRelatedLinksSection } from '@/lib/article-content-links';
import { formatUtcDate } from '@/lib/format-utc-date';
import type { NewsArticleDetail } from '@/lib/news-article';

const PROSE =
  'prose prose-lg max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary hover:prose-a:underline prose-p:leading-relaxed';

/** #198: an article tool tag; one per kind (#187), else the primary tool alone. */
type ArticleToolTag = { slug: string; name: string };

/** #198: the tags to show: the per-kind tags when the catalogue read worked, else the primary tool. */
function toolTags(detail: Pick<NewsArticleDetail, 'tool' | 'tools'>): ArticleToolTag[] {
  if (detail.tools && detail.tools.length > 0) return detail.tools;
  return detail.tool ? [{ slug: detail.tool.slug, name: detail.tool.name }] : [];
}

/** #198: an external link opens in a new tab with no opener or referrer; an in-site link stays. */
function BodyLink({ href, className, children }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = /^https?:\/\//i.test(href ?? '');
  return external ? (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

/**
 * The Article template: one news article in the M5 design (#198).
 *
 * Why: #198: proposal M5-7 names an Article template beside the Insight
 * template. Articles hold most of the site's views and are its search base,
 * so the template keeps the stored body (`rewritten_content`) and shows the
 * 80-120 word summary, the source link and the tool tags the proposal names.
 * What: an `article` with a header (a "News" eyebrow linking the news hub, the
 * title as the page's only h1, the UTC publication date and the source,
 * linked when the article has a source URL), the summary as a lead when it
 * differs from the body, one tag per tool linking `/<lang>/tools/<slug>`, the
 * body without its in-body "Related Links" block, a "Referenced links" list
 * (chrome links filtered, #122), and a "Read the original" link. Markdown
 * renders without `rehype-raw`, so raw HTML in a body renders as text.
 * Test: `tests/unit/article-template-198.test.tsx`.
 */
export function ArticleTemplate({
  lang,
  article,
  tool,
  tools,
}: Pick<NewsArticleDetail, 'article' | 'tool' | 'tools'> & { lang: string }) {
  const body = stripRelatedLinksSection(article.content);
  const links = filterChromeLinks(extractExternalLinks(article.content));
  const tags = toolTags({ tool, tools });
  const summary = article.summary?.trim();
  const published = new Date(article.published_date);

  return (
    <article className="space-y-8" data-template="article">
      <header className="space-y-3 border-b border-ds-border-paper pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Link href={`/${lang}/news`} className="hover:underline">
            News
          </Link>
        </p>
        <h1 className="text-3xl md:text-4xl font-bold">{article.title}</h1>
        <p className="text-sm text-muted-foreground">
          <time dateTime={published.toISOString()}>
            {formatUtcDate(published, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
          {' · '}
          {article.source_url ? (
            <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {article.source}
            </a>
          ) : (
            <span>{article.source}</span>
          )}
        </p>
        {tags.length > 0 && (
          <ul aria-label="Tools in this article" className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.slug}>
                <Link
                  href={`/${lang}/tools/${tag.slug}`}
                  className="inline-block rounded-full border border-ds-border-paper px-3 py-1 text-xs hover:bg-muted"
                >
                  {tag.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>

      {summary && summary !== article.content.trim() && (
        <p className="text-lg leading-relaxed" data-part="summary">
          {summary}
        </p>
      )}

      <div className={PROSE} data-part="body">
        {body.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: BodyLink }}>
            {body}
          </ReactMarkdown>
        ) : (
          <p className="text-muted-foreground">No content available</p>
        )}
      </div>

      {links.length > 0 && (
        <section aria-labelledby="article-links" className="space-y-3 border-t border-ds-border-paper pt-6">
          <h2 id="article-links" className="text-lg font-semibold">
            Referenced links
          </h2>
          <ul className="space-y-2 text-sm">
            {links.map((link) => (
              <li key={link.url}>
                <BodyLink href={link.url} className="text-primary hover:underline break-all">
                  {link.text}
                </BodyLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {article.source_url && (
        <footer className="border-t border-ds-border-paper pt-6">
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-primary hover:underline"
          >
            <ExternalLink aria-hidden="true" className="mr-2 h-4 w-4" />
            Read the original at {article.source}
          </a>
        </footer>
      )}
    </article>
  );
}
