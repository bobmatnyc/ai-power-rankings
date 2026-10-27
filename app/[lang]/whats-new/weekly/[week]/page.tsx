import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { WeeklyDigestView } from '@/components/whats-new/weekly-digest-view';
import { createJsonLdScript } from '@/lib/schema';
import { createMonthlyReportSchema } from '@/lib/seo/schema';
import { getStoredDigest } from '@/lib/services/weekly-digest.repository';
import { firstSentence } from '@/lib/whats-new-period';
import { digestBody, digestRange, windowForWeek } from '@/lib/weekly-digest-window';
import { whatsNewDigestMetadata } from '../../page-metadata';

// #181: rendered on request and cached for 30 minutes, like the monthly reports.
export const revalidate = 1800;

type PageProps = { params: Promise<{ lang: string; week: string }> };

/**
 * The stored digest for a permalink's `week`, or a 404.
 *
 * Why: #181: a permalink names exactly one ISO week. A malformed key, a key that
 * is not a real ISO week, or one with no stored row is a 404. A failed database
 * read is not "no such digest", so it throws (5xx) rather than 404.
 * What: deduplicated per request between metadata and page via `cache()`.
 */
const loadDigest = cache(async (week: string) => {
  if (!windowForWeek(week)) notFound();
  const digest = await getStoredDigest(week);
  if (!digest) notFound();
  return digest;
});

function describe(content: string, week: string): string {
  return firstSentence(digestBody(content)) ?? `AI Power Rankings weekly digest for ${digestRange(week)}.`;
}

/**
 * Metadata for `/[lang]/whats-new/weekly/<week>`.
 *
 * What: `whatsNewDigestMetadata()`: a self-canonical `/en` permalink, the week's
 * range in the title and the digest's first sentence as the description.
 * Test: `tests/unit/weekly-digest-display-181.test.tsx`.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, week } = await params;
  const digest = await loadDigest(week);
  return whatsNewDigestMetadata(lang, week, digestRange(week), describe(digest.content, week));
}

/**
 * One weekly digest at its permanent URL (#181).
 *
 * What: The digest (h1 = its week range) and one JSON-LD `Article` block whose
 * `mainEntityOfPage` is the canonical.
 * Test: `tests/unit/weekly-digest-display-181.test.tsx`.
 */
export default async function WeeklyDigestPage({ params }: PageProps) {
  const { lang, week } = await params;
  const digest = await loadDigest(week);
  const metadata = whatsNewDigestMetadata(lang, week, digestRange(week), describe(digest.content, week));
  const schema = createMonthlyReportSchema({
    headline: `Weekly digest: ${digestRange(week)}`,
    description: String(metadata.description),
    canonical: String(metadata.alternates?.canonical),
    createdAt: digest.createdAt,
    generatedAt: digest.generatedAt,
  });

  return (
    <div className="space-y-10">
      <script
        type="application/ld+json"
        // #181: `<` keeps a `<` in digest text from closing the script tag.
        dangerouslySetInnerHTML={{ __html: createJsonLdScript(schema).replace(/</g, '\\u003c') }}
      />
      <WeeklyDigestView digest={digest} />
    </div>
  );
}
