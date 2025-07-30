import { ArrowRight, Brain, Edit, Palette, Star } from "lucide-react";
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
    languages[locale] = `${baseUrl}/${locale}/best-ai-code-editors`;
  });

  return {
    title: `Best AI Code Editors ${currentYear} - Smart Programming Environments`,
    description: `Discover the best AI-powered code editors of ${currentYear}. Compare Cursor, Windsurf, and other intelligent programming environments. Updated weekly.`,
    keywords: [
      "best AI code editors",
      "smart code editors",
      "AI programming environments",
      "Cursor editor",
      "Windsurf IDE",
      "intelligent code editors",
      "AI-enhanced editors",
      `code editor AI ${currentYear}`,
      "smart programming tools",
      "AI coding platforms",
    ],
    openGraph: {
      title: `Best AI Code Editors ${currentYear} - Smart Programming Environments`,
      description: `Discover the best AI-powered code editors of ${currentYear} that revolutionize how you write and edit code.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-ai-code-editors`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/best-ai-code-editors`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function BestAICodeEditorsPage({ params }: PageProps) {
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
          Best AI Code Editors of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover intelligent code editors that combine the power of AI with intuitive interfaces
          to create the ultimate programming environment. Built from the ground up with AI at their
          core.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=code-editor`}>
              View Editor Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=code-editor`}>Browse All Editors</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>3+ AI Editors Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Edit className="h-4 w-4 text-blue-500" />
            <span>Native AI Integration</span>
          </div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-green-500" />
            <span>Intelligent by Design</span>
          </div>
        </div>
      </section>

      {/* AI Editor vs Traditional Editor */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          AI-Native Editors vs Traditional Editors with AI Plugins
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6 border-primary/20">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-primary flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Native Editors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Built-in Intelligence:</strong> AI is core to the editor's architecture
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Seamless Experience:</strong> No plugin conflicts or integration issues
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Optimized Performance:</strong> AI features run efficiently without
                    overhead
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Unified Interface:</strong> AI and editor features work as one system
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-muted-foreground flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Traditional + AI Plugins
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Added Intelligence:</strong> AI bolted onto existing architecture
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Plugin Dependencies:</strong> Requires third-party extensions
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Potential Conflicts:</strong> Plugins may interfere with each other
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Fragmented UX:</strong> Different interfaces for different AI features
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Key Features */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes an AI Code Editor Exceptional?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Brain className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Contextual Intelligence</h3>
              <p className="text-muted-foreground">
                Understands your entire codebase context and provides relevant suggestions based on
                project patterns and conventions.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Edit className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Natural Interaction</h3>
              <p className="text-muted-foreground">
                Communicate with your editor using natural language to make changes, refactor code,
                and implement features.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Palette className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Adaptive Interface</h3>
              <p className="text-muted-foreground">
                Interface adapts to your workflow and coding style, showing relevant tools and
                information when you need them.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Advanced Capabilities */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Advanced AI Editor Capabilities</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Code Understanding</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Semantic Analysis:</strong> Deep understanding of code meaning and
                    intent
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Cross-file Reasoning:</strong> Understands relationships across your
                    project
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Pattern Recognition:</strong> Identifies coding patterns and
                    anti-patterns
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Intent Prediction:</strong> Anticipates what you're trying to accomplish
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Intelligent Assistance</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Smart Refactoring:</strong> Suggests and implements complex refactoring
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Error Prevention:</strong> Catches potential issues before they occur
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Code Optimization:</strong> Automatically optimizes for performance
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Learning Adaptation:</strong> Learns from your coding style and
                    preferences
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular AI Editors */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Leading AI-Native Code Editors</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Cursor</span>
                <Badge variant="default">Popular</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                VS Code fork with native AI integration, offering seamless code generation, editing,
                and chat capabilities directly in the editor interface.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>VS Code compatible • Chat interface • Codebase understanding</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Windsurf</span>
                <Badge variant="secondary">Emerging</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Next-generation AI editor built from scratch with AI-first design principles,
                featuring advanced code understanding and natural language interaction.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>AI-first design • Multi-modal interface • Predictive coding</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Upgrade Your Coding Experience?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the AI code editor that will transform how you
          write, edit, and think about code.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=code-editor`}>
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
