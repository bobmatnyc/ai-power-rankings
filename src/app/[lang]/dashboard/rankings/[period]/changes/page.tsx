import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { RankingChangesSummary } from "./ranking-changes-summary";

interface PageProps {
  params: Promise<{
    lang: Locale;
    period: string;
  }>;
}

export default async function RankingChangesPage({ params }: PageProps) {
  const { lang, period } = await params;
  const dict = await getDictionary(lang);

  return <RankingChangesSummary period={period} lang={lang} dict={dict} />;
}
