import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listFromSlug } from "@/lib/rankings/lists";
import { isRankingListVisible } from "@/lib/rankings/model-page-visibility";
import { RankingListPage, rankingListMetadata } from "../ranking-list-page";

/**
 * `/<locale>/rankings/<slug>`: one list's ranking page (#186).
 *
 * `models` and `productivity-tools` are the model and productivity boards;
 * `coding-harnesses` is the harness board, whose canonical is `/rankings` (D51).
 * Any other slug is a 404, and so is `models` while the model board has no metric
 * row (D6e, `isRankingListVisible`).
 * Test: `tests/unit/ranking-list-pages-186.test.tsx`, `tests/unit/model-page-visibility-d6e.test.tsx`.
 */
interface PageProps {
  params: Promise<{ lang: string; list: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, list: slug } = await params;
  const list = listFromSlug(slug);
  // D6e: hide model page until model metrics land
  if (!list || !(await isRankingListVisible(list))) notFound();
  return rankingListMetadata(lang, list);
}

// #368: ISR like /rankings; unknown slugs still 404 on demand.
export const revalidate = 300;
export function generateStaticParams(): Array<{ lang: string; list: string }> {
  return [];
}

export default async function RankingListRoute({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, list: slug } = await params;
  const list = listFromSlug(slug);
  // D6e: hide model page until model metrics land
  if (!list || !(await isRankingListVisible(list))) notFound();
  return RankingListPage({ lang, list });
}
