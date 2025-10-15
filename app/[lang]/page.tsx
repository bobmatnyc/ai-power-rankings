import { ArrowRight, ArrowUp, Star } from "lucide-react";
import type { Metadata } from "next";
import NextDynamic from "next/dynamic";
import Link from "next/link";
import { SignupUpdatesButton } from "@/components/auth/signup-updates-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LazySection } from "@/components/ui/lazy-section";
import { ResponsiveCrownIcon } from "@/components/ui/optimized-image";
import { RankingsTableSkeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";
import { getAllKeywords } from "@/lib/metadata/static-keywords";

interface ToolData {
  id: string;
  name: string;
  status: string;
  slug?: string;
  description?: string;
  category?: string;
}

interface RankingData {
  rank: number;
  previousRank?: number;
  rankChange?: number;
  changeReason?: string;
  tool: {
    id: string;
    slug?: string;
    name: string;
    category: string;
    status: string;
    website_url?: string;
    description?: string;
  };
  scores: {
    overall: number;
    agentic_capability: number;
    innovation: number;
  };
  metrics: {
    users?: number;
    monthly_arr?: number;
    swe_bench_score?: number;
  };
}

interface PageProps {
  params: Promise<{ lang: string }>;
}

// Dynamic import for T-031 performance optimization
// Phase 2 FCP: Dynamic imports are prefetched via layout.tsx for faster loading
// Note: ssr: false not supported in Server Components - these components handle client-only logic internally
const ClientRankings = NextDynamic(() => import("./client-rankings-optimized"), {
  loading: () => <RankingsTableSkeleton />,
});

// Dynamic import for T-033 What's New modal
// Phase 2 FCP: Prefetched in layout.tsx for faster loading
// Note: Already optimized with dynamic import, ssr:false not applicable in Server Components
const WhatsNewModalClient = NextDynamic(() => import("@/components/ui/whats-new-modal-client"), {
  loading: () => null, // No loading state needed for modal
});

// Enable ISR with 5-minute revalidation for optimal performance
// Homepage provides static fallback data, so we can use ISR for edge caching
export const revalidate = 300; // Revalidate every 5 minutes

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    console.log("[Metadata] Starting metadata generation");
    const resolvedParams = await params;
    const lang = (resolvedParams?.lang || "en") as Locale;
    console.log("[Metadata] Language resolved:", lang);

    const dict = await getDictionary(lang as Locale);
    console.log("[Metadata] Dictionary loaded successfully");

    const baseUrl = getUrl();
    console.log("[Metadata] Base URL from getUrl:", baseUrl);

    // Use pre-generated static keywords (no API fetch needed)
    // This eliminates 300-3000ms metadata generation delay
    const baseKeywords = dict.seo?.keywords || "";
    const allKeywords = getAllKeywords(baseKeywords);

    console.log("[Metadata] Using static keywords (no API fetch required)");

    // Handle cases where baseUrl might be empty
    const metadataUrl = baseUrl || "";

    const metadata = {
      title: dict.seo?.title || "AI Power Rankings",
      description:
        dict.seo?.description || "Comprehensive rankings of AI coding tools and assistants",
      keywords: allKeywords,
      openGraph: {
        title: dict.seo?.title || "AI Power Rankings",
        description:
          dict.seo?.description || "Comprehensive rankings of AI coding tools and assistants",
        type: "website",
        locale: lang,
        ...(metadataUrl && { url: `${metadataUrl}/${lang}` }),
        siteName: dict.common?.appName || "AI Power Rankings",
        ...(metadataUrl && {
          images: [
            {
              url: `${metadataUrl}/og-image.png`,
              width: 1200,
              height: 630,
              alt: dict.common?.appName || "AI Power Rankings",
            },
          ],
        }),
      },
      twitter: {
        card: "summary_large_image",
        title: dict.seo?.title || "AI Power Rankings",
        description:
          dict.seo?.description || "Comprehensive rankings of AI coding tools and assistants",
        ...(metadataUrl && { images: [`${metadataUrl}/og-image.png`] }),
      },
      alternates: metadataUrl
        ? {
            canonical: `${metadataUrl}/${lang}`,
            languages: {
              en: `${metadataUrl}/en`,
              de: `${metadataUrl}/de`,
              fr: `${metadataUrl}/fr`,
              it: `${metadataUrl}/it`,
              ja: `${metadataUrl}/ja`,
              ko: `${metadataUrl}/ko`,
              uk: `${metadataUrl}/uk`,
              hr: `${metadataUrl}/hr`,
              zh: `${metadataUrl}/zh`,
              es: `${metadataUrl}/es`,
            },
          }
        : undefined,
    };

    console.log("[Metadata] Successfully generated metadata (static keywords)");
    return metadata;
  } catch (error) {
    console.error("[Metadata] Critical error generating metadata:", error);
    console.error("[Metadata] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : "No stack",
    });

    // Return minimal fallback metadata
    return {
      title: "AI Power Rankings",
      description: "Comprehensive rankings of AI coding tools and assistants",
      keywords: "AI tools, coding assistant, artificial intelligence, rankings",
    };
  }
}

