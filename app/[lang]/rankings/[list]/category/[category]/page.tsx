import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { harnessCategory } from "@/lib/rankings/harness-category";
import { RankingListPage, rankingListMetadata, shownRankingList } from "../../../ranking-list-page";

/**
 * The harness board filtered by category, served at `/<locale>/rankings/coding-harnesses?category=<value>` (#196).
 *
 * Why: the #191 URL table sends the old `/best-*` pages to `?category=` views of the
 *   harness board. Reading `searchParams` would make the board dynamic and undo its ISR
 *   (#368), so the middleware rewrites a known `?category=` to this static route
 *   (`harnessCategoryRewrite`), as #195 does for `?open=1`.
 * What: only `coding-harnesses` has this page; any other slug is a 404. The body is the
 *   harness board with only the category's rows (`harnessCategory`; an unknown value,
 *   reachable only by a direct request, shows the unfiltered board). The metadata is the
 *   unfiltered board's, so the canonical stays `/<locale>/rankings` (D51): a filtered view,
 *   not a page of its own. It is not in the sitemap.
 * Test: `tests/unit/rankings-category-196.test.ts`.
 */
interface PageProps {
  params: Promise<{ lang: string; list: string; category: string }>;
}

/** The harness list for `slug`, or a 404: only the harness board has category views. */
async function harnessList(slug: string) {
  const list = await shownRankingList(slug);
  if (list !== "harness") notFound();
  return list;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, list: slug } = await params;
  // #196: the unfiltered board's metadata, so the canonical is the board's (D51).
  return rankingListMetadata(lang, await harnessList(slug));
}

// #196: ISR like the unfiltered board (#368).
export const revalidate = 300;
export function generateStaticParams(): Array<{ lang: string; list: string; category: string }> {
  return [];
}

export default async function CategoryRankingRoute({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, list: slug, category } = await params;
  return RankingListPage({ lang, list: await harnessList(slug), category: harnessCategory(category) });
}
