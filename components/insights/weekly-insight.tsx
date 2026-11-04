import type { DigestViewData } from '@/components/whats-new/weekly-digest-view';
import { digestRange } from '@/lib/weekly-digest-window';
import { InsightBody, InsightPublished } from './insight-body';

// #198: the parser moved to `insight-body.tsx` so the monthly template shares it.
export { insightParts, type InsightParts, type InsightSection } from './insight-body';

/**
 * The weekly Insight template (#198): one stored digest at its permalink.
 *
 * What: An `article` with a header (a "Weekly insight" eyebrow, the week range
 * as the page's only h1, the publication date in UTC), the opening as a lead,
 * then one `section` per digest section, each labelled by its h2.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export function WeeklyInsight({ digest }: { digest: DigestViewData }) {
  return (
    <article className="space-y-8" data-template="insight-weekly">
      <header className="space-y-2 border-b border-ds-border-paper pb-6">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Weekly insight</p>
        <h1 className="text-3xl font-bold">{digestRange(digest.week)}</h1>
        <InsightPublished date={digest.generatedAt} />
      </header>
      <InsightBody content={digest.content} />
    </article>
  );
}
