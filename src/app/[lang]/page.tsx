import { ArrowRight, ArrowUp, Star } from "lucide-react";
import type { Metadata } from "next";
import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveCrownIcon } from "@/components/ui/optimized-image";
import { RankingsTableSkeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";

interface ToolData {
  id: string;
  name: string;
  status: string;
  slug?: string;
  description?: string;
  category?: string;
}

// Dynamic import for T-031 performance optimization
const ClientRankings = dynamicImport(
  () => import("./client-rankings-optimized").then((mod) => ({ default: mod.ClientRankings })),
  {
    loading: () => <RankingsTableSkeleton />,
  }
);

// Dynamic import for T-033 What's New modal
const WhatsNewModalClient = dynamicImport(
  () =>
    import("@/components/ui/whats-new-modal-client").then((mod) => ({
      default: mod.WhatsNewModalClient,
    })),
  {
    loading: () => <div></div>,
  }
);

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

// Force dynamic rendering to ensure API calls work at runtime
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const baseUrl = getUrl();

  // Fetch all tools to include in keywords
  let toolNames: string[] = [];
  try {
    const toolsUrl = `${baseUrl}/api/tools`;
    const response = await fetch(toolsUrl, {
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (response.ok) {
      const data = await response.json();
      // Handle both direct array and object with tools property
      // API returns { tools: [...], _source: "json-db", _timestamp: "..." }
      const tools = Array.isArray(data) ? data : data.tools || [];

      // Ensure tools is an array and get all active tool names
      if (Array.isArray(tools)) {
        toolNames = tools
          .filter((tool: ToolData) => tool.status === "active")
          .map((tool: ToolData) => tool.name)
          .filter(Boolean); // Remove any null/undefined names
      }
    }
  } catch (error) {
    console.error("Error fetching tools for SEO:", error);
    // Continue with empty toolNames array for graceful degradation
  }

  // Get existing keywords from dictionary
  const baseKeywords = dict.seo?.keywords || "";

  // Add all tool names to keywords
  const allKeywords = [
    baseKeywords,
    ...toolNames,
    // Add tool comparison keywords (only for tools with valid names)
    ...toolNames
      .slice(0, 5)
      .filter(Boolean)
      .map((tool) => `${tool} AI`),
    ...toolNames
      .slice(0, 5)
      .filter(Boolean)
      .map((tool) => `${tool} ranking`),
    // Add category keywords
    "AI coding assistant",
    "AI code editor",
    "autonomous coding agent",
    "AI app builder",
  ]
    .filter(Boolean) // Remove any null/undefined/empty values
    .filter((keyword) => typeof keyword === "string" && keyword.trim().length > 0) // Ensure valid strings
    .join(", ");

  return {
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
      url: `${baseUrl}/${lang}`,
      siteName: dict.common?.appName || "AI Power Rankings",
      images: [
        {
          url: `${baseUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: dict.common?.appName || "AI Power Rankings",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: dict.seo?.title || "AI Power Rankings",
      description:
        dict.seo?.description || "Comprehensive rankings of AI coding tools and assistants",
      images: [`${baseUrl}/og-image.png`],
    },
    alternates: {
      canonical: `${baseUrl}/${lang}`,
      languages: {
        en: `${baseUrl}/en`,
        de: `${baseUrl}/de`,
        fr: `${baseUrl}/fr`,
        it: `${baseUrl}/it`,
        ja: `${baseUrl}/ja`,
        ko: `${baseUrl}/ko`,
        uk: `${baseUrl}/uk`,
        hr: `${baseUrl}/hr`,
        zh: `${baseUrl}/zh`,
        es: `${baseUrl}/es`,
      },
    },
  };
}

export default async function Home({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const baseUrl = getUrl();

  // Provide server-side fallback data to prevent loading state
  let serverRankings: any[] = [];
  try {
    // Try to read static file directly during server-side rendering
    if (typeof window === "undefined") {
      const path = await import("path");
      const fs = await import("fs").then((m) => m.promises);

      const staticRankingsPath = path.join(process.cwd(), "public", "data", "rankings.json");
      const data = JSON.parse(await fs.readFile(staticRankingsPath, "utf8"));
      serverRankings = (data.rankings || []).slice(0, 3); // Top 3 for immediate display
      console.log(`[SSR] Loaded ${serverRankings.length} rankings for immediate display`);
    } else {
      // Client-side fallback (shouldn't happen in SSR but just in case)
      const rankingsResponse = await fetch(`${baseUrl}/data/rankings.json`, {
        next: { revalidate: 300 },
      });
      if (rankingsResponse.ok) {
        const data = await rankingsResponse.json();
        serverRankings = (data.rankings || []).slice(0, 3);
      }
    }
  } catch (error) {
    console.error("Server-side rankings fetch failed:", error);
    // Will use empty array as fallback
  }

  // Create structured data for SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: dict.common.appName,
    description: dict.seo.description,
    url: `${baseUrl}/${lang}`,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/${lang}/rankings?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* T-033 What's New Modal */}
      <WhatsNewModalClient />
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
              <Button variant="ghost" size="sm" asChild>
                <Link
                  href={`/${lang}/about?subscribe=true`}
                  className="text-primary hover:text-primary/80"
                >
                  Subscribe to Updates →
                </Link>
              </Button>
            </div>
          </div>

          {/* Top 3 Tools and all dynamic content with server fallback */}
          <ClientRankings
            loadingText={dict.common.loading}
            lang={lang}
            initialRankings={serverRankings}
          />
        </div>
      </section>

      {/* Categories Overview */}
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

      {/* Trust Signals for T-042 SEO */}
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

      {/* Methodology Brief */}
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
    </div>
  );
}
