import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PastReports, SummaryView } from '@/components/whats-new/summary-view';
import { createJsonLdScript } from '@/lib/schema';
import { createMonthlyReportSchema } from '@/lib/seo/schema';
import { getStoredSummary, listPeriods } from '@/lib/services/whats-new-summary.service';
import { firstSentence, formatPeriod, isValidPeriod } from '@/lib/whats-new-period';
import { whatsNewReportMetadata } from '../page-metadata';

// #54: rendered on request and cached for 30 minutes, like the index.
export const revalidate = 1800;

type PageProps = { params: Promise<{ lang: string; period: string }> };

/**
 * The stored report for a permalink's `period`, or a 404.
 *
 * Why: #54: a permalink names exactly one month. A malformed period or one
 * with no stored row is a 404, never the latest report in its place. A failed
 * database read is not "no such report", so it throws (5xx) rather than 404.
 * What: `notFound()` unless `period` is `YYYY-MM` with month 01-12 and a row
 * exists; deduplicated per request between metadata and page via `cache()`.
 */
const loadReport = cache(async (period: string) => {
  if (!isValidPeriod(period)) notFound();
  const summary = await getStoredSummary(period);
  if (!summary) notFound();
  return summary;
});

function describe(content: string, period: string): string {
  return firstSentence(content) ?? `AI Power Rankings monthly report for ${formatPeriod(period)}.`;
}

/**
 * Metadata for `/[lang]/whats-new/<period>`.
 *
 * What: `whatsNewReportMetadata()`: a self-canonical `/en` permalink, the month
 * in the title, and the report's first sentence as the description. A missing
 * report 404s here first, so no canonical is emitted for it.
 * Test: `tests/unit/whats-new-permalink.test.ts`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, period } = await params;
  const summary = await loadReport(period);
  return whatsNewReportMetadata(lang, period, describe(summary.content, period));
}

/**
 * One monthly What's New report at its permanent URL (#54).
 *
 * What: The report (h1 = its month), one JSON-LD `Article` block whose
 * `mainEntityOfPage` is the canonical, and links to the other stored reports.
 * Test: `tests/unit/whats-new-permalink.test.ts`.
 */
export default async function WhatsNewReportPage({ params }: PageProps) {
  const { lang, period } = await params;
  const summary = await loadReport(period);
  const periods = (await listPeriods()).map((p) => p.period);
  const metadata = whatsNewReportMetadata(lang, period, describe(summary.content, period));
  const canonical = String(metadata.alternates?.canonical);
  const schema = createMonthlyReportSchema({
    headline: `What's New: ${formatPeriod(period)}`,
    description: String(metadata.description),
    canonical,
    createdAt: summary.createdAt,
    generatedAt: summary.generatedAt,
  });

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        // #54: `<` keeps a `<` in report text from closing the script tag.
        dangerouslySetInnerHTML={{ __html: createJsonLdScript(schema).replace(/</g, '\\u003c') }}
      />
      <SummaryView summary={summary} headingLevel="h1" />
      <PastReports lang={lang} periods={periods} current={period} />
    </div>
  );
}
