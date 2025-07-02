import { ArrowRight, Code, Star, Users, Zap } from "lucide-react";
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
    title: `Best AI IDE Assistants ${currentYear} - Top Code Completion Tools`,
    description: `Discover the best AI IDE assistants of ${currentYear}. Compare GitHub Copilot, Cursor, Tabnine, and other top AI code completion tools. Updated weekly with rankings.`,
    keywords: [
      "best AI IDE assistants",
      "AI code completion tools",
      "GitHub Copilot alternatives",
      `IDE AI tools ${currentYear}`,
      "smart code completion",
      "AI pair programming",
      "Cursor IDE",
      "Tabnine",
      "CodeWhisperer",
      "AI autocomplete",
    ],
    openGraph: {
      title: `Best AI IDE Assistants ${currentYear} - Top Code Completion Tools`,
      description: `Discover the best AI IDE assistants of ${currentYear}. Compare top AI code completion tools trusted by developers.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-ide-assistants`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      canonical: `${baseUrl}/${lang}/best-ide-assistants`,
    },
  };
}

export default async function BestIDEAssistantsPage({ params }: PageProps) {
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
          Best AI IDE Assistants of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover the top AI-powered IDE assistants that provide intelligent code completion,
          context-aware suggestions, and seamless integration with your development environment.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=ide-assistant`}>
              View IDE Assistant Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=ide-assistant`}>Browse All IDE Tools</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>7+ IDE Tools Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Code className="h-4 w-4 text-blue-500" />
            <span>20+ Languages Supported</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span>Millions of Developers</span>
          </div>
        </div>
      </section>

      {/* What Makes a Great IDE Assistant */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes an IDE Assistant the Best?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Code className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Smart Code Completion</h3>
              <p className="text-muted-foreground">
                Context-aware suggestions that understand your codebase, coding patterns, and
                project structure.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Zap className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Seamless Integration</h3>
              <p className="text-muted-foreground">
                Works natively with popular IDEs like VS Code, IntelliJ, and others without
                disrupting your workflow.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Users className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Developer Productivity</h3>
              <p className="text-muted-foreground">
                Proven to increase coding speed and reduce errors through intelligent assistance and
                real-time feedback.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top Features to Look For */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Key Features of Top IDE Assistants</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Essential Features</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Multi-language Support:</strong> Works across major programming
                    languages
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Context Understanding:</strong> Analyzes your entire codebase for
                    relevant suggestions
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Real-time Suggestions:</strong> Instant code completion as you type
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Error Detection:</strong> Identifies and suggests fixes for common
                    issues
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Advanced Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Code Generation:</strong> Creates entire functions from comments or
                    descriptions
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Test Creation:</strong> Automatically generates unit tests for your code
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Refactoring Help:</strong> Suggests code improvements and optimizations
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Documentation:</strong> Generates comments and documentation
                    automatically
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular IDE Assistants Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Popular IDE Assistants to Consider</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>GitHub Copilot</span>
                <Badge variant="secondary">Premium</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                AI pair programmer powered by OpenAI Codex, offering suggestions for entire
                functions and complex logic.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>VS Code, JetBrains, Neovim</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Tabnine</span>
                <Badge variant="secondary">Freemium</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Local and cloud-based AI assistant with strong privacy features and team
                collaboration tools.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>All major IDEs</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Amazon CodeWhisperer</span>
                <Badge variant="secondary">Free</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                ML-powered coding companion with security scanning and AWS service optimization.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>VS Code, IntelliJ, AWS Cloud9</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Supercharge Your IDE?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the perfect AI IDE assistant that will
          transform your coding experience and boost your productivity.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=ide-assistant`}>
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
