import type { Metadata } from "next";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentYear } from "@/lib/get-current-year";
import { localizedAlternates } from "@/lib/seo/alternates";
import ToolsClient from "./tools-client";

// Enable ISR with 1-hour revalidation
// Tools page updates when new articles affect rankings
export const revalidate = 3600; // 1 hour

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const currentYear = getCurrentYear();

  // #156: one builder for canonical and og:url, so they cannot disagree.
  const alternates = localizedAlternates(lang, "/tools");
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
      url: alternates.canonical, // #156: always the canonical
      siteName: "AI Power Rankings",
    },
    // #156: each locale is its own canonical; hreflang lists every locale plus x-default.
    // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
    alternates,
  };
}

export default async function ToolsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <ToolsClient lang={lang as Locale} dict={dict} />
      </Suspense>
    </main>
  );
}
