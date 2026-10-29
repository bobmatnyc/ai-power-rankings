import { FileText } from 'lucide-react';
import type { Metadata } from 'next';
import { SummaryView } from '@/components/whats-new/summary-view';
import { WeeklyDigestList } from '@/components/whats-new/weekly-digest-view';
import { loggers } from '@/lib/logger';
import { listDigests } from '@/lib/services/weekly-digest.repository';
import { getLatestStoredSummary } from '@/lib/services/whats-new-summary.service';
import { reportPath, whatsNewPageMetadata } from './page-metadata';

// #54: rendered on request and cached for 30 minutes, the window the old
// summary fetch revalidated on.
export const revalidate = 1800;

// #181: how many weekly digests the index lists.
const WEEKLY_LIST_SIZE = 8;

/**
 * Metadata for the `/[lang]/whats-new` index.
 *
 * Why: #156: English canonical, no hreflang; the layout sets no alternates.
 * #54: the index shows the latest report, which has its own permalink, so the
 * index canonicalises to that permalink while one exists.
 * What: `whatsNewPageMetadata()` for `/whats-new/<latest period>`, or for
 * `/whats-new` when no report is stored. A failed read throws (an error page),
 * never a guessed canonical.
 * Test: `tests/unit/seo-canonical-origin.test.ts`, `tests/unit/whats-new-permalink.test.ts`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const latest = await getLatestStoredSummary();
  return whatsNewPageMetadata(lang, latest ? reportPath(latest.period) : '/whats-new');
}

/**
 * The latest monthly report, or the empty state when none is stored.
 *
 * Why: #54: this page fetched the relative URL `/api/whats-new/summary` from a
 * server component. A server-side `fetch` has no origin to resolve it against,
 * so it rejected, the error was swallowed, and every visitor saw "No Monthly
 * Summary Available" while a summary was stored.
 * What: Reads the latest stored row through the summary service and renders it
 * with a link to its permalink. The empty state means no row exists; a failed
 * monthly read throws to the error boundary instead. #181: the newest eight
 * weekly digests are listed under it (or under the empty state), each linking
 * its permalink. A failed weekly list read is logged and shows no list; the
 * page still renders.
 * Test: `tests/unit/whats-new-permalink.test.ts` (AC8),
 * `tests/unit/weekly-digest-display-181.test.tsx`.
 */
export default async function WhatsNewPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  // #181: the weekly list is optional; a failed read logs and shows no list, while a
  // failed monthly read still throws to the error boundary.
  const [summary, digests] = await Promise.all([
    getLatestStoredSummary(),
    listDigests(WEEKLY_LIST_SIZE).catch((error: unknown) => {
      loggers.api.error('/whats-new: weekly digest list read failed', {
        lang,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }),
  ]);
  const weeklyList = <WeeklyDigestList lang={lang} weeks={digests.map((d) => d.week)} />;

  if (!summary) {
    return (
      <div className="space-y-10">
        <div className="text-center py-16">
          <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Monthly Summary Available</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            A monthly summary has not been published yet. Check back later for insights into the
            latest AI tool rankings and platform updates.
          </p>
        </div>
        {weeklyList}
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <SummaryView
        summary={summary}
        headingLevel="h2"
        permalinkHref={`/${lang}${reportPath(summary.period)}`}
      />
      {weeklyList}
    </div>
  );
}
