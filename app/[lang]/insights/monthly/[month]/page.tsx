import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MonthlyInsight } from '@/components/insights/monthly-insight';
import { getStoredSummary } from '@/lib/services/whats-new-summary.service';
import { firstSentence, formatPeriod, isValidPeriod } from '@/lib/whats-new-period';
import { digestBody } from '@/lib/weekly-digest-window';
import { INSIGHTS_TITLE, insightsPreviewMetadata, monthlyInsightPath, requireInsightsPreview } from '../../preview-gate';

// #198: rendered on request and cached for 30 minutes, like /whats-new/<period>.
export const revalidate = 1800;

type PageProps = { params: Promise<{ lang: string; month: string }> };

/**
 * The current version of the stored report for `month`, or a 404.
 *
 * Why: #198 slice 2: with the flag off the route answers 404 before any read.
 * A key that is not `YYYY-MM` (month 01-12), or one with no stored report, is a
 * 404. A failed read is not "no such report", so it throws (5xx), never 404.
 * What: `getStoredSummary()` is the reader behind `/whats-new/<period>`: the
 * newest `monthly_report_versions` row, else the legacy row (#182).
 * Deduplicated per request between metadata and page via `cache()`.
 */
const loadReport = cache(async (month: string) => {
  requireInsightsPreview();
  if (!isValidPeriod(month)) notFound();
  const report = await getStoredSummary(month);
  if (!report) notFound();
  return report;
});

/**
 * Metadata for `/[lang]/insights/monthly/<month>` (#198).
 *
 * What: `insightsPreviewMetadata()`: noindex, the `/en` canonical, no hreflang,
 * the month in the title and the report's first sentence as the description.
 * Test: `tests/unit/insights-monthly-198.test.tsx`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, month } = await params;
  const report = await loadReport(month);
  const label = formatPeriod(month);
  return insightsPreviewMetadata(
    lang,
    monthlyInsightPath(month),
    `Monthly insight: ${label} | ${INSIGHTS_TITLE}`,
    firstSentence(digestBody(report.content)) ?? `AI Power Rankings monthly insight for ${label}.`
  );
}

/**
 * One monthly report in the Insight template (#198).
 *
 * Test: `tests/unit/insights-monthly-198.test.tsx`.
 */
export default async function MonthlyInsightPage({ params }: PageProps) {
  const { month } = await params;
  const report = await loadReport(month);
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <MonthlyInsight report={report} />
    </div>
  );
}
