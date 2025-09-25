import { ArrowRight, GitBranch, Search, Shield, Star, Users } from "lucide-react";
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

// Force dynamic rendering to avoid Clerk SSG issues
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
    languages[locale] = `${baseUrl}/${locale}/best-code-review-tools`;
  });

  return {
    title: `Best AI Code Review Tools ${currentYear} - Automated Code Analysis`,
    description: `Discover the best AI-powered code review tools of ${currentYear}. Compare automated code analysis platforms that enhance code quality, security, and team collaboration. Updated weekly.`,
    keywords: [
      "best AI code review tools",
      "automated code analysis",
      "AI code quality tools",
      `code review automation ${currentYear}`,
      "static code analysis",
      "code security scanning",
      "peer review automation",
      "code quality metrics",
      "GitHub code review",
      "pull request automation",
    ],
    openGraph: {
      title: `Best AI Code Review Tools ${currentYear} - Automated Code Analysis`,
      description: `Discover the best AI-powered code review tools of ${currentYear}. Compare top automated code analysis platforms trusted by development teams.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-code-review-tools`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/best-code-review-tools`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function BestCodeReviewToolsPage({ params }: PageProps) {
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
          Best AI Code Review Tools of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover the top AI-powered code review tools that automate code analysis, enhance
          security scanning, and improve code quality through intelligent reviews.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=code-review`}>
              View Code Review Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=code-review`}>Browse All Review Tools</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>15+ Review Tools Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-500" />
            <span>Security & Quality Focus</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span>Enterprise-Grade Solutions</span>
          </div>
        </div>
      </section>

      {/* What Makes a Great Code Review Tool */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes a Code Review Tool the Best?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Search className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Intelligent Analysis</h3>
              <p className="text-muted-foreground">
                AI-powered static analysis that understands code patterns, identifies potential
                bugs, and suggests improvements automatically.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Shield className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Security Scanning</h3>
              <p className="text-muted-foreground">
                Advanced vulnerability detection that identifies security issues, compliance
                violations, and potential attack vectors in real-time.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <GitBranch className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Workflow Integration</h3>
              <p className="text-muted-foreground">
                Seamless integration with Git workflows, pull requests, and CI/CD pipelines without
                disrupting team productivity.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top Features to Look For */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Key Features of Top Code Review Tools
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Core Capabilities</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Automated Code Analysis:</strong> Comprehensive static code analysis
                    across multiple languages
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Security Vulnerability Detection:</strong> Identifies potential security
                    risks and compliance issues
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Code Quality Metrics:</strong> Tracks maintainability, complexity, and
                    technical debt
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Pull Request Integration:</strong> Automated reviews on every pull
                    request
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Advanced Features</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>AI-Powered Suggestions:</strong> Intelligent recommendations for code
                    improvements
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Custom Rule Configuration:</strong> Tailored analysis rules for your
                    team standards
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Team Collaboration:</strong> Shared insights and review coordination
                    features
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Reporting & Analytics:</strong> Comprehensive metrics and trend analysis
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular Code Review Tools Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Popular Code Review Tools to Consider
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>SonarQube</span>
                <Badge variant="secondary">Enterprise</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Comprehensive code quality platform with advanced security scanning and technical
                debt management for teams.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>27+ Languages, CI/CD Integration</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>CodeClimate</span>
                <Badge variant="secondary">SaaS</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Automated code review and quality analytics with maintainability insights and
                engineering intelligence.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>GitHub, GitLab Integration</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>DeepCode</span>
                <Badge variant="secondary">AI-Powered</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                AI-native code review tool that learns from millions of commits to provide
                intelligent security and quality insights.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>VS Code, JetBrains, Web</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Automate Your Code Reviews?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the perfect AI code review tool that will
          enhance your code quality, security, and team collaboration.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=code-review`}>
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
