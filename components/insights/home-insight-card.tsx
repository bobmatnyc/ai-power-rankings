import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { insightsPreviewEnabled, weeklyInsightPath } from '@/app/[lang]/insights/preview-gate';
import type { DigestViewData } from '@/components/whats-new/weekly-digest-view';
import { listDigests } from '@/lib/services/weekly-digest.repository';
import { firstSentence } from '@/lib/whats-new-period';
import { digestBody, digestRange } from '@/lib/weekly-digest-window';

/**
 * The home page's "This week" card: the latest weekly Insight (#198).
 *
 * Why: #198: proposal M5-7 shows the weekly digest on the home page as a
 * "This week" card linking its Insight page and the hub.
 * What: a labelled `section` with a "This week" eyebrow, the week range as an
 * h2 linking `/<lang>/insights/weekly/<week>`, the digest's first sentence,
 * and an "All insights" link to `/<lang>/insights`.
 * Test: `tests/unit/insights-launch-198.test.tsx`.
 */
export function HomeInsightCard({ lang, digest }: { lang: string; digest: DigestViewData }) {
  const lead = firstSentence(digestBody(digest.content));
  return (
    <section aria-labelledby="home-this-week" className="px-3 md:px-6 py-8 mx-auto max-w-7xl" data-card="this-week">
      <div className="rounded-lg border border-ds-border-paper bg-muted/30 p-6 space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">This week</p>
        <h2 id="home-this-week" className="text-2xl font-semibold">
          <Link href={`/${lang}${weeklyInsightPath(digest.week)}`} className="hover:underline">
            {digestRange(digest.week)}
          </Link>
        </h2>
        {lead && <p className="text-muted-foreground">{lead}</p>}
        <p>
          <Link href={`/${lang}/insights`} className="inline-flex items-center text-sm text-primary hover:underline">
            All insights
            <ArrowRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * Renders `children`, then the "This week" card when the Insights preview is on (#198).
 *
 * Why: #198: with `INSIGHTS_PREVIEW` off the home page must be byte-for-byte
 * what it was. A `{flag && <Card/>}` child would add a `null` slot to the
 * page's serialised tree; a server component that returns its children
 * unchanged adds nothing.
 * What: flag off: returns `children` itself and reads nothing. Flag on: reads
 * the newest stored digest (`listDigests(1)`); none stored returns `children`;
 * otherwise `children` followed by `HomeInsightCard`. A failed read is not
 * caught, so the render fails and ISR keeps the last good page (#368).
 * Test: `tests/unit/insights-launch-198.test.tsx`.
 */
export async function HomeInsightSlot({ lang, children }: { lang: string; children: ReactNode }) {
  if (!insightsPreviewEnabled()) return children;
  const [latest] = await listDigests(1);
  if (!latest) return children;
  return (
    <>
      {children}
      <HomeInsightCard lang={lang} digest={latest} />
    </>
  );
}
