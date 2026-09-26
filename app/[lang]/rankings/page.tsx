import type { Metadata } from "next";
import { Suspense } from "react";
import RankingsGrid from "@/components/ranking/rankings-grid";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { loggers } from "@/lib/logger";

interface RankingTool {
  name: string;
  updated_at?: string;
}

import Script from "next/script";
import { FAQSection, QuickAnswerBox } from "@/components/seo";
import { generalFAQs } from "@/data/seo-content";
import { getUrl } from "@/lib/get-url";
import { generateRankingOGImageUrl } from "@/lib/og-utils";
import { canonicalLocale, localizedAlternates } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/site-origin";
import {
  createJsonLdScript,
  generateBreadcrumbSchema,
  generateRankingFAQSchema,
} from "@/lib/schema";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  // #153: the rankings fetch keeps getUrl(), which must reach this
  // deployment's own API on previews; SEO URLs come from localizedAlternates().

  // Try to get current ranking period and top tools
  let topTools: string[] = [];
  let totalTools = 0;
  let period = "";

  try {
    const isDev = process.env["NODE_ENV"] === "development";
    const rankingsUrl = `${getUrl()}/api/rankings`;

    const response = await fetch(rankingsUrl, {
      next: { revalidate: isDev ? 0 : 300 },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.rankings?.length > 0) {
        topTools = data.rankings.slice(0, 3).map((tool: RankingTool) => tool.name);
        totalTools = data.rankings.length;
        // Extract period from first ranking if available
        const firstRanking = data.rankings[0];
        if (firstRanking?.updated_at) {
          const date = new Date(firstRanking.updated_at);
          period = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
        }
      }
    }
  } catch (error) {
    console.warn("Could not fetch rankings for metadata:", error);
  }

  // Generate OG image
  const ogImageUrl = generateRankingOGImageUrl({
    title: "AI Tool Rankings",
    period: period || undefined,
    topTools: topTools.length > 0 ? topTools : undefined,
    totalTools: totalTools > 0 ? totalTools : undefined,
  });

  const title = period ? `AI Tool Rankings - ${period}` : "AI Tool Rankings - Latest Rankings";

  const description =
    totalTools > 0
      ? `Latest rankings of ${totalTools} AI tools. See how ${topTools.slice(0, 2).join(", ")} and other leading AI assistants compare.`
      : "Comprehensive rankings and analysis of leading AI coding tools. Compare performance, features, and adoption metrics.";

  // #156: one builder for canonical and og:url, so they cannot disagree.
  const alternates = localizedAlternates(lang, "/rankings");
  return {
    title,
    description,
    keywords: [
      "AI tool rankings",
      "AI assistant comparison",
      "developer tools",
      "coding AI",
      "AI benchmarks",
      ...topTools,
    ].join(", "),
    openGraph: {
      title,
      description,
      type: "website",
      locale: canonicalLocale(lang), // #156: never an unknown segment
      url: alternates.canonical, // #156: always the canonical
      siteName: "AI Power Rankings",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "AI Tool Rankings",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@aipowerrankings",
      creator: "@aipowerrankings",
      title,
      description,
      images: [ogImageUrl],
    },
    // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
    // #156: each locale is its own canonical; hreflang lists every locale plus x-default.
    alternates,
  };
}

// Use dynamic rendering with optimized queries
export const dynamic = "force-dynamic";
// Consider ISR in the future: export const revalidate = 300;

export default async function RankingsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang as Locale);

  // Fetch rankings on the server (same as home page)
  let initialRankings = [];
  try {
    const isDev = process.env["NODE_ENV"] === "development";
    const baseUrl = getUrl();
    const timestamp = Date.now();
    const url = `${baseUrl}/api/rankings${isDev ? `?_t=${timestamp}` : ""}`;

    const response = await fetch(url, {
      next: { revalidate: isDev ? 0 : 300 },
      cache: isDev ? "no-store" : "default",
    });

    if (response.ok) {
      const data = await response.json();
      initialRankings = data.rankings || [];
    }
  } catch (error) {
    loggers.ranking.error("Failed to fetch rankings on server", { error });
  }

  // Generate structured data
  // #153: JSON-LD names the production origin, never the VERCEL_URL host.
  const structuredDataBaseUrl = siteOrigin();
  const faqSchema = generateRankingFAQSchema();
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { name: "Home", url: "/" },
      { name: "Rankings", url: "/rankings" },
    ],
    structuredDataBaseUrl
  );

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: createJsonLdScript(faqSchema),
        }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: createJsonLdScript(breadcrumbSchema),
        }}
      />

      <main className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">{dict.common.loading}</p>
            </div>
          }
        >
          <RankingsGrid lang={lang as Locale} dict={dict} initialRankings={initialRankings} />
        </Suspense>

        {/* SEO-Optimized Content Sections */}
        <aside className="mt-12 space-y-8" aria-label="Additional information">
          {/* Quick Answer about rankings */}
          <QuickAnswerBox
            question="How are AI tool rankings determined?"
            answer="Our AI tool rankings use <strong>Algorithm v7.6</strong> which evaluates tools across 8 key factors: Agentic Capability, Innovation, Technical Performance, Developer Adoption, Market Traction, Business Sentiment, Development Velocity, and Platform Resilience. Rankings are updated monthly with fresh data from multiple sources."
            type="definition"
          />

          {/* FAQ Section */}
          <FAQSection
            title="AI Tool Rankings FAQ"
            faqs={generalFAQs}
            defaultOpen={["what-are-ai-tool-rankings", "how-are-rankings-calculated"]}
          />
        </aside>
      </main>
    </>
  );
}
