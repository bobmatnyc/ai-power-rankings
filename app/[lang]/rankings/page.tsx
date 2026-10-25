import type { Metadata } from "next";
import { DEFAULT_RANKING_LIST } from "@/lib/rankings/lists";
import { RankingListPage, rankingListMetadata } from "./ranking-list-page";

interface PageProps {
  params: Promise<{ lang: string }>;
}

// #186: D51 — the unqualified rankings page is the coding-harness board.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  return rankingListMetadata(lang, DEFAULT_RANKING_LIST);
}

// Use dynamic rendering with optimized queries
export const dynamic = "force-dynamic";
// Consider ISR in the future: export const revalidate = 300;

export default async function RankingsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  return RankingListPage({ lang, list: DEFAULT_RANKING_LIST });
}
