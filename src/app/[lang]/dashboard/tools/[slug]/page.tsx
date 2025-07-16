import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { DashboardToolDetail } from "./dashboard-tool-detail";

interface PageProps {
  params: Promise<{
    lang: Locale;
    slug: string;
  }>;
}

export default async function DashboardToolDetailPage({ params }: PageProps) {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);

  return (
    <div className="container mx-auto px-4 py-8">
      <DashboardToolDetail slug={slug} lang={lang} dict={dict} />
    </div>
  );
}
