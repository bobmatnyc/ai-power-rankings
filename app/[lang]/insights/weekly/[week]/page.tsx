import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { WeeklyInsight } from '@/components/insights/weekly-insight';
import { getStoredDigest } from '@/lib/services/weekly-digest.repository';
import { firstSentence } from '@/lib/whats-new-period';
import { digestBody, digestRange, windowForWeek } from '@/lib/weekly-digest-window';
import {
  INSIGHTS_TITLE,
  insightJsonLd,
  insightsPreviewMetadata,
  requireInsightsPreview,
  weeklyInsightPath,
} from '../../preview-gate';

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

/** #198: the page title's headline; the JSON-LD `headline` repeats it. */
function headline(week: string): string {
  return `Weekly insight: ${digestRange(week)}`;
}

/** #198: one builder for `generateMetadata` and the JSON-LD block, so they cannot disagree. */
function weeklyMetadata(lang: string, week: string, digest: Awaited<ReturnType<typeof loadDigest>>): Metadata {
  return insightsPreviewMetadata(
    lang,
    weeklyInsightPath(week),
    `${headline(week)} | ${INSIGHTS_TITLE}`,
    firstSentence(digestBody(digest.content)) ?? `AI Power Rankings weekly insight for ${digestRange(week)}.`,
    digest
  );
}

/**
 * Metadata for `/[lang]/insights/weekly/<week>` (#198).
 *
 * What: `insightsPreviewMetadata()`: indexable (#198), the `/en` canonical, the week range
 * in the title, the digest's first sentence as the description and an
 * `article` Open Graph dated by the digest row.
 * Test: `tests/unit/insights-weekly-198.test.tsx`, `tests/unit/insights-launch-198.test.tsx`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, week } = await params;
  return weeklyMetadata(lang, week, await loadDigest(week));
}

/**
 * One weekly digest in the Insight template (#198), with its JSON-LD `Article` block.
 *
 * Test: `tests/unit/insights-weekly-198.test.tsx`, `tests/unit/insights-launch-198.test.tsx`.
 */
export default async function WeeklyInsightPage({ params }: PageProps) {
  const { lang, week } = await params;
  const digest = await loadDigest(week);
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: #198: JSON-LD with every `<` escaped
        dangerouslySetInnerHTML={{ __html: insightJsonLd(weeklyMetadata(lang, week, digest), headline(week), digest) }}
      />
      <WeeklyInsight digest={digest} />
    </div>
  );
}
