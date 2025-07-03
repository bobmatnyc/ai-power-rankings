import { ArrowRight, Shield, Star, TrendingUp, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveCrownIcon } from "@/components/ui/optimized-image";
import type { Locale } from "@/i18n/config";
import { getCurrentYear } from "@/lib/get-current-year";
import { getUrl } from "@/lib/get-url";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  return {
    title: `Best AI Coding Tools ${currentYear} - Top 50+ Developer AI Assistants`,
    description: `Discover the best AI coding tools of ${currentYear}. Compare Cursor, GitHub Copilot, Claude, and 50+ top AI assistants. Updated weekly with rankings and reviews.`,
    keywords: [
      "best AI coding tools",
      "top AI coding assistants",
      `AI development tools ${currentYear}`,
      "code completion AI",
      "AI pair programming",
      "smart code editor",
      "automated coding tools",
      "AI code generation",
      "developer AI tools",
      "coding AI comparison",
    ],
    openGraph: {
      title: `Best AI Coding Tools ${currentYear} - Top Developer AI Assistants`,
      description: `Discover the best AI coding tools of ${currentYear}. Compare top AI assistants trusted by developers worldwide.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-ai-coding-tools`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      canonical: `${baseUrl}/${lang}/best-ai-coding-tools`,
    },
  };
}

export default async function BestAICodingToolsPage({ params }: PageProps) {
  const { lang } = await params;
  const currentYear = getCurrentYear();

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <div className="flex justify-center mb-6">
          <ResponsiveCrownIcon priority={true} className="w-16 h-16" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          Best AI Coding Tools of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover and compare the top 50+ AI coding tools trusted by developers worldwide. From
          autonomous agents to smart code completion, find the perfect AI assistant for your
          workflow.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings`}>
              View Complete Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools`}>Browse All Tools</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>50+ Tools Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span>Updated Weekly</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <span>Independent Analysis</span>
          </div>
        </div>
      </section>

      {/* Top Categories */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Top AI Coding Tool Categories</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href={`/${lang}/best-ide-assistants`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>IDE Assistants</span>
                  <Badge variant="secondary">7 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-powered code completion and intelligent suggestions directly in your IDE.
                </p>
                <div className="text-sm text-primary group-hover:underline">
                  Explore IDE Tools →
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-autonomous-agents`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Autonomous Agents</span>
                  <Badge variant="secondary">6 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Fully autonomous AI that can write, test, and deploy code independently.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore Agents →</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-ai-code-editors`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Smart Editors</span>
                  <Badge variant="secondary">3 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-enhanced code editors with built-in intelligence and automation.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore Editors →</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-ai-app-builders`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>App Builders</span>
                  <Badge variant="secondary">4 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-powered platforms for rapid application development and prototyping.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore Builders →</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-code-review-tools`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Code Review</span>
                  <Badge variant="secondary">15 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Automated code analysis and security scanning for better code quality.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore Review Tools →</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-devops-assistants`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>DevOps Assistants</span>
                  <Badge variant="secondary">12 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Infrastructure automation and intelligent deployment pipeline management.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore DevOps Tools →</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-testing-tools`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Testing Tools</span>
                  <Badge variant="secondary">10 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-powered test generation and automated quality assurance platforms.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore Testing Tools →</div>
              </CardContent>
            </Card>
          </Link>

          <Link href={`/${lang}/best-open-source-frameworks`} className="block">
            <Card className="h-full hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Open Source</span>
                  <Badge variant="secondary">20 Tools</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Free and open source AI frameworks and machine learning libraries.
                </p>
                <div className="text-sm text-primary group-hover:underline">Explore Frameworks →</div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>

      {/* Key Features */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes an AI Coding Tool the Best?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Zap className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Smart Code Generation</h3>
              <p className="text-muted-foreground">
                Advanced AI that understands context and generates high-quality, production-ready
                code across multiple languages.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Developer Adoption</h3>
              <p className="text-muted-foreground">
                Proven track record with thousands of developers and integration with popular
                development environments.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Shield className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Enterprise Ready</h3>
              <p className="text-muted-foreground">
                Security, compliance, and scalability features that meet the needs of professional
                development teams.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Find Your Perfect AI Coding Assistant?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Browse our comprehensive rankings to discover the AI tool that will transform your
          development workflow and boost your productivity.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings`}>
              View Complete Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/methodology`}>Learn Our Methodology</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
