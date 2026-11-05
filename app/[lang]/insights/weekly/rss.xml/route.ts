import { insightsFeedResponse } from '../../insights-rss';

/**
 * #198: the weekly Insights RSS 2.0 feed at `/{lang}/insights/weekly/rss.xml`; see `insightsFeedResponse`.
 *
 * Test: `tests/unit/insights-rss-198.test.ts`.
 */

// #198: rendered per request; the CDN caches through Cache-Control, so an error is never stored.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }): Promise<Response> {
  const { lang } = await params;
  return insightsFeedResponse('weekly', lang);
}
