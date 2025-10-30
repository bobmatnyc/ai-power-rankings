import { ArrowRight, Bug, FlaskConical, Play, Star, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveCrownIcon } from "@/components/ui/crown-icon-server";
import type { Locale } from "@/i18n/config";
import { locales } from "@/i18n/config";
import { getCurrentYear } from "@/lib/get-current-year";
import { getUrl } from "@/lib/get-url";

// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/best-testing-tools`;
  });

  return {
    title: `Best AI Testing Tools ${currentYear} - Automated Test Generation & QA`,
    description: `Discover the best AI-powered testing tools of ${currentYear}. Compare intelligent test automation, automated test generation, and QA platforms. Updated weekly.`,
    keywords: [
      "best AI testing tools",
      "automated test generation",
      "AI test automation",
      `testing frameworks ${currentYear}`,
      "intelligent QA tools",
      "automated testing platforms",
      "AI-powered testing",
      "test case generation",
      "quality assurance automation",
      "smart testing solutions",
    ],
    openGraph: {
      title: `Best AI Testing Tools ${currentYear} - Automated Test Generation & QA`,
      description: `Discover the best AI-powered testing tools of ${currentYear}. Compare top intelligent test automation platforms trusted by QA teams.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-testing-tools`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/best-testing-tools`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function BestTestingToolsPage({ params }: PageProps) {
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
          Best AI Testing Tools of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover the top AI-powered testing tools that automate test generation, enhance quality
          assurance, and provide intelligent testing insights for better software quality.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=testing-tool`}>
              View Testing Tool Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=testing-tool`}>Browse All Testing Tools</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>10+ Testing Tools Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-blue-500" />
            <span>All Testing Types Covered</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span>Trusted by QA Teams</span>
          </div>
        </div>
      </section>

      {/* What Makes a Great Testing Tool */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">What Makes a Testing Tool the Best?</h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Target className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Intelligent Test Generation</h3>
              <p className="text-muted-foreground">
                AI-powered automatic test case generation that understands application behavior and
                creates comprehensive test coverage.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Bug className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Smart Bug Detection</h3>
              <p className="text-muted-foreground">
                Advanced defect detection that identifies edge cases, performance issues, and
                potential failures before they reach production.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Play className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Automated Execution</h3>
              <p className="text-muted-foreground">
                Seamless integration with CI/CD pipelines for continuous testing with intelligent
                test selection and parallel execution.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top Features to Look For */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Key Features of Top Testing Tools</h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Core Testing Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Automated Test Generation:</strong> AI creates comprehensive test suites
                    from specifications
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Visual Testing:</strong> Automated UI/UX regression testing across
                    devices and browsers
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>API Testing:</strong> Intelligent API validation and contract testing
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Performance Testing:</strong> AI-driven load testing and performance
                    optimization
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Intelligence & Insights</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Test Optimization:</strong> ML algorithms optimize test execution order
                    and priority
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Flaky Test Detection:</strong> Identifies and manages unreliable tests
                    automatically
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Coverage Analysis:</strong> Intelligent insights into test coverage gaps
                    and recommendations
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Root Cause Analysis:</strong> AI-powered failure analysis and debugging
                    assistance
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular Testing Tools Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Popular Testing Tools to Consider</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Testim</span>
                <Badge variant="secondary">AI-Powered</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                AI-driven test automation platform with self-healing tests, smart locators, and
                intelligent test creation and maintenance.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Web, Mobile, API Testing</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Mabl</span>
                <Badge variant="secondary">ML-Native</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Machine learning-native test automation with auto-healing, visual regression
                testing, and intelligent insights for continuous testing.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>E2E, Visual, Accessibility</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Applitools</span>
                <Badge variant="secondary">Visual AI</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered visual testing platform that validates UI appearance and user experience
                across all devices and browsers automatically.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Visual AI, Cross-browser</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Automate Your Testing?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the perfect AI testing tool that will enhance
          your quality assurance, reduce testing time, and improve software reliability.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=testing-tool`}>
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
