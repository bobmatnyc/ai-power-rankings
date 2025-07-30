import { Suspense } from "react";
import type { Metadata } from "next";
import NewsContent from "@/components/news/news-content";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";
import { getCurrentYear } from "@/lib/get-current-year";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/news`;
  });

  return {
    title: `AI Coding Tools News ${currentYear} - Latest Updates & Announcements`,
    description: "Stay updated with the latest AI coding tools news, updates, and industry announcements. Track developments from top AI companies and new feature releases.",
    keywords: [
      "AI coding tools news",
      "AI development updates",
      "AI tool announcements",
      "coding AI news",
      `AI news ${currentYear}`,
      "developer AI updates",
      "AI tool releases",
      "coding assistant news",
    ],
    openGraph: {
      title: `AI Coding Tools News ${currentYear}`,
      description: "Stay updated with the latest AI coding tools news and announcements.",
      type: "website",
      url: `${baseUrl}/${lang}/news`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/news`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function NewsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  return (
    <div className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <NewsContent lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}
