import type { SummaryViewData } from '@/components/whats-new/summary-view';
import { formatPeriod } from '@/lib/whats-new-period';
import { InsightBody, InsightPublished } from './insight-body';

/**
 * The monthly Insight template (#198): one stored monthly report at its permalink.
 *
 * Why: #198 slice 2: proposal M5-7 names one Insight template for weekly and
 * monthly. The #182 report is stored as markdown (a `# ` title, then "The month
 * in brief", "Key developments", "New tools and ranking updates", "What to
 * watch"), so the page mirrors that stored shape, as the weekly page does.
 * What: An `article` with a header (a "Monthly insight" eyebrow, the month as
 * the page's only h1, the current version's generation date in UTC), then the
 * shared `InsightBody`: the opening as a lead and one labelled `section` per
 * `##` section. Raw HTML in the report renders as text.
 * Test: `tests/unit/insights-monthly-198.test.tsx`.
 */
export function MonthlyInsight({ report }: { report: SummaryViewData }) {
  return (
    <article className="space-y-8" data-template="insight-monthly">
      <header className="space-y-2 border-b border-ds-border-paper pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Monthly insight</p>
        <h1 className="text-3xl font-bold">{formatPeriod(report.period)}</h1>
        <InsightPublished date={report.generatedAt} />
      </header>
      <InsightBody content={report.content} />
    </article>
  );
}
