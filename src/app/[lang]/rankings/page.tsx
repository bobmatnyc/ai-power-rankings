import { Suspense } from "react";
import { Metadata } from "next";
import RankingsGrid from "@/components/ranking/rankings-grid";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { loggers } from "@/lib/logger";
import Script from "next/script";
import {
  generateRankingFAQSchema,
  generateBreadcrumbSchema,
  createJsonLdScript,
} from "@/lib/schema";
import { generateRankingOGImageUrl } from "@/lib/og-utils";
import { QuickAnswerBox, FAQSection } from "@/components/seo";
import { generalFAQs } from "@/data/seo-content";
import { getUrl } from "@/lib/get-url";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();

  // Try to get current ranking period and top tools
  let topTools: string[] = [];
  let totalTools = 0;
  let period = "";

  try {
    // Skip API calls during build phase
    if (process.env["NEXT_PHASE"] !== "phase-production-build") {
      const isDev = process.env["NODE_ENV"] === "development";
      const rankingsUrl = `${baseUrl}/api/rankings`;

      const response = await fetch(rankingsUrl, {
        next: { revalidate: isDev ? 0 : 300 },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.rankings?.length > 0) {
          topTools = data.rankings.slice(0, 3).map((tool: any) => tool.name);
          totalTools = data.rankings.length;
          // Extract period from first ranking if available
          const firstRanking = data.rankings[0];
          if (firstRanking?.updated_at) {
            const date = new Date(firstRanking.updated_at);
            period = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
          }
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
      url: `${baseUrl}/${lang}/rankings`,
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
    alternates: {
      canonical: `${baseUrl}/${lang}/rankings`,
    },
  };
}

// Use static generation with revalidation
export const revalidate = 3600; // Revalidate every hour

export default async function RankingsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Fetch rankings on the server (same as home page)
  let initialRankings = [];
  try {
    // Skip API calls during build phase
    if (process.env["NEXT_PHASE"] === "phase-production-build") {
      loggers.ranking.info("Skipping rankings fetch during build phase");
    } else {
      const isDev = process.env["NODE_ENV"] === "development";
      const baseUrl = getUrl();
      const timestamp = Date.now();
      const url = `${baseUrl}/api/rankings${isDev ? `?_t=${timestamp}` : ""}`;

      const response = await fetch(url, {
        next: { revalidate: isDev ? 0 : 300 },
        cache: isDev ? "no-store" : "default",
      });

      const data = await response.json();
      initialRankings = data.rankings || [];
    }
  } catch (error) {
    loggers.ranking.error("Failed to fetch rankings on server", { error });
  }

  // Generate structured data
  const structuredDataBaseUrl = getUrl();
  const faqSchema = generateRankingFAQSchema();
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { name: "Home", url: "/" },
      { name: "Rankings", url: "/rankings" },
    ],
    structuredDataBaseUrl
  );

  return (
    <div className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: createJsonLdScript(faqSchema),
        }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: createJsonLdScript(breadcrumbSchema),
        }}
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <RankingsGrid lang={lang} dict={dict} initialRankings={initialRankings} />
      </Suspense>

      {/* SEO-Optimized Content Sections */}
      <div className="mt-12 space-y-8">
        {/* Quick Answer about rankings */}
        <QuickAnswerBox
          question="How are AI tool rankings determined?"
          answer="Our AI tool rankings use <strong>Algorithm v6.0</strong> which evaluates tools across 8 key factors: Agentic Capability, Innovation, Technical Performance, Developer Adoption, Market Traction, Business Sentiment, Development Velocity, and Platform Resilience. Rankings are updated weekly with fresh data from multiple sources."
          type="definition"
        />

        {/* FAQ Section */}
        <FAQSection
          title="AI Tool Rankings FAQ"
          faqs={generalFAQs}
          defaultOpen={["what-are-ai-tool-rankings", "how-are-rankings-calculated"]}
        />
      </div>
    </div>
  );
}
