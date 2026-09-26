import type { Metadata } from "next";
import { Suspense } from "react";
import NewsContent from "@/components/news/news-content";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentYear } from "@/lib/get-current-year";
import { localizedAlternates } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/site-origin";

// Force dynamic rendering to prevent build timeout
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  // #153: the production origin, never the per-deployment VERCEL_URL host.
  const baseUrl = siteOrigin();
  const currentYear = getCurrentYear();

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
      url: `${baseUrl}/${lang}/news`,
      siteName: "AI Power Rankings",
    },
    // #156: each locale is its own canonical; hreflang lists every locale plus x-default.
    // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
    alternates: localizedAlternates(lang, "/news"),
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
