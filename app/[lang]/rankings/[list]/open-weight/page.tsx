import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RankingListPage, rankingListMetadata, shownRankingList } from "../../ranking-list-page";

/**
 * The open-weight models board, served at `/<locale>/rankings/models?open=1` (#195).
 *
 * Why: `?open=1` filters the models board to open-weight models. Reading
 *   `searchParams` would make `/rankings/models` dynamic and undo its ISR (#368), so
 *   the middleware rewrites `?open=1` to this static route instead
 *   (`openWeightRewrite`), and a direct request for this path is sent to `?open=1`.
 * What: only `models` has this page; any other slug, or a hidden models page (D6e),
 *   is a 404. The body is the models page with the open-weight board. The metadata
 *   is the unfiltered models page's, so its canonical is `/<locale>/rankings/models`:
 *   a filtered view of that board, like `/tools?category=`, not a page of its own.
 *   It is not in the sitemap.
 * Test: `tests/unit/rankings-open-weight-195.test.ts`.
 */
interface PageProps {
  params: Promise<{ lang: string; list: string }>;
}

/** The model list for `slug`, or a 404: only the models board has an open-weight view. */
async function modelList(slug: string) {
  const list = await shownRankingList(slug);
  if (list !== "model") notFound();
  return list;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, list: slug } = await params;
  // #195: the unfiltered page's metadata, so the canonical names `/rankings/models`.
  return rankingListMetadata(lang, await modelList(slug));
}

// #195: ISR like the unfiltered board (#368).
export const revalidate = 300;
export function generateStaticParams(): Array<{ lang: string; list: string }> {
  return [];
}

export default async function OpenWeightRankingRoute({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, list: slug } = await params;
  return RankingListPage({ lang, list: await modelList(slug), openWeightOnly: true });
}
