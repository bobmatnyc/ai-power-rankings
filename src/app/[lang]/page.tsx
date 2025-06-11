import Link from "next/link";
import { loggers } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowRight, Star, TrendingUp } from "lucide-react";
import { RankingCard } from "@/components/ranking/ranking-card";
import { HomeContent } from "./home-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function Home({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  // Fetch rankings on the server
  let topRankings = [];
  let trendingTools = [];
  let recentlyUpdated = [];
  let loading = false;

  try {
    const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/rankings`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    const data = await response.json();
    const rankings = data.rankings;

    topRankings = rankings.slice(0, 3);
    // For now, simulate trending as the next 3 tools
    trendingTools = rankings.slice(3, 6);
    // And recently updated as the next 4
    recentlyUpdated = rankings.slice(6, 10);
  } catch (error) {
    loggers.api.error("Failed to fetch rankings", { error });
    loading = true; // Show loading state on error
  }

  return (
    <div className="min-h-screen">
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
              <img
                src="/crown-of-technology.png"
                alt="AI Power Rankings Icon"
                className="w-12 h-12 md:w-16 md:h-16 object-contain"
              />
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
                className="gradient-primary text-white hover:opacity-90 transition-opacity"
                asChild
              >
                <Link href={`/${lang}/rankings`}>
                  {dict.home.hero.exploreButton}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href={`/${lang}/rankings?sort=trending`}>
                  {dict.home.hero.trendingButton}
                  <ArrowUp className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Top 3 Tools */}
          <HomeContent
            topRankings={topRankings}
            loading={loading}
            loadingText={dict.common.loading}
          />

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">25</div>
              <div className="text-sm text-muted-foreground">{dict.home.stats.toolsRanked}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary mb-1">{trendingTools.length}</div>
              <div className="text-sm text-muted-foreground">{dict.home.stats.trendingUp}</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-accent mb-1">
                {dict.home.stats.updateFrequency.split(" ")[0]}
              </div>
              <div className="text-sm text-muted-foreground">
                {dict.home.stats.updateFrequency.split(" ")[1]}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground mb-1">100%</div>
              <div className="text-sm text-muted-foreground">{dict.home.stats.freeAccess}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Section */}
      <section className="px-3 md:px-6 py-12 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                <TrendingUp className="h-8 w-8 mr-2 text-accent" />
                {dict.home.trending.title}
              </h2>
              <p className="text-muted-foreground">{dict.home.trending.subtitle}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/${lang}/rankings?sort=trending`}>{dict.home.trending.viewAll}</Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-3 md:gap-6">
            {trendingTools.map((tool: any, index: number) => (
              <div key={tool.tool.id} className="relative h-full">
                <div className="absolute -top-2 -right-2 z-10">
                  <Badge className="bg-accent text-white border-0 shadow-lg">
                    <ArrowUp className="h-3 w-3 mr-1" />+{3 - index}
                  </Badge>
                </div>
                <div className="h-full">
                  <RankingCard ranking={tool} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recently Updated Section */}
      <section className="px-3 md:px-6 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                <Star className="h-8 w-8 mr-2 text-primary" />
                {dict.home.recentlyUpdated.title}
              </h2>
              <p className="text-muted-foreground">{dict.home.recentlyUpdated.subtitle}</p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/${lang}/rankings`}>{dict.home.recentlyUpdated.viewAll}</Link>
            </Button>
          </div>

          <div className="grid md:grid-cols-2 gap-3 md:gap-6">
            {recentlyUpdated.map((tool: any) => (
              <div key={tool.tool.id} className="h-full">
                <RankingCard ranking={tool} />
              </div>
            ))}
          </div>
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

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30 py-12">
        <div className="container mx-auto px-2 md:px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <div>
                  <h3 className="font-bold">{dict.common.appName}</h3>
                  <p className="text-xs text-muted-foreground">{dict.common.appDescription}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                {dict.home.footer.description}
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-3">{dict.home.footer.quickLinks}</h4>
              <div className="space-y-2">
                <Link
                  href={`/${lang}/rankings`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.navigation.rankings}
                </Link>
                <Link
                  href={`/${lang}/news`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.navigation.news}
                </Link>
                <Link
                  href={`/${lang}/tools`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.navigation.tools}
                </Link>
                <Link
                  href={`/${lang}/methodology`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.navigation.methodology}
                </Link>
                <Link
                  href={`/${lang}/about`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.navigation.about}
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">{dict.home.footer.categories}</h4>
              <div className="space-y-2">
                <Link
                  href={`/${lang}/rankings?category=code-assistant`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.categories.codeAssistant}
                </Link>
                <Link
                  href={`/${lang}/rankings?category=ai-editor`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.categories.codeEditor}
                </Link>
                <Link
                  href={`/${lang}/rankings?category=code-review`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.categories.codeReview}
                </Link>
                <Link
                  href={`/${lang}/rankings?category=autonomous-agent`}
                  className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {dict.categories.autonomousAgent}
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-border/50">
            <p className="text-center text-sm text-muted-foreground">
              {dict.home.footer.copyright}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
