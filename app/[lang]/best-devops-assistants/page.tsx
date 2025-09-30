import { ArrowRight, Cloud, Cog, Rocket, Server, Star, Users } from "lucide-react";
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
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const baseUrl = getUrl();
  const currentYear = getCurrentYear();

  // Build hreflang alternates for all supported languages
  const languages: Record<string, string> = {};
  locales.forEach((locale) => {
    languages[locale] = `${baseUrl}/${locale}/best-devops-assistants`;
  });

  return {
    title: `Best AI DevOps Assistants ${currentYear} - Infrastructure Automation Tools`,
    description: `Discover the best AI-powered DevOps assistants of ${currentYear}. Compare intelligent infrastructure automation, deployment pipelines, and monitoring tools. Updated weekly.`,
    keywords: [
      "best AI DevOps assistants",
      "infrastructure automation tools",
      "AI deployment automation",
      `DevOps AI tools ${currentYear}`,
      "intelligent monitoring",
      "CI/CD automation",
      "cloud infrastructure AI",
      "deployment pipeline automation",
      "infrastructure as code AI",
      "DevOps intelligence",
    ],
    openGraph: {
      title: `Best AI DevOps Assistants ${currentYear} - Infrastructure Automation Tools`,
      description: `Discover the best AI-powered DevOps assistants of ${currentYear}. Compare top infrastructure automation tools trusted by engineering teams.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-devops-assistants`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      // Always set canonical to the English version
      canonical: `${baseUrl}/en/best-devops-assistants`,
      // Include hreflang tags for all supported languages
      languages,
    },
  };
}

export default async function BestDevOpsAssistantsPage({ params }: PageProps) {
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
          Best AI DevOps Assistants of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Discover the top AI-powered DevOps assistants that automate infrastructure management,
          optimize deployment pipelines, and enhance monitoring with intelligent insights.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=devops-assistant`}>
              View DevOps Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=devops-assistant`}>Browse All DevOps Tools</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>12+ DevOps Tools Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-blue-500" />
            <span>Multi-Cloud Support</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-green-500" />
            <span>Enterprise-Ready Solutions</span>
          </div>
        </div>
      </section>

      {/* What Makes a Great DevOps Assistant */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes a DevOps Assistant the Best?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Rocket className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Intelligent Automation</h3>
              <p className="text-muted-foreground">
                AI-driven automation that optimizes deployment pipelines, scales infrastructure, and
                manages resources based on intelligent predictions.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Server className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Infrastructure Intelligence</h3>
              <p className="text-muted-foreground">
                Smart monitoring and alerting that understands normal patterns and proactively
                identifies issues before they impact users.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Cog className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">Seamless Integration</h3>
              <p className="text-muted-foreground">
                Native integration with existing DevOps toolchains, cloud platforms, and workflow
                automation without disrupting established processes.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Top Features to Look For */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Key Features of Top DevOps Assistants
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Core Automation</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>CI/CD Pipeline Optimization:</strong> Intelligent build and deployment
                    automation
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Infrastructure as Code:</strong> AI-assisted infrastructure provisioning
                    and management
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Auto-scaling Intelligence:</strong> Predictive scaling based on usage
                    patterns
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Security Automation:</strong> Automated vulnerability scanning and
                    compliance checks
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl">Intelligent Monitoring</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Anomaly Detection:</strong> AI-powered identification of unusual system
                    behavior
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Predictive Analytics:</strong> Forecasting performance issues and
                    capacity needs
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Root Cause Analysis:</strong> Intelligent troubleshooting and issue
                    resolution
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-secondary rounded-full mt-2"></div>
                  <div>
                    <strong>Cost Optimization:</strong> AI-driven resource allocation and cost
                    management
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Popular DevOps Assistants Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Popular DevOps Assistants to Consider
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Datadog AI</span>
                <Badge variant="secondary">Enterprise</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered monitoring and analytics platform with intelligent alerting and automated
                incident response capabilities.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Full-stack monitoring, APM</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>AWS AI DevOps</span>
                <Badge variant="secondary">Cloud Native</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Comprehensive AI-driven DevOps suite with intelligent deployment automation,
                monitoring, and cost optimization for AWS infrastructure.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>CodePipeline, CloudWatch, X-Ray</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>GitLab AI</span>
                <Badge variant="secondary">Platform</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Integrated DevOps platform with AI-powered pipeline optimization, security scanning,
                and intelligent project insights.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Full DevOps lifecycle, Security</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Automate Your DevOps?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the perfect AI DevOps assistant that will
          streamline your infrastructure, optimize deployments, and enhance monitoring.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=devops-assistant`}>
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
