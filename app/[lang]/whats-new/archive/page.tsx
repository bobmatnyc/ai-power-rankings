import type { Metadata } from "next";
import { Suspense } from "react";
import WhatsNewArchive from "@/components/whats-new/whats-new-archive";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";
import { MonthlySummariesRepository } from "@/lib/db/repositories/monthly-summaries.repository";

// Force dynamic rendering to ensure fresh data
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

interface ArchiveSummary {
  period: string;
  periodFormatted: string;
  excerpt: string;
  generatedAt: string;
}

async function fetchAllSummaries(): Promise<ArchiveSummary[]> {
  try {
    const summariesRepo = new MonthlySummariesRepository();
    const summaries = await summariesRepo.getAll();

    return summaries.map((summary) => ({
      period: summary.period,
      periodFormatted: summariesRepo.formatPeriod(summary.period),
      excerpt: summariesRepo.extractExcerpt(summary.content, 200),
      generatedAt: summary.generatedAt instanceof Date
        ? summary.generatedAt.toISOString()
        : String(summary.generatedAt),
    }));
  } catch (error) {
    console.error("Error fetching summaries:", error);
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/whats-new/archive`;
  });

  const title = "What's New Archive - AI Coding Tools Monthly Updates";
  const description =
    "Browse all monthly summaries of AI coding tool updates, features, and industry news. Historical archive of AI development tool announcements and trends.";

  return {
    title,
    description,
    keywords: [
      "AI coding tools",
      "what's new archive",
      "monthly updates",
      "AI development history",
      "tool updates archive",
      "AI news archive",
    ],
    openGraph: {
      title,
      description,
      type: "website",
      url: `${baseUrl}/${lang}/whats-new/archive`,
      siteName: "AI Power Rankings",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/en/whats-new/archive`,
      languages,
    },
  };
}

export default async function WhatsNewArchivePage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  // Fetch all summaries
  const summaries = await fetchAllSummaries();

  return (
    <main className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <WhatsNewArchive summaries={summaries} dict={dict} lang={lang as Locale} />
      </Suspense>
    </main>
  );
}
