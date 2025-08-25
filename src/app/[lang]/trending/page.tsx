/**
 * Historical Trending Page - AI Tool Rankings Over Time
 *
 * WHY: This page provides users with a dedicated view of how AI tools have
 * performed historically. It shows long-term trends that aren't visible in
 * the current rankings, helping users make informed decisions about tools.
 *
 * DESIGN DECISION: We use a dedicated page instead of embedding in rankings because:
 * - Historical trending deserves focused attention without distractions
 * - Large chart needs full screen space for optimal viewing
 * - Time range controls need prominent placement
 * - Mobile users benefit from dedicated vertical space
 * - SEO benefits from having a dedicated trending URL
 *
 * PERFORMANCE CONSIDERATIONS:
 * - Server-side rendering for SEO and initial load speed
 * - Client-side hydration for interactivity
 * - Time range filtering reduces data payload
 * - Chart components are lazy-loaded
 * - API responses are cached with appropriate headers
 *
 * @fileoverview Page displaying historical AI tool ranking trends with interactive chart
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import { TrendingPageContent } from "./trending-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{
    lang: Locale;
  }>;
  searchParams: Promise<{
    months?: string;
  }>;
}

/**
 * Generates metadata for the trending page with proper internationalization.
 */
export async function generateMetadata({ params }: Pick<PageProps, "params">): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  return {
    title: `${dict.trending.title} | AI Power Rankings`,
    description:
      dict.trending.description ||
      "Explore how AI tools have trended over time. See which tools are rising, falling, or maintaining their positions in our comprehensive historical analysis.",
    openGraph: {
      title: `${dict.trending.title} | AI Power Rankings`,
      description:
        dict.trending.description ||
        "Historical trends and analysis of AI tool rankings over time.",
      type: "website",
      locale: lang,
    },
    twitter: {
      card: "summary_large_image",
      title: `${dict.trending.title} | AI Power Rankings`,
      description:
        dict.trending.description ||
        "Historical trends and analysis of AI tool rankings over time.",
    },
    alternates: {
      canonical: `/${lang}/trending`,
      languages: {
        en: "/en/trending",
        es: "/es/trending",
        fr: "/fr/trending",
        ko: "/ko/trending",
        hr: "/hr/trending",
        it: "/it/trending",
      },
    },
  };
}

/**
 * Loading component for the trending page.
 * Provides a skeleton while data loads and chart components initialize.
 */
function TrendingPageSkeleton() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="h-8 bg-muted rounded-lg w-64 animate-pulse" />
          <div className="h-4 bg-muted rounded w-96 animate-pulse" />
        </div>

        {/* Controls skeleton */}
        <div className="flex gap-4 items-center">
          <div className="h-10 bg-muted rounded w-32 animate-pulse" />
          <div className="h-10 bg-muted rounded w-24 animate-pulse" />
          <div className="h-10 bg-muted rounded w-24 animate-pulse" />
          <div className="h-10 bg-muted rounded w-24 animate-pulse" />
        </div>

        {/* Chart skeleton */}
        <div className="bg-card border rounded-lg p-6">
          <div className="space-y-4">
            <div className="h-6 bg-muted rounded w-48 animate-pulse" />
            <div className="h-4 bg-muted rounded w-72 animate-pulse" />
            <div className="h-[400px] bg-muted rounded-lg animate-pulse flex items-center justify-center">
              <span className="text-muted-foreground">Loading chart...</span>
            </div>
          </div>
        </div>

        {/* Statistics skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border rounded-lg p-6">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24 animate-pulse" />
              <div className="h-8 bg-muted rounded w-16 animate-pulse" />
              <div className="h-3 bg-muted rounded w-32 animate-pulse" />
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24 animate-pulse" />
              <div className="h-8 bg-muted rounded w-16 animate-pulse" />
              <div className="h-3 bg-muted rounded w-32 animate-pulse" />
            </div>
          </div>
          <div className="bg-card border rounded-lg p-6">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24 animate-pulse" />
              <div className="h-8 bg-muted rounded w-16 animate-pulse" />
              <div className="h-3 bg-muted rounded w-32 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main trending page component.
 *
 * This is a Server Component that handles:
 * - Parameter parsing and validation
 * - Initial data fetching (if needed)
 * - Internationalization setup
 * - SEO metadata generation
 *
 * The actual interactive content is delegated to TrendingPageContent
 * which is a Client Component for better separation of concerns.
 */
export default async function TrendingPage({ params, searchParams }: PageProps) {
  const { lang } = await params;
  const { months } = await searchParams;

  const dict = await getDictionary(lang);

  // Validate and parse the months parameter
  let timeRange: number | "all" = "all";
  if (months && months !== "all") {
    const parsed = parseInt(months, 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 24) {
      timeRange = parsed;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="space-y-8">
          {/* Page Header */}
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight">
              {dict.trending?.title || "Historical AI Tool Rankings"}
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl">
              {dict.trending?.description ||
                "Explore how AI tools have performed over time. Track rising stars, established leaders, and market shifts in the rapidly evolving AI landscape."}
            </p>
          </div>

          {/* Interactive Content */}
          <Suspense fallback={<TrendingPageSkeleton />}>
            <TrendingPageContent lang={lang} initialTimeRange={timeRange} dictionary={dict} />
          </Suspense>

          {/* Additional Information */}
          <div className="mt-12 space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-3">
                {dict.trending?.aboutTitle || "About Historical Trending"}
              </h2>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {dict.trending?.aboutDescription ||
                    "This chart shows how AI tools have moved in and out of the top 10 rankings over time. Tools that appear higher on the chart (closer to #1) are performing better."}
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Rankings are updated monthly based on our comprehensive analysis</li>
                  <li>Tools may enter or leave the top 10 as the market evolves</li>
                  <li>Click legend items to focus on specific tools</li>
                  <li>Use time range filters to analyze shorter periods</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Static generation configuration.
 * Since this is a dynamic page with time range parameters,
 * we generate the most common variants statically.
 */
export function generateStaticParams() {
  return [
    { lang: "en" },
    { lang: "es" },
    { lang: "fr" },
    { lang: "ko" },
    { lang: "hr" },
    { lang: "it" },
  ];
}
