import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Newspaper, Star, ArrowUp } from "lucide-react";
import { ClientRankings } from "./client-rankings";
import { getDictionary } from "@/i18n/get-dictionary";
import { ResponsiveCrownIcon } from "@/components/ui/optimized-image";
import type { Locale } from "@/i18n/config";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

// Force dynamic rendering to ensure API calls work at runtime
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function Home({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

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
              <Button variant="outline" size="lg" asChild>
                <Link href={`/${lang}/updates`}>
                  {dict.home.hero.whatsNewButton}
                  <Newspaper className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Top 3 Tools and all dynamic content */}
          <ClientRankings loadingText={dict.common.loading} lang={lang} />
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
    </div>
  );
}
