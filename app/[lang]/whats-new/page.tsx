import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import WhatsNewContent from "@/components/whats-new/whats-new-content";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";

// Force dynamic rendering to ensure fresh data
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

interface MonthlySummary {
  id: string;
  period: string;
  periodFormatted: string;
  content: string;
  metadata: any;
  generatedAt: string;
}

interface NavigationInfo {
  previous: { period: string; title: string } | null;
  next: { period: string; title: string } | null;
}

async function fetchLatestSummary(): Promise<{
  summary: MonthlySummary;
  navigation: NavigationInfo;
}> {
  try {
    const baseUrl = getUrl();
    const response = await fetch(`${baseUrl}/api/whats-new/public`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      if (response.status === 404) {
        notFound();
      }
      throw new Error(`Failed to fetch summary: ${response.status}`);
    }

    const data = await response.json();
    return { summary: data.summary, navigation: data.navigation };
  } catch (error) {
    console.error("Error fetching latest summary:", error);
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();

  try {
    const { summary } = await fetchLatestSummary();

    // Build hreflang alternates for all supported languages
    const languages: Record<string, string> = {};
    locales.forEach((locale) => {
      languages[locale] = `${baseUrl}/${locale}/whats-new`;
    });

    const title = `What's New in AI Coding Tools - ${summary.periodFormatted}`;
    const description = `Monthly summary of AI coding tool updates, features, and industry news for ${summary.periodFormatted}. Stay up-to-date with the latest developments in AI-powered development tools.`;

    return {
      title,
      description,
      keywords: [
        "AI coding tools",
        "what's new",
        "monthly updates",
        "AI development",
        "tool updates",
        "AI news",
        summary.periodFormatted,
      ],
      openGraph: {
        title,
        description,
        type: "article",
        url: `${baseUrl}/${lang}/whats-new`,
        siteName: "AI Power Rankings",
        publishedTime: summary.generatedAt,
        modifiedTime: summary.generatedAt,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
      alternates: {
        canonical: `${baseUrl}/en/whats-new`,
        languages,
      },
    };
  } catch {
    // Fallback metadata if fetch fails
    return {
      title: "What's New in AI Coding Tools",
      description: "Monthly summaries of AI coding tool updates and industry news.",
    };
  }
}

export default async function WhatsNewPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  // Fetch the latest summary
  const { summary, navigation } = await fetchLatestSummary();

  return (
    <main className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <article>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">{dict.common.loading}</p>
            </div>
          }
        >
          <WhatsNewContent
            summary={summary}
            navigation={navigation}
            dict={dict}
            lang={lang as Locale}
            isLatest={true}
          />
        </Suspense>
      </article>
    </main>
  );
}
