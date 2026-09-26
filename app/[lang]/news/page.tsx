import type { Metadata } from "next";
import { Suspense } from "react";
import NewsContent from "@/components/news/news-content";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentYear } from "@/lib/get-current-year";
import { ENGLISH_ONLY_OG_LOCALE, englishOnlyAlternates } from "@/lib/seo/alternates";

// Force dynamic rendering to prevent build timeout
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const currentYear = getCurrentYear();

  // #156: English canonical, no hreflang: headlines, summaries and the State of
  // AI editorial come from English-only APIs; only the chrome is translated.
  const alternates = englishOnlyAlternates(lang, "/news");
  return {
    title: `AI Coding Tools News ${currentYear} - Latest Updates & Announcements`,
    description:
      "Stay updated with the latest AI coding tools news, updates, and industry announcements. Track developments from top AI companies and new feature releases.",
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
      url: alternates.canonical, // #156: always the canonical
      locale: ENGLISH_ONLY_OG_LOCALE, // #156: the body is English
      siteName: "AI Power Rankings",
    },
    // #156: every locale canonicalises to /en, with no hreflang.
    // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
    alternates,
  };
}

export default async function NewsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);
  return (
    <main className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <NewsContent lang={lang as Locale} dict={dict} />
      </Suspense>
    </main>
  );
}
