import { ArrowRight, Bot, Cpu, Star, Zap } from "lucide-react";
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
    title: `Best AI Autonomous Coding Agents ${currentYear} - Self-Coding AI Tools`,
    description: `Discover the best autonomous AI coding agents of ${currentYear}. Compare Devin, SWE-Agent, and other self-coding AI tools. Updated weekly with rankings.`,
    keywords: [
      "best autonomous coding agents",
      "AI software engineers",
      "self-coding AI tools",
      "autonomous programming agents",
      "Devin AI",
      "SWE-Agent",
      `AI agents ${currentYear}`,
      "automated coding",
      "AI software development",
      "autonomous AI tools",
    ],
    openGraph: {
      title: `Best AI Autonomous Coding Agents ${currentYear} - Self-Coding AI Tools`,
      description: `Discover the best autonomous AI coding agents of ${currentYear} that can write, test, and deploy code independently.`,
      type: "website",
      url: `${baseUrl}/${lang}/best-autonomous-agents`,
      siteName: "AI Power Rankings",
    },
    alternates: {
      canonical: `${baseUrl}/${lang}/best-autonomous-agents`,
    },
  };
}

export default async function BestAutonomousAgentsPage({ params }: PageProps) {
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
          Best AI Autonomous Coding Agents of {currentYear}
        </h1>

        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          Explore cutting-edge autonomous AI agents that can independently write, test, debug, and
          deploy code with minimal human intervention. The future of software development is here.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
          <Button size="lg" className="gradient-primary text-white px-8 py-3" asChild>
            <Link href={`/${lang}/rankings?category=autonomous-agent`}>
              View Agent Rankings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${lang}/tools?category=autonomous-agent`}>Browse All Agents</Link>
          </Button>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            <span>6+ AI Agents Ranked</span>
          </div>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-500" />
            <span>Fully Autonomous</span>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-green-500" />
            <span>Multi-step Reasoning</span>
          </div>
        </div>
      </section>

      {/* What Makes an Autonomous Agent */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          What Makes an AI Agent Truly Autonomous?
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Bot className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-3">Independent Decision Making</h3>
              <p className="text-muted-foreground">
                Capable of analyzing problems, planning solutions, and making coding decisions
                without constant human guidance.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Cpu className="h-12 w-12 mx-auto mb-4 text-secondary" />
              <h3 className="text-xl font-semibold mb-3">Multi-step Reasoning</h3>
              <p className="text-muted-foreground">
                Breaks down complex tasks into manageable steps and executes them systematically
                with error handling.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6">
            <CardContent className="pt-0">
              <Zap className="h-12 w-12 mx-auto mb-4 text-accent" />
              <h3 className="text-xl font-semibold mb-3">End-to-End Execution</h3>
              <p className="text-muted-foreground">
                Handles the complete development lifecycle from requirements analysis to testing and
                deployment.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Capabilities Comparison */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">
          Autonomous Agent vs Traditional AI Tools
        </h2>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-primary">Autonomous Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Task Completion:</strong> Handles entire features from start to finish
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Problem Solving:</strong> Debugs and fixes issues independently
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Testing & Validation:</strong> Creates and runs comprehensive tests
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <strong>Learning & Adaptation:</strong> Improves based on feedback and results
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-xl text-muted-foreground">Traditional AI Tools</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Code Suggestions:</strong> Provides completion and snippets
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Human-guided:</strong> Requires constant developer input
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Limited Context:</strong> Works on individual functions or files
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full mt-2"></div>
                  <div>
                    <strong>Reactive:</strong> Responds to prompts rather than planning ahead
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
          When to Use Autonomous Coding Agents
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Rapid Prototyping</h3>
              <p className="text-sm text-muted-foreground">
                Quickly build MVPs and proof-of-concepts without extensive manual coding.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Bug Fixing</h3>
              <p className="text-sm text-muted-foreground">
                Identify, analyze, and fix bugs across large codebases autonomously.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Code Migration</h3>
              <p className="text-sm text-muted-foreground">
                Migrate legacy code to new frameworks or languages with minimal oversight.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Test Generation</h3>
              <p className="text-sm text-muted-foreground">
                Create comprehensive test suites covering edge cases and integration scenarios.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Documentation</h3>
              <p className="text-sm text-muted-foreground">
                Generate technical documentation, API docs, and code comments automatically.
              </p>
            </CardContent>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-all duration-200">
            <CardContent className="pt-0">
              <h3 className="text-lg font-semibold mb-3 text-primary">Routine Tasks</h3>
              <p className="text-sm text-muted-foreground">
                Handle repetitive coding tasks like CRUD operations and boilerplate code.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Leading Agents Preview */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Leading Autonomous Coding Agents</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Devin AI</span>
                <Badge variant="default">Pioneer</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                The world's first fully autonomous AI software engineer, capable of planning,
                coding, testing, and deploying complete applications.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>Full stack development • Multi-step reasoning</span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-all duration-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>SWE-Agent</span>
                <Badge variant="secondary">Open Source</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Research-focused agent that tackles real-world software engineering tasks with
                impressive performance on SWE-bench benchmarks.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Research proven • GitHub integration</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center bg-muted/30 rounded-lg p-12">
        <h2 className="text-3xl font-bold mb-4">Ready to Experience Autonomous Coding?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Explore our comprehensive rankings to find the autonomous AI agent that will revolutionize
          your development workflow and unlock new possibilities.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="gradient-primary text-white px-8" asChild>
            <Link href={`/${lang}/rankings?category=autonomous-agent`}>
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
