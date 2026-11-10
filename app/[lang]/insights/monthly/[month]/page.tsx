import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MonthlyInsight } from '@/components/insights/monthly-insight';
import { getStoredSummary } from '@/lib/services/whats-new-summary.service';
import { firstSentence, formatPeriod, isValidPeriod } from '@/lib/whats-new-period';
import { digestBody } from '@/lib/weekly-digest-window';
import {
  INSIGHTS_TITLE,
  insightJsonLd,
  insightsPreviewMetadata,
  monthlyInsightPath,
  requireInsightsPreview,
} from '../../preview-gate';

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

/** #198: the page title's headline; the JSON-LD `headline` repeats it. */
function headline(month: string): string {
  return `Monthly insight: ${formatPeriod(month)}`;
}

/** #198: one builder for `generateMetadata` and the JSON-LD block, so they cannot disagree. */
function monthlyMetadata(lang: string, month: string, report: Awaited<ReturnType<typeof loadReport>>): Metadata {
  return insightsPreviewMetadata(
    lang,
    monthlyInsightPath(month),
    `${headline(month)} | ${INSIGHTS_TITLE}`,
    firstSentence(digestBody(report.content)) ?? `AI Power Rankings monthly insight for ${formatPeriod(month)}.`,
    report
  );
}

/**
 * Metadata for `/[lang]/insights/monthly/<month>` (#198).
 *
 * What: `insightsPreviewMetadata()`: noindex, the `/en` canonical, no hreflang,
 * the month in the title, the report's first sentence as the description and
 * an `article` Open Graph dated by the report.
 * Test: `tests/unit/insights-monthly-198.test.tsx`, `tests/unit/insights-launch-198.test.tsx`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, month } = await params;
  return monthlyMetadata(lang, month, await loadReport(month));
}

/**
 * One monthly report in the Insight template (#198), with its JSON-LD `Article` block.
 *
 * Test: `tests/unit/insights-monthly-198.test.tsx`, `tests/unit/insights-launch-198.test.tsx`.
 */
export default async function MonthlyInsightPage({ params }: PageProps) {
  const { lang, month } = await params;
  const report = await loadReport(month);
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: #198: JSON-LD with every `<` escaped
        dangerouslySetInnerHTML={{ __html: insightJsonLd(monthlyMetadata(lang, month, report), headline(month), report) }}
      />
      <MonthlyInsight report={report} />
    </div>
  );
}
