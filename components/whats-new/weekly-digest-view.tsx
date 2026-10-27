import Link from 'next/link';
import { Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Separator } from '@/components/ui/separator';
import { digestBody, digestRange } from '@/lib/weekly-digest-window';

/** The stored-digest fields the views render (a `weekly_digests` row). */
export interface DigestViewData {
  week: string;
  content: string;
  generatedAt: Date | string;
}

/**
 * One weekly digest: range heading, generation date and markdown body.
 *
 * Why: #181: the interim display before the Insights pages (#198) reuses the
 * monthly report's layout rules.
 * What: Renders through react-markdown without `rehype-raw`, so raw HTML in a
 * digest is shown as text, never executed. Dates format in UTC.
 * Test: `tests/unit/weekly-digest-display-181.test.tsx`.
 */
export function WeeklyDigestView({ digest }: { digest: DigestViewData }) {
  const generated = new Date(digest.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Weekly digest: {digestRange(digest.week)}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Generated {generated}</span>
        </div>
      </div>
      <Separator />
      <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary hover:prose-a:underline prose-p:leading-relaxed prose-li:my-1">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{digestBody(digest.content)}</ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * "Weekly digests": a link to each stored week's permalink, newest first.
 *
 * What: Renders nothing for an empty list. The caller owns the order and the cap.
 */
export function WeeklyDigestList({
  lang,
  weeks,
}: {
  lang: string;
  weeks: readonly string[];
}) {
  if (weeks.length === 0) return null;
  return (
    <nav aria-label="Weekly digests" className="border-t border-ds-border-paper pt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-semibold">Weekly digests</h2>
        <Link href={`/${lang}/whats-new/rss.xml`} className="text-sm text-ds-accent-fixed hover:underline">
          RSS
        </Link>
      </div>
      <ul className="space-y-1 text-sm">
        {weeks.map((week) => (
          <li key={week}>
            <Link href={`/${lang}/whats-new/weekly/${week}`} className="text-ds-accent-fixed hover:underline">
              {digestRange(week)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