export default async function Home({ params }: PageProps): Promise<React.JSX.Element> {
  try {
    console.log("[Page] Home: Starting page render");
    console.log("[Page] Home: Environment:", {
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      HAS_BASE_URL: !!process.env["NEXT_PUBLIC_BASE_URL"],
      HAS_VERCEL_URL: !!process.env["VERCEL_URL"],
    });

    // Resolve params with better error handling
    let resolvedParams: { lang: Locale };
    try {
      const rawParams = await params;
      resolvedParams = { lang: rawParams.lang as Locale };
      console.log("[Page] Home: Resolved params:", resolvedParams);
    } catch (paramsError) {
      console.error("[Page] Home: Error resolving params:", paramsError);
      resolvedParams = { lang: "en" as Locale };
    }

    const lang = (resolvedParams?.lang || "en") as Locale;
    console.log("[Page] Home: Language:", lang);

    // Load dictionary with enhanced error handling
    let dict: Awaited<ReturnType<typeof getDictionary>>;
    try {
      dict = await getDictionary(lang as Locale);
      console.log("[Page] Home: Dictionary loaded:", !!dict);
    } catch (dictError) {
      console.error("[Page] Home: Error loading dictionary:", dictError);
      // Fall back to English dictionary as emergency fallback
      try {
        dict = await getDictionary("en");
      } catch (fallbackError) {
        console.error("[Page] Home: Even English fallback failed:", fallbackError);
        // If even English fails, throw to show error boundary
        throw fallbackError;
      }
    }

    const baseUrl = getUrl();
    console.log("[Page] Home: Base URL from getUrl:", baseUrl);

    // Provide server-side fallback data to prevent loading state
    // Hard-coded fallback for immediate display while debugging
    const serverRankings: RankingData[] = [
      {
        rank: 1,
        tool: {
          id: "4",
          slug: "claude-code",
          name: "Claude Code",
          category: "autonomous-agent",
          status: "active",
          website_url: "https://anthropic.com/claude-code",
          description:
            "Terminal-based coding agent with deep codebase understanding and multi-file editing",
        },
        scores: {
          overall: 92.5,
          agentic_capability: 5,
          innovation: 9.5,
        },
        metrics: {
          swe_bench_score: 80.2,
        },
      },
      {
        rank: 2,
        tool: {
          id: "2",
          slug: "github-copilot",
          name: "GitHub Copilot",
          category: "ide-assistant",
          status: "active",
          website_url: "https://github.com/features/copilot",
          description:
            "AI pair programmer with autocomplete, chat, and autonomous coding agent capabilities",
        },
        scores: {
          overall: 91.0,
          agentic_capability: 5,
          innovation: 9.5,
        },
        metrics: {
          swe_bench_score: 56,
        },
      },
      {
        rank: 3,
        tool: {
          id: "1",
          slug: "cursor",
          name: "Cursor",
          category: "code-editor",
          status: "active",
          website_url: "https://cursor.com",
          description: "AI-powered code editor with $500M ARR and 360K+ paying developers",
        },
        scores: {
          overall: 89.5,
          agentic_capability: 5,
          innovation: 8.5,
        },
        metrics: {},
      },
    ];

    // Create structured data for SEO - handle case where baseUrl might be empty
    let structuredData = null;
    try {
      structuredData = baseUrl
        ? {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: dict.common?.appName || "AI Power Rankings",
            description:
              dict.seo?.description ||
              dict.home?.methodology?.algorithmDescription ||
              "AI tool rankings",
            url: `${baseUrl}/${lang}`,
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: `${baseUrl}/${lang}/rankings?search={search_term_string}`,
              },
              "query-input": "required name=search_term_string",
            },
          }
        : null;
    } catch (error) {
      console.error("[Page] Home: Error creating structured data:", error);
      structuredData = null;
    }

    console.log("[Page] Home: Preparing to render components");

    return (
      <>
        {structuredData && (
          <script
            type="application/ld+json"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
          />
        )}
        {/* T-033 What's New Modal */}
        <WhatsNewModalClient />
        <main className="min-h-screen">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5" />

          <div className="relative px-3 md:px-6 py-12 mx-auto max-w-7xl">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                <Star className="h-3 w-3 mr-1" />
                {dict.home.hero.badge}
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
                <ResponsiveCrownIcon priority={true} />
                <span>
                  {dict.common.appName.split(" ")[0]}{" "}
                  <span className="text-gradient">
                    {dict.common.appName.split(" ").slice(1).join(" ")}
                  </span>
                </span>
              </h1>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
                {dict.home.hero.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button
                  size="lg"
                  className="gradient-primary text-white hover:opacity-90 transition-opacity px-8 py-3 w-full sm:w-auto min-w-[200px]"
                  asChild
                >
                  <Link href={`/${lang}/rankings`}>
                    {dict.home.hero.exploreButton}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 w-full sm:w-auto min-w-[200px]"
                  asChild
                >
                  <Link href={`/${lang}/rankings?sort=trending`}>
                    {dict.home.hero.trendingButton}
                    <ArrowUp className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Secondary CTA for newsletter signup */}
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-3">
                  Get weekly updates on the latest AI tool rankings
                </p>
                <SignupUpdatesButton className="text-primary hover:text-primary/80" />
              </div>
            </div>

            {/* Top 3 Tools and all dynamic content with server fallback */}
            <ClientRankings
              loadingText={dict.common.loading}
              lang={lang as Locale}
              initialRankings={serverRankings}
            />
          </div>
        </section>

        {/* Categories Overview - Lazy loaded for better initial performance */}
        <LazySection fallbackHeight="600px">
          <section className="px-3 md:px-6 py-12 bg-muted/30">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
                {dict.home.categories.title}
              </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <Link href={`/${lang}/rankings?category=ide-assistant`} className="block h-full">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-primary/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {dict.categories.ideAssistant}
                      <Badge className="bg-primary/10 text-primary">7</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {dict.home.categories.ideDescription}
                    </p>
                    <p className="text-sm text-primary mt-3 group-hover:underline">
                      {dict.common.explore} →
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link href={`/${lang}/rankings?category=code-editor`} className="block h-full">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-secondary/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {dict.categories.codeEditor}
                      <Badge className="bg-secondary/10 text-secondary">3</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {dict.home.categories.editorDescription}
                    </p>
                    <p className="text-sm text-secondary mt-3 group-hover:underline">
                      {dict.common.explore} →
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link href={`/${lang}/rankings?category=app-builder`} className="block h-full">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-accent/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {dict.categories.appBuilder}
                      <Badge className="bg-accent/10 text-accent">4</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {dict.home.categories.builderDescription}
                    </p>
                    <p className="text-sm text-accent mt-3 group-hover:underline">
                      {dict.common.explore} →
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link href={`/${lang}/rankings?category=autonomous-agent`} className="block h-full">
                <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-border/50 hover:border-destructive/20 h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      {dict.categories.autonomousAgent}
                      <Badge className="bg-destructive/10 text-destructive">6</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {dict.home.categories.agentDescription}
                    </p>
                    <p className="text-sm text-destructive mt-3 group-hover:underline">
                      {dict.common.explore} →
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        </section>
        </LazySection>

        {/* Trust Signals for T-042 SEO - Lazy loaded */}
        <LazySection fallbackHeight="500px">
          <section className="px-3 md:px-6 py-12 bg-background">
            <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Trusted by Developers Worldwide
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Our data-driven methodology and transparent ranking process has earned the trust of
                the developer community
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
              <Card className="text-center p-4 md:p-6">
                <CardContent className="pt-0">
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-2">50+</div>
                  <div className="text-sm text-muted-foreground">AI Tools Analyzed</div>
                  <div className="text-xs text-muted-foreground mt-1">Updated Weekly</div>
                </CardContent>
              </Card>

              <Card className="text-center p-4 md:p-6">
                <CardContent className="pt-0">
                  <div className="text-2xl md:text-3xl font-bold text-secondary mb-2">8</div>
                  <div className="text-sm text-muted-foreground">Ranking Factors</div>
                  <div className="text-xs text-muted-foreground mt-1">Algorithm v7.0</div>
                </CardContent>
              </Card>

              <Card className="text-center p-4 md:p-6">
                <CardContent className="pt-0">
                  <div className="text-2xl md:text-3xl font-bold text-accent mb-2">2024</div>
                  <div className="text-sm text-muted-foreground">Est. Founded</div>
                  <div className="text-xs text-muted-foreground mt-1">Independent Analysis</div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>100% Independent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Data-Driven</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span>Transparent Methodology</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        </LazySection>

        {/* Methodology Brief - Lazy loaded */}
        <LazySection fallbackHeight="700px">
          <section id="methodology" className="container mx-auto px-2 md:px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-3xl font-bold">{dict.home.methodology.title}</h2>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-primary">{dict.home.methodology.algorithmTitle}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-muted-foreground">
                    {dict.home.methodology.algorithmDescription}
                  </p>
                  <div className="mb-4">
                    <Link
                      href={`/${lang}/methodology`}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      {dict.common.learnMore} →
                    </Link>
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li>
                      • <strong>{dict.home.methodology.factors.agentic.name}</strong> -{" "}
                      {dict.home.methodology.factors.agentic.description}
                    </li>
                    <li>
                      • <strong>{dict.home.methodology.factors.innovation.name}</strong> -{" "}
                      {dict.home.methodology.factors.innovation.description}
                    </li>
                    <li>
                      • <strong>{dict.home.methodology.factors.performance.name}</strong> -{" "}
                      {dict.home.methodology.factors.performance.description}
                    </li>
                    <li>
                      • <strong>{dict.home.methodology.factors.traction.name}</strong> -{" "}
                      {dict.home.methodology.factors.traction.description}
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-secondary">{dict.home.methodology.modifiersTitle}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-muted-foreground">
                    {dict.home.methodology.modifiersDescription}
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li>
                      • <strong>{dict.home.methodology.modifiers.decay.name}</strong> -{" "}
                      {dict.home.methodology.modifiers.decay.description}
                    </li>
                    <li>
                      • <strong>{dict.home.methodology.modifiers.risk.name}</strong> -{" "}
                      {dict.home.methodology.modifiers.risk.description}
                    </li>
                    <li>
                      • <strong>{dict.home.methodology.modifiers.revenue.name}</strong> -{" "}
                      {dict.home.methodology.modifiers.revenue.description}
                    </li>
                    <li>
                      • <strong>{dict.home.methodology.modifiers.validation.name}</strong> -{" "}
                      {dict.home.methodology.modifiers.validation.description}
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 text-center">
              <Button variant="outline" asChild>
                <Link href={`/${lang}/methodology`}>{dict.home.methodology.readMoreButton}</Link>
              </Button>
            </div>
          </div>
        </section>
        </LazySection>
        </main>
      </>
    );
  } catch (error) {
    console.error("[Page] Home: Critical error rendering page:", error);
    console.error("[Page] Home: Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("[Page] Home: Error type:", error?.constructor?.name);
    console.error("[Page] Home: Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : "Unknown",
    });

    // Return a minimal error page
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Page Rendering Error</h1>
        <p className="text-gray-600 mb-2">An error occurred while rendering the home page.</p>
        <details className="mt-4 p-4 bg-gray-100 rounded">
          <summary className="cursor-pointer font-semibold">Error Details</summary>
          <pre className="mt-2 whitespace-pre-wrap text-sm">
            {error instanceof Error ? error.message : String(error)}
            {"\n\n"}
            Stack: {error instanceof Error ? error.stack : "No stack trace"}
          </pre>
        </details>
        <div className="mt-8">
          <a href="/" className="text-blue-600 hover:underline">
            Try refreshing the page
          </a>
        </div>
      </div>
    );
  }
}
