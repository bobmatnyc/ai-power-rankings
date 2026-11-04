import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { WeeklyInsight } from '@/components/insights/weekly-insight';
import { getStoredDigest } from '@/lib/services/weekly-digest.repository';
import { firstSentence } from '@/lib/whats-new-period';
import { digestBody, digestRange, windowForWeek } from '@/lib/weekly-digest-window';
import { INSIGHTS_TITLE, insightsPreviewMetadata, requireInsightsPreview, weeklyInsightPath } from '../../preview-gate';

// #198: rendered on request and cached for 30 minutes, like the #181 permalinks.
export const revalidate = 1800;

type PageProps = { params: Promise<{ lang: string; week: string }> };

/**
 * The stored digest for `week`, or a 404.
 *
 * Why: #198: with the flag off the route answers 404 before any read. A key that
 * is not a real ISO week, or one with no stored row, is a 404. A failed read is
 * not "no such digest", so it throws (5xx), never 404.
 * What: deduplicated per request between metadata and page via `cache()`.
 */
const loadDigest = cache(async (week: string) => {
  requireInsightsPreview();
  if (!windowForWeek(week)) notFound();
  const digest = await getStoredDigest(week);
  if (!digest) notFound();
  return digest;
});

/**
 * Metadata for `/[lang]/insights/weekly/<week>` (#198).
 *
 * What: `insightsPreviewMetadata()`: noindex, the `/en` canonical, the week range
 * in the title and the digest's first sentence as the description.
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, week } = await params;
  const digest = await loadDigest(week);
  const range = digestRange(week);
  return insightsPreviewMetadata(
    lang,
    weeklyInsightPath(week),
    `Weekly insight: ${range} | ${INSIGHTS_TITLE}`,
    firstSentence(digestBody(digest.content)) ?? `AI Power Rankings weekly insight for ${range}.`
  );
}

/**
 * One weekly digest in the Insight template (#198).
 *
 * Test: `tests/unit/insights-weekly-198.test.tsx`.
 */
export default async function WeeklyInsightPage({ params }: PageProps) {
  const { week } = await params;
  const digest = await loadDigest(week);
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <WeeklyInsight digest={digest} />
    </div>
  );
}
