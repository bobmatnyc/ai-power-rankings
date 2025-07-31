import { ArrowRight, Globe, Layers, Smartphone, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveCrownIcon } from "@/components/ui/optimized-image";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getCurrentYear } from "@/lib/get-current-year";
import { getUrl } from "@/lib/get-url";

// Force dynamic rendering to prevent build timeout
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/best-ai-app-builders`;
  });

  return {
    title: `Best AI App Builders ${currentYear} - No-Code AI Development Platforms`,
    description: `Discover the best AI app builders of ${currentYear}. Compare v0, Bolt, and other AI-powered no-code platforms. Build apps fast with AI assistance.`,
    keywords: [
      "best AI app builders",
      "no-code AI platforms",
      "AI development tools",
      "v0 by Vercel",
      "Bolt AI",
      "AI app development",
      "rapid prototyping AI",
      "no-code app builders",
      "AI web development",
      "visual development AI",
    ],
    openGraph: {
      title: `Best AI App Builders ${currentYear} - No-Code AI Development Platforms`,
      description: `Discover the best AI app builders of ${currentYear} that let you create applications rapidly with AI assistance.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-ai-app-builders`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/best-ai-app-builders`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function BestAIAppBuildersPage({ params }: PageProps) {
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
          Best AI App Builders of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover AI-powered platforms that transform ideas into applications in minutes, not
          months. Build web apps, mobile apps, and prototypes with the power of artificial
          intelligence.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=app-builder`}>
              View Builder Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=app-builder`}>Browse All Builders</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>4+ Builders Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-500" />
            <span>Visual Development</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-green-500" />
            <span>Production Ready</span>
          </div>
        </div>
      </section>

      {/* What Makes a Great AI App Builder */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes an AI App Builder Exceptional?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Layers className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Visual Development</h3>
              <p className="text-muted-foreground">
                Transform natural language descriptions into visual components, layouts, and
                complete user interfaces instantly.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Smartphone className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Rapid Prototyping</h3>
              <p className="text-muted-foreground">
                Build functional prototypes and MVPs in hours, not weeks, with AI handling the
                complex implementation details.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Globe className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Production Deployment</h3>
              <p className="text-muted-foreground">
                Generate clean, maintainable code that can be deployed to production environments
                with confidence.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* AI Builder vs Traditional No-Code */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          AI App Builders vs Traditional No-Code Platforms
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6 border-primary/20">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-primary flex items-center gap-2">
                <Layers className="h-5 w-5" />
                AI App Builders
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Natural Language Input:</strong> Describe what you want in plain English
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Intelligent Generation:</strong> AI creates components and logic
                    automatically
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Contextual Understanding:</strong> Understands app requirements and best
                    practices
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Iterative Refinement:</strong> Easy to modify and improve with
                    conversational feedback
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Traditional No-Code
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Visual Interface:</strong> Drag-and-drop components manually
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Manual Configuration:</strong> Set up logic and workflows step by step
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Template-based:</strong> Limited to predefined components and patterns
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Learning Curve:</strong> Requires understanding of platform-specific
                    concepts
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Perfect Use Cases for AI App Builders
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">MVP Development</h3>
              <p className="text-sm text-muted-foreground">
                Quickly validate ideas with functional prototypes that can evolve into full
                products.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Landing Pages</h3>
              <p className="text-sm text-muted-foreground">
                Create conversion-optimized landing pages with modern designs and responsive
                layouts.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Admin Dashboards</h3>
              <p className="text-sm text-muted-foreground">
                Build data visualization and management interfaces with charts, tables, and forms.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">E-commerce Sites</h3>
              <p className="text-sm text-muted-foreground">
                Develop online stores with product catalogs, shopping carts, and payment
                integration.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Portfolio Sites</h3>
              <p className="text-sm text-muted-foreground">
                Design professional portfolios and business websites with custom branding.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Internal Tools</h3>
              <p className="text-sm text-muted-foreground">
                Create custom business tools and workflows to streamline internal processes.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Features */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Essential Features to Look For</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Development Features</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Component Library:</strong> Rich set of pre-built UI components
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Responsive Design:</strong> Automatic mobile and tablet optimization
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Real-time Preview:</strong> See changes instantly as you build
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Version Control:</strong> Track changes and collaborate with teams
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Deployment & Integration</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>One-click Deployment:</strong> Deploy to popular hosting platforms
                    instantly
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>API Integration:</strong> Connect to external services and databases
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Custom Domains:</strong> Use your own domain name for branding
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>SEO Optimization:</strong> Built-in SEO features for better visibility
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular Builders Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Leading AI App Builders</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>v0 by Vercel</span>
                <Badge variant="default">Popular</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Generate UI components and full applications from text prompts, with seamless
                integration into modern React and Next.js workflows.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>React/Next.js • Shadcn UI • Vercel deployment</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Bolt (StackBlitz)</span>
                <Badge variant="secondary">Full-stack</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Build and deploy full-stack applications with AI assistance, featuring an in-browser
                development environment and instant preview capabilities.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Full-stack • Browser IDE • Instant deployment</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Build Your Next App with AI?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the AI app builder that will help you transform
          ideas into reality faster than ever before.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=app-builder`}>
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
