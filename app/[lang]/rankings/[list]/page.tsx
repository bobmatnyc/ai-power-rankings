import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listFromSlug } from "@/lib/rankings/lists";
import { RankingListPage, rankingListMetadata } from "../ranking-list-page";

/**
 * `/<locale>/rankings/<slug>`: one list's ranking page (#186).
 *
 * `models` and `productivity-tools` are the model and productivity boards;
 * `coding-harnesses` is the harness board, whose canonical is `/rankings` (D51).
 * Any other slug is a 404.
 * Test: `tests/unit/ranking-list-pages-186.test.tsx`.
 */
interface PageProps {
  params: Promise<{ lang: string; list: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang, list: slug } = await params;
  const list = listFromSlug(slug);
  if (!list) notFound();
  return rankingListMetadata(lang, list);
}

export const dynamic = "force-dynamic";

export default async function RankingListRoute({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, list: slug } = await params;
  const list = listFromSlug(slug);
  if (!list) notFound();
  return RankingListPage({ lang, list });
}
