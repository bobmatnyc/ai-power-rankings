import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { ToolDetailClient } from "./tool-detail-client";

interface PageProps {
  params: Promise<{ lang: Locale; slug: string }>;
}

export default async function ToolDetailPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang, slug } = await params;
  const dict = await getDictionary(lang);

  return <ToolDetailClient slug={slug} lang={lang} dict={dict} />;
}
