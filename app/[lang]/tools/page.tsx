import type { Metadata } from "next";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentYear } from "@/lib/get-current-year";
import { getUrl } from "@/lib/get-url";
import ToolsClient from "./tools-client";

// Force dynamic rendering to prevent build timeout
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/tools`;
  });

  return {
    title: `All AI Coding Tools ${currentYear} - Complete Directory & Comparison`,
    description:
      "Browse and compare 50+ AI coding tools including IDE assistants, code editors, autonomous agents, and more. Filter by category and explore detailed features.",
    keywords: [
      "AI coding tools directory",
      "all AI development tools",
      `AI tools list ${currentYear}`,
      "coding assistant comparison",
      "AI tool categories",
      "developer AI directory",
      "AI programming tools",
      "complete AI tools list",
    ],
    openGraph: {
      title: `All AI Coding Tools ${currentYear}`,
      description: "Browse and compare 50+ AI coding tools across all categories.",
      type: "website",
      url: `${baseUrl}/${lang}/tools`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/tools`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function ToolsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <ToolsClient lang={lang as Locale} dict={dict} />
      </Suspense>
    </div>
  );
}
