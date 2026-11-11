import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { listDigests } from '@/lib/services/weekly-digest.repository';
import { listPeriods } from '@/lib/services/whats-new-summary.service';
import { firstSentence, formatPeriod } from '@/lib/whats-new-period';
import { digestBody, digestRange } from '@/lib/weekly-digest-window';
import {
  INSIGHTS_TITLE,
  insightsPreviewMetadata,
  monthlyInsightPath,
  requireInsightsPreview,
  weeklyInsightPath,
} from './preview-gate';

// #198: rendered on request and cached for 30 minutes, like /whats-new.
export const revalidate = 1800;

/** #198: how many weeks the hub lists; a year of Mondays. */
const INSIGHTS_WEEK_LIST_SIZE = 52;

type PageProps = { params: Promise<{ lang: string }> };

/**
 * Metadata for the `/[lang]/insights` hub (#198).
 *
 * What: 404 when the flag is off; otherwise `insightsPreviewMetadata()` for
 * `/insights` (indexable, `/en` canonical; #198: the flag lifts the noindex). Reads nothing.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  requireInsightsPreview();
  const { lang } = await params;
  return insightsPreviewMetadata(
    lang,
    '/insights',
    INSIGHTS_TITLE,
    // #198: the hub lists both cadences since slice 2.
    'Weekly and monthly insights on AI coding tools: what moved, what shipped and what to watch.'
  );
}

/**
 * The Insights hub: the latest weekly insight, every stored week and every stored month (#198).
 *
 * Why: #198: proposal M5-7 makes `/insights` the hub of the weekly digests
 * (#181) and the monthly reports (#182). Prod may hold no digest until the
 * first Monday cron, so "none stored" is a normal state; a failed read must
 * not look like it.
 * What: 404 when the flag is off, before any read. Otherwise reads up to
 * `INSIGHTS_WEEK_LIST_SIZE` digests and every monthly period, newest first.
 * Neither stored: the empty state. Digests: the newest week's range and first
 * sentence linking its permalink, then a list of every week. Periods: a list
 * of every month. A failed read is not caught; it throws to the error
 * boundary (5xx).
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export default async function InsightsPage({ params }: PageProps) {
  requireInsightsPreview();
  const { lang } = await params;
  // #198: no catch. A read error must surface as an error, never as the empty state.
  const [digests, periods] = await Promise.all([listDigests(INSIGHTS_WEEK_LIST_SIZE), listPeriods()]);
  const latest = digests[0];

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Insights</h1>
        <p className="text-muted-foreground">
          What moved, what shipped and what to watch in AI coding tools, week by week and month by month.
        </p>
      </header>

      {/* #198: the empty state only when neither cadence has a stored row. */}
      {!latest && periods.length === 0 && (
        <div className="text-center py-16" data-state="empty">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No insights yet</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            The first weekly insight is published after the week it covers closes. Check back on Monday.
          </p>
        </div>
      )}
      {latest && (
        <>
          <section aria-labelledby="insights-latest" className="space-y-2 border-b border-ds-border-paper pb-8">
            <h2 id="insights-latest" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Latest week
            </h2>
            <p className="text-2xl font-semibold">
              <Link href={`/${lang}${weeklyInsightPath(latest.week)}`} className="hover:underline">
                {digestRange(latest.week)}
              </Link>
            </p>
            <p className="text-muted-foreground">{firstSentence(digestBody(latest.content))}</p>
          </section>
          <nav aria-labelledby="insights-weeks">
            <h2 id="insights-weeks" className="text-lg font-semibold mb-3">
              Weekly insights
            </h2>
            <ul className="space-y-1 text-sm">
              {digests.map((digest) => (
                <li key={digest.week}>
                  <Link
                    href={`/${lang}${weeklyInsightPath(digest.week)}`}
                    className="text-ds-accent-fixed hover:underline"
                  >
                    {digestRange(digest.week)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
      {periods.length > 0 && (
        <nav aria-labelledby="insights-months">
          <h2 id="insights-months" className="text-lg font-semibold mb-3">
            Monthly insights
          </h2>
          <ul className="space-y-1 text-sm">
            {periods.map(({ period }) => (
              <li key={period}>
                <Link href={`/${lang}${monthlyInsightPath(period)}`} className="text-ds-accent-fixed hover:underline">
                  {formatPeriod(period)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
