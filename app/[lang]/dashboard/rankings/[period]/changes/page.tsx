import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { RankingChangesSummary } from "./ranking-changes-summary";

// Force dynamic rendering - this page may use authentication context
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    lang: Locale;
    period: string;
  }>;
}

export default async function RankingChangesPage({ params }: PageProps) {
  const { lang, period } = await params;
  const dict = await getDictionary(lang as Locale);

  return <RankingChangesSummary period={period} lang={lang as Locale} dict={dict} />;
}
